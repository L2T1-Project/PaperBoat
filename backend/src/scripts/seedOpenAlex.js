const path = require('path');
const dotenv = require('dotenv');
const DB_Connection = require('../database/db');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const OPENALEX_BASE_URL = 'https://api.openalex.org/works';
const DEFAULT_FILTER = 'from_publication_date:2021-01-01,to_publication_date:2026-12-31';
const DEFAULT_MAX_WORKS = 10000;
const DEFAULT_PER_PAGE = 100;
const DEFAULT_BATCH_SIZE = 500;
const MAX_RETRIES = 5;

const REQUIRED_TABLES = [
  'publisher',
  'venue',
  'author',
  'institute',
  'paper',
  'domain',
  'field',
  'topic',
  'paper_author',
  'paper_topic',
  'citation'
];

function printHelp() {
  console.log('OpenAlex seed script');
  console.log('Usage: npm run seed:openalex');
  console.log('');
  console.log('Safety:');
  console.log('  - Writes are disabled by default.');
  console.log('  - Set OPENALEX_ALLOW_WRITE=true to enable DB writes.');
  console.log('');
  console.log('Key environment variables:');
  console.log('  OPENALEX_FILTER=from_publication_date:2021-01-01,to_publication_date:2026-12-31');
  console.log('  OPENALEX_MAX_WORKS=10000');
  console.log('  OPENALEX_PER_PAGE=100');
  console.log('  OPENALEX_DB_BATCH=500');
  console.log('  OPENALEX_CURSOR_START=*');
  console.log('  OPENALEX_INCLUDE_CITATIONS=true');
  console.log('  OPENALEX_DRY_RUN=true');
  console.log('  OPENALEX_ALLOW_WRITE=false');
}

function parseEnvInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asBool(raw, fallback = false) {
  if (raw === undefined || raw === null) return fallback;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeDoi(raw) {
  if (!raw) return null;
  const value = String(raw).trim().toLowerCase();
  const stripped = value
    .replace(/^https?:\/\/doi\.org\//, '')
    .replace(/^doi:/, '')
    .trim();
  if (!stripped) return null;
  return stripped.length > 100 ? stripped.slice(0, 100) : stripped;
}

function normalizeOrcid(raw) {
  if (!raw) return null;
  const value = String(raw)
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .replace(/\s+/g, '');
  return value || null;
}

function normalizeIssn(raw) {
  if (!raw) return null;
  return String(raw).trim().toUpperCase();
}

function normalizeDate(raw) {
  if (!raw) return null;
  const value = String(raw).trim();
  const match = value.match(/^\d{4}-\d{2}-\d{2}$/);
  return match ? value : null;
}

function trimTo(value, maxLength) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url) {
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is unavailable. Use Node.js v18+ to run this script.');
  }

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    let response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json'
        }
      });
    } catch (networkError) {
      if (attempt >= MAX_RETRIES) throw networkError;
      const pause = 400 * Math.pow(2, attempt);
      console.warn(`[OpenAlex] network error, retrying in ${pause}ms: ${networkError.message}`);
      await delay(pause);
      continue;
    }

    if (response.ok) {
      return response.json();
    }

    const retriable = response.status === 429 || response.status >= 500;
    if (!retriable || attempt >= MAX_RETRIES) {
      const bodyText = await response.text();
      throw new Error(`[OpenAlex] request failed ${response.status}: ${bodyText.slice(0, 500)}`);
    }

    const pause = 500 * Math.pow(2, attempt);
    console.warn(`[OpenAlex] status ${response.status}, retrying in ${pause}ms`);
    await delay(pause);
  }

  throw new Error('OpenAlex retries exhausted');
}

function buildWorksUrl({ apiKey, filter, cursor, perPage, mailto }) {
  const params = new URLSearchParams();
  params.set('filter', filter);
  params.set('per_page', String(perPage));
  params.set('cursor', cursor);
  params.set(
    'select',
    'id,doi,display_name,title,publication_date,is_retracted,primary_location,authorships,topics,referenced_works'
  );

  if (mailto) params.set('mailto', mailto);
  if (apiKey) params.set('api_key', apiKey);

  return `${OPENALEX_BASE_URL}?${params.toString()}`;
}

function parsePublisherName(source) {
  if (!source) return null;
  return trimTo(source.host_organization_name || source.display_name, 255);
}

