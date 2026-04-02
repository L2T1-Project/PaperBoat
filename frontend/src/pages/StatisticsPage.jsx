import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import EmptyState from "../components/common/EmptyState";

function StatCard({ label, value, accent }) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm backdrop-blur">
      <div className={`absolute right-0 top-0 h-16 w-16 translate-x-4 -translate-y-4 rounded-full ${accent} opacity-25`} />
      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
    </article>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </div>
  );
}

export default function StatisticsPage() {
  const [summary, setSummary] = useState(null);
  const [momentum, setMomentum] = useState([]);
  const [mostCitedPapers, setMostCitedPapers] = useState([]);
  const [topics, setTopics] = useState([]);
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [selectedTopicMeta, setSelectedTopicMeta] = useState(null);
  const [topAuthorsInTopic, setTopAuthorsInTopic] = useState([]);
  const [windowDays, setWindowDays] = useState(90);
  const [loading, setLoading] = useState(true);
  const [authorsLoading, setAuthorsLoading] = useState(false);
  const [error, setError] = useState("");

  const loadData = async (days) => {
    setLoading(true);
    setError("");
    try {
      const [summaryRes, momentumRes, topCitedRes, topicsRes] = await Promise.all([
        api.get("/topics/stats/summary"),
        api.get("/topics/stats/momentum", { params: { limit: 20, windowDays: days } }),
        api.get("/topics/stats/top-cited-papers", { params: { limit: 10 } }),
        api.get("/topics"),
      ]);

      setSummary(summaryRes.data?.data || null);
      setMomentum(momentumRes.data?.data || []);
      setMostCitedPapers(topCitedRes.data?.data || []);

      const allTopics = topicsRes.data || [];
      setTopics(allTopics);
      if (!selectedTopicId && allTopics.length) {
        setSelectedTopicId(String(allTopics[0].id));
      }
    } catch (requestError) {
      console.error("Failed to load statistics:", requestError);
      setError("Failed to load statistics.");
      setSummary(null);
      setMomentum([]);
      setMostCitedPapers([]);
      setTopics([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(windowDays);
  }, [windowDays]);

  useEffect(() => {
    const loadTopAuthors = async () => {
      if (!selectedTopicId) {
        setTopAuthorsInTopic([]);
        setSelectedTopicMeta(null);
        return;
      }

      setAuthorsLoading(true);
      try {
        const res = await api.get(`/topics/stats/topics/${selectedTopicId}/top-authors`, {
          params: { limit: 10 },
        });
        setTopAuthorsInTopic(res.data?.data || []);
        setSelectedTopicMeta(res.data?.meta || null);
      } catch (requestError) {
        console.error("Failed to load top authors for topic:", requestError);
        setTopAuthorsInTopic([]);
        setSelectedTopicMeta(null);
      } finally {
        setAuthorsLoading(false);
      }
    };

    loadTopAuthors();
  }, [selectedTopicId]);

  const topThree = useMemo(() => momentum.slice(0, 3), [momentum]);

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff3df_0%,_#edf8ff_40%,_#f8fafc_100%)] px-4 py-8 sm:px-6 lg:px-8"
      style={{ fontFamily: "'Space Grotesk', 'Trebuchet MS', sans-serif" }}
    >
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="absolute -right-8 -top-10 h-36 w-36 rounded-full bg-amber-300/30 blur-2xl" />
          <div className="absolute -left-8 -bottom-10 h-36 w-36 rounded-full bg-cyan-300/30 blur-2xl" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Analytics Workspace</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Research Intelligence Board</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Explore macro trends, top-performing papers, and leading authors in each topic using citation-weighted analytics.
          </p>
        </section>

        {error ? <section className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</section> : null}

        {loading ? (
          <p className="text-sm text-slate-500">Loading statistics...</p>
        ) : (
          <>
            {summary ? (
              <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <StatCard label="Total Papers" value={summary.total_papers || 0} accent="bg-amber-300" />
                <StatCard label="Total Authors" value={summary.total_authors || 0} accent="bg-cyan-300" />
                <StatCard label="Total Venues" value={summary.total_venues || 0} accent="bg-emerald-300" />
                <StatCard label="Researchers" value={summary.total_researchers || 0} accent="bg-fuchsia-300" />
                <StatCard label="Citations" value={summary.total_citations || 0} accent="bg-rose-300" />
              </section>
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle
                  title="Topic Momentum"
                  subtitle="Hybrid score = 0.7 × citation growth + 0.3 × paper growth"
                />
                <select
                  value={windowDays}
                  onChange={(e) => setWindowDays(Number(e.target.value))}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value={90}>Last 90 days</option>
                  <option value={180}>Last 180 days</option>
                  <option value={365}>Last 365 days</option>
                </select>
              </div>

              {momentum.length === 0 ? (
                <EmptyState
                  icon="📉"
                  title="No momentum data"
                  body="Topic activity is not available for the selected window."
                  className="py-10"
                />
              ) : (
                <>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {topThree.map((item, idx) => (
                      <article key={item.topic_id} className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rank {idx + 1}</p>
                        <p className="mt-1 text-base font-semibold text-slate-900">{item.topic_name}</p>
                        <p className="mt-1 text-xs text-slate-600">{item.field_name} / {item.domain_name}</p>
                        <p className="mt-2 text-lg font-bold text-slate-900">{item.momentum_score}</p>
                      </article>
                    ))}
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Topic</th>
                          <th className="px-3 py-2">Momentum</th>
                          <th className="px-3 py-2">Citation Delta</th>
                          <th className="px-3 py-2">Paper Delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {momentum.map((item) => (
                          <tr key={item.topic_id}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-slate-900">{item.topic_name}</p>
                              <p className="text-xs text-slate-500">{item.field_name} / {item.domain_name}</p>
                            </td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{item.momentum_score}</td>
                            <td className="px-3 py-2 text-slate-700">{item.citation_delta}</td>
                            <td className="px-3 py-2 text-slate-700">{item.paper_delta}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
                <SectionTitle
                  title="Most Cited Papers"
                  subtitle="Top papers ranked by total incoming citations"
                />

                {mostCitedPapers.length === 0 ? (
                  <EmptyState
                    icon="◇"
                    title="No citation-ranked papers"
                    body="Once citation links are available, top papers will appear here."
                    className="py-8"
                  />
                ) : (
                  <div className="mt-4 space-y-3">
                    {mostCitedPapers.map((paper, index) => (
                      <div key={paper.paper_id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-slate-500">#{index + 1}</p>
                            <Link to={`/papers/${paper.paper_id}`} className="mt-1 block text-sm font-semibold text-slate-900 hover:underline">
                              {paper.title}
                            </Link>
                            <p className="mt-1 text-xs text-slate-600">{paper.venue_name || "Unknown venue"}</p>
                          </div>
                          <span className="rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                            {paper.citation_count} cites
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </article>

              <article className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <SectionTitle
                    title="Top Authors by Topic"
                    subtitle="Ranked by citation count within the selected topic"
                  />
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Topic
                    <select
                      value={selectedTopicId}
                      onChange={(event) => setSelectedTopicId(event.target.value)}
                      className="ml-2 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm font-normal text-slate-700"
                    >
                      {topics.map((topic) => (
                        <option key={topic.id} value={topic.id}>
                          {topic.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedTopicMeta ? (
                  <p className="mt-2 text-xs text-slate-600">
                    {selectedTopicMeta.topic_name} in {selectedTopicMeta.field_name} / {selectedTopicMeta.domain_name}
                  </p>
                ) : null}

                {authorsLoading ? <p className="mt-4 text-sm text-slate-500">Loading top authors...</p> : null}

                {!authorsLoading && topAuthorsInTopic.length === 0 ? (
                  <EmptyState
                    icon="△"
                    title="No author citation data in this topic"
                    body="Try another topic or wait for additional paper-citation mappings."
                    className="py-8"
                  />
                ) : null}

                {!!topAuthorsInTopic.length ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Author</th>
                          <th className="px-3 py-2">Topic Papers</th>
                          <th className="px-3 py-2">Topic Citations</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {topAuthorsInTopic.map((author) => (
                          <tr key={author.author_id}>
                            <td className="px-3 py-2">
                              <Link to={`/authors/${author.author_id}`} className="font-semibold text-slate-900 hover:underline">
                                {author.author_name}
                              </Link>
                            </td>
                            <td className="px-3 py-2 text-slate-700">{author.paper_count_in_topic}</td>
                            <td className="px-3 py-2 font-semibold text-slate-900">{author.citation_count_in_topic}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
