const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const DB_Connection = require('../database/db');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = i + 1 < sql.length ? sql[i + 1] : '';

    if (inLineComment) {
      current += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (ch === '-' && next === '-') {
        current += ch + next;
        i += 1;
        inLineComment = true;
        continue;
      }
      if (ch === '/' && next === '*') {
        current += ch + next;
        i += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (ch === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (ch === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += ch;
      continue;
    }

    if (ch === ';' && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) statements.push(trimmed);
      current = '';
      continue;
    }

    current += ch;
  }

  const finalTrimmed = current.trim();
  if (finalTrimmed.length > 0) statements.push(finalTrimmed);

  return statements;
}

function statementTitle(statement, index) {
  const lines = statement
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (line.startsWith('--')) {
      return `Stmt ${index}: ${line.replace(/^--\s*/, '')}`;
    }
    if (!line.startsWith('--')) {
      const normalized = line.replace(/\s+/g, ' ');
      return `Stmt ${index}: ${normalized.slice(0, 90)}${normalized.length > 90 ? '...' : ''}`;
    }
  }

  return `Stmt ${index}`;
}

async function main() {
  const sqlFileArg = process.argv[2] || 'src/database/query_analysis.sql';
  const outFileArg = process.argv[3] || 'src/database/probe_results.txt';

  const sqlFilePath = path.resolve(process.cwd(), sqlFileArg);
  const outFilePath = path.resolve(process.cwd(), outFileArg);

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in backend/.env');
  }

  if (!fs.existsSync(sqlFilePath)) {
    throw new Error(`SQL file not found: ${sqlFilePath}`);
  }

  const sqlText = fs.readFileSync(sqlFilePath, 'utf8');
  const statements = splitSqlStatements(sqlText);

  const db = DB_Connection.getInstance();
  const client = await db.pool.connect();

  const output = [];
  output.push(`Query Analysis Run: ${new Date().toISOString()}`);
  output.push(`SQL File: ${sqlFilePath}`);
  output.push(`Total Statements: ${statements.length}`);
  output.push('');

  try {
    for (let i = 0; i < statements.length; i += 1) {
      const stmt = statements[i];
      const title = statementTitle(stmt, i + 1);
      const start = process.hrtime.bigint();

      output.push('='.repeat(80));
      output.push(title);
      output.push('-'.repeat(80));

      try {
        const result = await client.query(stmt);
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;

        output.push(`Elapsed (client): ${elapsedMs.toFixed(3)} ms`);
        output.push(`rowCount: ${result.rowCount ?? 0}`);

        if (result.rows && result.rows.length > 0) {
          const first = result.rows[0];
          if (Object.prototype.hasOwnProperty.call(first, 'QUERY PLAN')) {
            for (const row of result.rows) {
              output.push(row['QUERY PLAN']);
            }
          } else {
            const preview = result.rows.slice(0, 5);
            output.push('Sample rows:');
            output.push(JSON.stringify(preview, null, 2));
          }
        }
      } catch (err) {
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        output.push(`Elapsed (client): ${elapsedMs.toFixed(3)} ms`);
        output.push(`ERROR: ${err.message}`);
      }

      output.push('');
    }

    fs.mkdirSync(path.dirname(outFilePath), { recursive: true });
    fs.writeFileSync(outFilePath, `${output.join('\n')}\n`, 'utf8');

    console.log(`Probe run complete. Output written to: ${outFilePath}`);
  } finally {
    client.release();
    await db.pool.end();
  }
}

main().catch((err) => {
  console.error(`Probe run failed: ${err.message}`);
  process.exitCode = 1;
});