function parseVenueRecord(work) {
  const source = work.primary_location?.source;
  if (!source || !source.display_name) return null;

  const issnCandidate = Array.isArray(source.issn) && source.issn.length > 0 ? source.issn[0] : source.issn_l;
  const venueType = trimTo(source.type || 'unknown', 100) || 'unknown';

  return {
    name: trimTo(source.display_name, 255),
    type: venueType,
    issn: normalizeIssn(issnCandidate),
    publisherName: parsePublisherName(source)
  };
}

function buildAuthorKey(authorship, workId, positionIndex, authorName, orcid) {
  if (orcid) {
    return `orcid:${orcid}`;
  }

  const openalexAuthorId = trimTo(authorship?.author?.id, 120);
  if (openalexAuthorId) {
    return `openalex:${openalexAuthorId}`;
  }

  // If ORCID and OpenAlex author id are both missing, keep the row unique per authorship.
  return `local:${trimTo(workId, 120)}:${positionIndex + 1}:${normalizeText(authorName)}`;
}

function transformWorks(works) {
  const publishers = new Map();
  const venues = new Map();
  const authors = new Map();
  const institutes = new Map();
  const domains = new Map();
  const fields = new Map();
  const topics = new Map();
  const papers = [];
  const paperAuthors = [];
  const paperTopics = [];
  const citationCandidates = [];
  const workIdToPaperKey = new Map();

  for (const work of works) {
    const publicationDate = normalizeDate(work.publication_date);
    const venueRecord = parseVenueRecord(work);
    const title = trimTo(work.display_name || work.title, 500);

    if (!publicationDate || !venueRecord || !title) {
      continue;
    }

    const publisherName = venueRecord.publisherName;
    if (publisherName) {
      const publisherKey = normalizeText(publisherName);
      if (publisherKey) {
        publishers.set(publisherKey, { name: publisherName, img_url: null });
      }
    }

    const venueKey = venueRecord.issn
      ? `issn:${venueRecord.issn}`
      : `name:${normalizeText(venueRecord.name)}|type:${normalizeText(venueRecord.type)}|publisher:${normalizeText(publisherName)}`;

    venues.set(venueKey, {
      ...venueRecord,
      venueKey
    });

    const doi = normalizeDoi(work.doi || work.ids?.doi);
    const paperKey = doi
      ? `doi:${doi}`
      : `title:${normalizeText(title)}|date:${publicationDate}|venue:${venueKey}`;

    workIdToPaperKey.set(work.id, paperKey);

    papers.push({
      paperKey,
      openalexId: trimTo(work.id, 120),
      title,
      publication_date: publicationDate,
      pdf_url: trimTo(work.primary_location?.pdf_url || null, 500),
      doi,
      is_retracted: Boolean(work.is_retracted),
      github_repo: null,
      venueKey
    });

    const authorships = Array.isArray(work.authorships) ? work.authorships : [];
    for (let index = 0; index < authorships.length; index += 1) {
      const authorship = authorships[index];
      const authorName = trimTo(authorship?.author?.display_name || authorship?.raw_author_name, 255);
      if (!authorName) continue;

      const orcid = normalizeOrcid(authorship?.author?.orcid);
      const authorKey = buildAuthorKey(authorship, work.id, index, authorName, orcid);

      authors.set(authorKey, {
        name: authorName,
        orc_id: trimTo(orcid, 50)
      });

      paperAuthors.push({
        paperKey,
        authorKey,
        position: index + 1
      });

      const institutions = Array.isArray(authorship?.institutions) ? authorship.institutions : [];
      for (const institution of institutions) {
        const instName = trimTo(institution?.display_name, 255);
        if (!instName) continue;

        const country = trimTo(institution?.country_code, 100);
        const instituteKey = `name:${normalizeText(instName)}|country:${normalizeText(country)}`;
        if (!institutes.has(instituteKey)) {
          institutes.set(instituteKey, {
            name: instName,
            country,
            website_url: null,
            img_url: null
          });
        }
      }
    }

    const topicEntries = Array.isArray(work.topics) ? work.topics : [];
    for (const entry of topicEntries) {
      const domainName = trimTo(entry?.domain?.display_name, 255);
      const fieldName = trimTo(entry?.field?.display_name, 255);
      const topicName = trimTo(entry?.display_name, 255);

      if (!domainName || !fieldName || !topicName) continue;

      const domainKey = normalizeText(domainName);
      domains.set(domainKey, { name: domainName });

      const fieldKey = `domain:${domainKey}|field:${normalizeText(fieldName)}`;
      fields.set(fieldKey, {
        domainKey,
        name: fieldName
      });

      const topicKey = `field:${fieldKey}|topic:${normalizeText(topicName)}`;
      topics.set(topicKey, {
        fieldKey,
        name: topicName
      });

      paperTopics.push({ paperKey, topicKey });
    }

    const references = Array.isArray(work.referenced_works) ? work.referenced_works : [];
    for (const refWorkId of references) {
      citationCandidates.push({ citingOpenAlexId: work.id, citedOpenAlexId: refWorkId });
    }
  }

  return {
    publishers,
    venues,
    authors,
    institutes,
    domains,
    fields,
    topics,
    papers,
    paperAuthors,
    paperTopics,
    citationCandidates,
    workIdToPaperKey
  };
}

async function ensureTablesExist(client) {
  const sql = `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
  `;

  const result = await client.query(sql, [REQUIRED_TABLES]);
  const existing = new Set(result.rows.map((row) => row.table_name));
  const missing = REQUIRED_TABLES.filter((name) => !existing.has(name));

  if (missing.length > 0) {
    throw new Error(`Missing required tables: ${missing.join(', ')}`);
  }
}

async function loadExistingMaps(client) {
  const maps = {
    publisherByName: new Map(),
    venueByIssn: new Map(),
    venueByComposite: new Map(),
    authorByOrcid: new Map(),
    instituteByComposite: new Map(),
    domainByName: new Map(),
    fieldByComposite: new Map(),
    topicByComposite: new Map(),
    paperByDoi: new Map(),
    paperByComposite: new Map()
  };

  const [
    publisherRes,
    venueRes,
    authorRes,
    instituteRes,
    domainRes,
    fieldRes,
    topicRes,
    paperRes
  ] = await Promise.all([
    client.query('SELECT id, name FROM publisher'),
    client.query('SELECT id, name, type, issn, publisher_id FROM venue'),
    client.query('SELECT id, name, orc_id FROM author'),
    client.query('SELECT id, name, country FROM institute'),
    client.query('SELECT id, name FROM domain'),
    client.query('SELECT id, domain_id, name FROM field'),
    client.query('SELECT id, field_id, name FROM topic'),
    client.query('SELECT id, title, publication_date, venue_id, doi FROM paper')
  ]);

  for (const row of publisherRes.rows) {
    maps.publisherByName.set(normalizeText(row.name), row.id);
  }

  for (const row of venueRes.rows) {
    if (row.issn) maps.venueByIssn.set(normalizeIssn(row.issn), row.id);
    const composite = `name:${normalizeText(row.name)}|type:${normalizeText(row.type)}|publisher:${row.publisher_id}`;
    maps.venueByComposite.set(composite, row.id);
  }

  for (const row of authorRes.rows) {
    if (row.orc_id) maps.authorByOrcid.set(normalizeOrcid(row.orc_id), row.id);
  }

  for (const row of instituteRes.rows) {
    const key = `name:${normalizeText(row.name)}|country:${normalizeText(row.country)}`;
    maps.instituteByComposite.set(key, row.id);
  }

  for (const row of domainRes.rows) {
    maps.domainByName.set(normalizeText(row.name), row.id);
  }

  for (const row of fieldRes.rows) {
    const key = `domain:${row.domain_id}|field:${normalizeText(row.name)}`;
    maps.fieldByComposite.set(key, row.id);
  }

  for (const row of topicRes.rows) {
    const key = `field:${row.field_id}|topic:${normalizeText(row.name)}`;
    maps.topicByComposite.set(key, row.id);
  }

  for (const row of paperRes.rows) {
    if (row.doi) {
      maps.paperByDoi.set(normalizeDoi(row.doi), row.id);
      continue;
    }

    const key = `title:${normalizeText(row.title)}|date:${normalizeDate(row.publication_date)}|venue:${row.venue_id}`;
    maps.paperByComposite.set(key, row.id);
  }

  return maps;
}

async function upsertPublisher(client, maps, publisher) {
  const key = normalizeText(publisher.name);
  if (maps.publisherByName.has(key)) return maps.publisherByName.get(key);

  const result = await client.query(
    'INSERT INTO publisher (name, img_url) VALUES ($1, $2) RETURNING id',
    [publisher.name, publisher.img_url]
  );
  const id = result.rows[0].id;
  maps.publisherByName.set(key, id);
  return id;
}

async function upsertVenue(client, maps, venue, publisherId) {
  const compositeKey = `name:${normalizeText(venue.name)}|type:${normalizeText(venue.type)}|publisher:${publisherId}`;

  if (venue.issn && maps.venueByIssn.has(venue.issn)) {
    return maps.venueByIssn.get(venue.issn);
  }

  if (maps.venueByComposite.has(compositeKey)) {
    return maps.venueByComposite.get(compositeKey);
  }

  let result;
  if (venue.issn) {
    result = await client.query(
      `
      INSERT INTO venue (name, type, issn, publisher_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (issn) DO UPDATE
      SET name = EXCLUDED.name,
          type = EXCLUDED.type,
          publisher_id = EXCLUDED.publisher_id
      RETURNING id
      `,
      [venue.name, venue.type, venue.issn, publisherId]
    );
  } else {
    result = await client.query(
      'INSERT INTO venue (name, type, issn, publisher_id) VALUES ($1, $2, $3, $4) RETURNING id',
      [venue.name, venue.type, null, publisherId]
    );
  }

  const id = result.rows[0].id;
  if (venue.issn) maps.venueByIssn.set(venue.issn, id);
  maps.venueByComposite.set(compositeKey, id);
  return id;
}

async function upsertAuthor(client, maps, author) {
  const byOrcidKey = author.orc_id ? normalizeOrcid(author.orc_id) : null;

  if (byOrcidKey && maps.authorByOrcid.has(byOrcidKey)) {
    return maps.authorByOrcid.get(byOrcidKey);
  }

  let result;
  if (byOrcidKey) {
    result = await client.query(
      `
      INSERT INTO author (name, orc_id)
      VALUES ($1, $2)
      ON CONFLICT (orc_id) DO UPDATE
      SET name = EXCLUDED.name
      RETURNING id
      `,
      [author.name, author.orc_id]
    );
  } else {
    result = await client.query(
      'INSERT INTO author (name, orc_id) VALUES ($1, $2) RETURNING id',
      [author.name, null]
    );
  }

  const id = result.rows[0].id;
  if (byOrcidKey) maps.authorByOrcid.set(byOrcidKey, id);
  return id;
}

async function upsertInstitute(client, maps, institute) {
  const key = `name:${normalizeText(institute.name)}|country:${normalizeText(institute.country)}`;
  if (maps.instituteByComposite.has(key)) {
    return maps.instituteByComposite.get(key);
  }

  const result = await client.query(
    'INSERT INTO institute (name, country, website_url, img_url) VALUES ($1, $2, $3, $4) RETURNING id',
    [institute.name, institute.country, institute.website_url, institute.img_url]
  );
  const id = result.rows[0].id;
  maps.instituteByComposite.set(key, id);
  return id;
}

async function upsertDomain(client, maps, domain) {
  const key = normalizeText(domain.name);
  if (maps.domainByName.has(key)) return maps.domainByName.get(key);

  const result = await client.query(
    `
    INSERT INTO domain (name)
    VALUES ($1)
    ON CONFLICT (name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id
    `,
    [domain.name]
  );

  const id = result.rows[0].id;
  maps.domainByName.set(key, id);
  return id;
}

async function upsertField(client, maps, field, domainId) {
  const key = `domain:${domainId}|field:${normalizeText(field.name)}`;
  if (maps.fieldByComposite.has(key)) return maps.fieldByComposite.get(key);

  const result = await client.query(
    `
    INSERT INTO field (domain_id, name)
    VALUES ($1, $2)
    ON CONFLICT (domain_id, name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id
    `,
    [domainId, field.name]
  );

  const id = result.rows[0].id;
  maps.fieldByComposite.set(key, id);
  return id;
}

async function upsertTopic(client, maps, topic, fieldId) {
  const key = `field:${fieldId}|topic:${normalizeText(topic.name)}`;
  if (maps.topicByComposite.has(key)) return maps.topicByComposite.get(key);

  const result = await client.query(
    `
    INSERT INTO topic (field_id, name)
    VALUES ($1, $2)
    ON CONFLICT (field_id, name) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING id
    `,
    [fieldId, topic.name]
  );

  const id = result.rows[0].id;
  maps.topicByComposite.set(key, id);
  return id;
}

async function upsertPaper(client, maps, paper, venueId) {
  if (paper.doi && maps.paperByDoi.has(paper.doi)) {
    return maps.paperByDoi.get(paper.doi);
  }

  const compositeKey = `title:${normalizeText(paper.title)}|date:${paper.publication_date}|venue:${venueId}`;
  if (!paper.doi && maps.paperByComposite.has(compositeKey)) {
    return maps.paperByComposite.get(compositeKey);
  }

  let result;
  if (paper.doi) {
    result = await client.query(
      `
      INSERT INTO paper (title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (doi) DO UPDATE
      SET title = EXCLUDED.title,
          publication_date = EXCLUDED.publication_date,
          pdf_url = EXCLUDED.pdf_url,
          is_retracted = EXCLUDED.is_retracted,
          github_repo = EXCLUDED.github_repo,
          venue_id = EXCLUDED.venue_id
      RETURNING id
      `,
      [
        paper.title,
        paper.publication_date,
        paper.pdf_url,
        paper.doi,
        paper.is_retracted,
        paper.github_repo,
        venueId
      ]
    );
  } else {
    result = await client.query(
      `
      INSERT INTO paper (title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [
        paper.title,
        paper.publication_date,
        paper.pdf_url,
        null,
        paper.is_retracted,
        paper.github_repo,
        venueId
      ]
    );
  }

  const id = result.rows[0].id;
  if (paper.doi) maps.paperByDoi.set(paper.doi, id);
  else maps.paperByComposite.set(compositeKey, id);
  return id;
}

async function insertRowsInBatches(client, rows, batchSize, buildQuery) {
  if (rows.length === 0) return;

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { text, values } = buildQuery(chunk);

    await client.query('BEGIN');
    try {
      await client.query(text, values);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
}

function buildInsertPaperAuthorQuery(rows) {
  const values = [];
  const placeholders = rows.map((row, idx) => {
    const base = idx * 3;
    values.push(row.paper_id, row.author_id, row.position);
    return `($${base + 1}, $${base + 2}, $${base + 3})`;
  });

  return {
    text: `
      INSERT INTO paper_author (paper_id, author_id, position)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (paper_id, author_id) DO UPDATE
      SET position = EXCLUDED.position
    `,
    values
  };
}

function buildInsertPaperTopicQuery(rows) {
  const values = [];
  const placeholders = rows.map((row, idx) => {
    const base = idx * 2;
    values.push(row.paper_id, row.topic_id);
    return `($${base + 1}, $${base + 2})`;
  });

  return {
    text: `
      INSERT INTO paper_topic (paper_id, topic_id)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (paper_id, topic_id) DO NOTHING
    `,
    values
  };
}

function buildInsertCitationQuery(rows) {
  const values = [];
  const placeholders = rows.map((row, idx) => {
    const base = idx * 2;
    values.push(row.citing_id, row.cited_id);
    return `($${base + 1}, $${base + 2})`;
  });

  return {
    text: `
      INSERT INTO citation (citing_id, cited_id)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (citing_id, cited_id) DO NOTHING
    `,
    values
  };
}

function dedupePaperAuthorRows(rows) {
  const byKey = new Map();
  for (const row of rows) {
    const key = `${row.paper_id}|${row.author_id}`;
    const existing = byKey.get(key);
    if (!existing || row.position < existing.position) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

function dedupePairRows(rows, keyBuilder) {
  const byKey = new Map();
  for (const row of rows) {
    byKey.set(keyBuilder(row), row);
  }
  return [...byKey.values()];
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  const config = {
    apiKey: process.env.OPENALEX_API_KEY || null,
    mailto: process.env.OPENALEX_EMAIL || null,
    filter: process.env.OPENALEX_FILTER || DEFAULT_FILTER,
    cursorStart: process.env.OPENALEX_CURSOR_START || '*',
    maxWorks: parseEnvInt('OPENALEX_MAX_WORKS', DEFAULT_MAX_WORKS),
    perPage: Math.min(parseEnvInt('OPENALEX_PER_PAGE', DEFAULT_PER_PAGE), 100),
    dbBatchSize: parseEnvInt('OPENALEX_DB_BATCH', DEFAULT_BATCH_SIZE),
    includeCitations: asBool(process.env.OPENALEX_INCLUDE_CITATIONS, true),
    dryRun: asBool(process.env.OPENALEX_DRY_RUN, true),
    allowWrite: asBool(process.env.OPENALEX_ALLOW_WRITE, false)
  };

  if (!config.allowWrite) {
    config.dryRun = true;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  console.log('--- OpenAlex Seed Configuration ---');
  console.log(`filter=${config.filter}`);
  console.log(`maxWorks=${config.maxWorks}`);
  console.log(`perPage=${config.perPage}`);
  console.log(`dbBatchSize=${config.dbBatchSize}`);
  console.log(`cursorStart=${config.cursorStart}`);
  console.log(`includeCitations=${config.includeCitations}`);
  console.log(`dryRun=${config.dryRun}`);
  console.log(`allowWrite=${config.allowWrite}`);
  console.log(`apiKeyProvided=${Boolean(config.apiKey)}`);

  const db = DB_Connection.getInstance();
  const client = await db.pool.connect();

  try {
    await ensureTablesExist(client);

    const works = [];
    let cursor = config.cursorStart;
    let lastNextCursor = null;

    while (works.length < config.maxWorks) {
      const url = buildWorksUrl({
        apiKey: config.apiKey,
        filter: config.filter,
        cursor,
        perPage: config.perPage,
        mailto: config.mailto
      });

      const payload = await fetchJsonWithRetry(url);
      const pageResults = Array.isArray(payload.results) ? payload.results : [];

      if (pageResults.length === 0) break;

      for (const item of pageResults) {
        works.push(item);
        if (works.length >= config.maxWorks) break;
      }

      const nextCursor = payload?.meta?.next_cursor;
      const costUsd = payload?.meta?.cost_usd;
      console.log(`[OpenAlex] fetched=${works.length} nextCursor=${Boolean(nextCursor)} costUsd=${costUsd}`);
      lastNextCursor = nextCursor || null;

      if (!nextCursor) break;
      cursor = nextCursor;
    }

    if (works.length === 0) {
      console.log('No works returned by OpenAlex for the current filter.');
      return;
    }

    console.log(`[Transform] processing ${works.length} works`);
    const transformed = transformWorks(works);

    console.log('--- Transformed Dataset ---');
    console.log(`publishers=${transformed.publishers.size}`);
    console.log(`venues=${transformed.venues.size}`);
    console.log(`authors=${transformed.authors.size}`);
    console.log(`institutes=${transformed.institutes.size}`);
    console.log(`domains=${transformed.domains.size}`);
    console.log(`fields=${transformed.fields.size}`);
    console.log(`topics=${transformed.topics.size}`);
    console.log(`papers=${transformed.papers.length}`);
    console.log(`paperAuthors=${transformed.paperAuthors.length}`);
    console.log(`paperTopics=${transformed.paperTopics.length}`);
    console.log(`citationCandidates=${transformed.citationCandidates.length}`);

    if (config.dryRun) {
      console.log(`resumeCursor=${lastNextCursor || 'null'}`);
      console.log('Dry run complete. No DB changes were made.');
      return;
    }

    const maps = await loadExistingMaps(client);

    const publisherKeyToId = new Map();
    for (const [publisherKey, publisher] of transformed.publishers.entries()) {
      const publisherId = await upsertPublisher(client, maps, publisher);
      publisherKeyToId.set(publisherKey, publisherId);
    }

    const venueKeyToId = new Map();
    for (const [venueKey, venue] of transformed.venues.entries()) {
      const publisherId = venue.publisherName
        ? publisherKeyToId.get(normalizeText(venue.publisherName)) || null
        : null;

      if (!publisherId) {
        // Fallback to unknown publisher bucket if source host organization is absent.
        const fallbackPublisherName = 'Unknown Publisher';
        const fallbackPublisherId = await upsertPublisher(client, maps, {
          name: fallbackPublisherName,
          img_url: null
        });
        publisherKeyToId.set(normalizeText(fallbackPublisherName), fallbackPublisherId);

        const venueId = await upsertVenue(client, maps, venue, fallbackPublisherId);
        venueKeyToId.set(venueKey, venueId);
        continue;
      }

      const venueId = await upsertVenue(client, maps, venue, publisherId);
      venueKeyToId.set(venueKey, venueId);
    }

    const authorKeyToId = new Map();
    for (const [authorKey, author] of transformed.authors.entries()) {
      const authorId = await upsertAuthor(client, maps, author);
      authorKeyToId.set(authorKey, authorId);
    }

    for (const institute of transformed.institutes.values()) {
      await upsertInstitute(client, maps, institute);
    }

    const domainKeyToId = new Map();
    for (const [domainKey, domain] of transformed.domains.entries()) {
      const domainId = await upsertDomain(client, maps, domain);
      domainKeyToId.set(domainKey, domainId);
    }

    const fieldKeyToId = new Map();
    for (const [fieldKey, field] of transformed.fields.entries()) {
      const domainId = domainKeyToId.get(field.domainKey);
      if (!domainId) continue;
      const fieldId = await upsertField(client, maps, field, domainId);
      fieldKeyToId.set(fieldKey, fieldId);
    }

    const topicKeyToId = new Map();
    for (const [topicKey, topic] of transformed.topics.entries()) {
      const fieldId = fieldKeyToId.get(topic.fieldKey);
      if (!fieldId) continue;
      const topicId = await upsertTopic(client, maps, topic, fieldId);
      topicKeyToId.set(topicKey, topicId);
    }

    const paperKeyToId = new Map();
    for (const paper of transformed.papers) {
      const venueId = venueKeyToId.get(paper.venueKey);
      if (!venueId) continue;

      const paperId = await upsertPaper(client, maps, paper, venueId);
      paperKeyToId.set(paper.paperKey, paperId);
    }

    const paperAuthorRows = [];
    for (const row of transformed.paperAuthors) {
      const paperId = paperKeyToId.get(row.paperKey);
      const authorId = authorKeyToId.get(row.authorKey);
      if (!paperId || !authorId) continue;
      paperAuthorRows.push({
        paper_id: paperId,
        author_id: authorId,
        position: row.position
      });
    }

    const paperTopicRows = [];
    for (const row of transformed.paperTopics) {
      const paperId = paperKeyToId.get(row.paperKey);
      const topicId = topicKeyToId.get(row.topicKey);
      if (!paperId || !topicId) continue;
      paperTopicRows.push({
        paper_id: paperId,
        topic_id: topicId
      });
    }

    const citationRows = [];
    if (config.includeCitations) {
      for (const edge of transformed.citationCandidates) {
        const citingPaperKey = transformed.workIdToPaperKey.get(edge.citingOpenAlexId);
        const citedPaperKey = transformed.workIdToPaperKey.get(edge.citedOpenAlexId);

        if (!citingPaperKey || !citedPaperKey) continue;

        const citingId = paperKeyToId.get(citingPaperKey);
        const citedId = paperKeyToId.get(citedPaperKey);
        if (!citingId || !citedId || citingId === citedId) continue;

        citationRows.push({
          citing_id: citingId,
          cited_id: citedId
        });
      }
    }

    const dedupedPaperAuthorRows = dedupePaperAuthorRows(paperAuthorRows);
    const dedupedPaperTopicRows = dedupePairRows(paperTopicRows, (row) => `${row.paper_id}|${row.topic_id}`);
    const dedupedCitationRows = dedupePairRows(citationRows, (row) => `${row.citing_id}|${row.cited_id}`);

    await insertRowsInBatches(client, dedupedPaperAuthorRows, config.dbBatchSize, buildInsertPaperAuthorQuery);
    await insertRowsInBatches(client, dedupedPaperTopicRows, config.dbBatchSize, buildInsertPaperTopicQuery);
    await insertRowsInBatches(client, dedupedCitationRows, config.dbBatchSize, buildInsertCitationQuery);

    console.log('--- Seed Completed ---');
    console.log(`worksFetched=${works.length}`);
    console.log(`papersInsertedOrMatched=${paperKeyToId.size}`);
    console.log(`paperAuthorRowsProcessed=${dedupedPaperAuthorRows.length}`);
    console.log(`paperTopicRowsProcessed=${dedupedPaperTopicRows.length}`);
    console.log(`citationRowsProcessed=${dedupedCitationRows.length}`);
    console.log(`resumeCursor=${lastNextCursor || 'null'}`);
  } finally {
    client.release();
    await db.pool.end();
  }
}

main()
  .then(() => {
    console.log('OpenAlex seed finished.');
  })
  .catch((error) => {
    console.error('OpenAlex seed failed:', error.message);
    process.exitCode = 1;
  });
