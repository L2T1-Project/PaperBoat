import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-gray-900">{Number(value).toLocaleString()}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

const TABS = ['Papers', 'Authors'];
const PER_PAGE = 20;

export default function VenueProfilePage() {
  const { id }                 = useParams();
  const [venue, setVenue]      = useState(null);
  const [stats, setStats]      = useState(null);
  const [papers, setPapers]    = useState([]);
  const [authors, setAuthors]  = useState([]);
  const [activeTab, setTab]    = useState('Papers');
  const [loading, setLoading]  = useState(true);
  const [papersLoading, setPL] = useState(false);
  const [page, setPage]        = useState(1);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/venues/${id}`),
      api.get(`/venues/${id}/stats`),
      api.get(`/venues/${id}/authors`),
    ])
      .then(([vRes, sRes, aRes]) => {
        setVenue(vRes.data.data);
        setStats(sRes.data.data);
        setAuthors(aRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setPL(true);
    api.get(`/venues/${id}/papers?page=${page}&limit=${PER_PAGE}`)
      .then(res => setPapers(prev => page === 1 ? res.data.data : [...prev, ...res.data.data]))
      .catch(console.error)
      .finally(() => setPL(false));
  }, [id, page]);

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-pulse text-gray-400 text-lg">Loading venue…</div>
    </div>;
  }

  if (!venue) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-red-500">Venue not found.</p>
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link to="/venues" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6 transition-colors">
          ← All Venues
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{venue.name}</h1>
                <span className="text-sm font-medium bg-blue-100 text-blue-700 px-3 py-1 rounded-full">{venue.type}</span>
              </div>
              {venue.issn && <p className="text-sm text-gray-500">ISSN: <span className="font-mono">{venue.issn}</span></p>}
              <p className="text-sm text-gray-500 mt-1">Publisher: <span className="text-gray-700 font-medium">{venue.publisher_name}</span></p>
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard icon="📄" label="Papers published" value={stats.paper_count} />
            <StatCard icon="👤" label="Unique authors"   value={stats.author_count} />
            <StatCard icon="🔗" label="Total citations"  value={stats.citation_count} />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              <span className="ml-1.5 text-xs text-gray-400">
                {tab === 'Papers' ? stats?.paper_count : stats?.author_count}
              </span>
            </button>
          ))}
        </div>

        {/* Papers tab */}
        {activeTab === 'Papers' && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {papers.length === 0 && !papersLoading ? (
              <div className="py-16 text-center text-gray-400"><div className="text-4xl mb-3">📄</div><p>No papers yet.</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {papers.map(paper => (
                  <Link
                    key={paper.id}
                    to={`/papers/${paper.id}`}
                    className="block px-4 py-3 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm leading-snug line-clamp-2">
                          {paper.is_retracted && (
                            <span className="mr-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">RETRACTED</span>
                          )}
                          {paper.title}
                        </p>
                        {paper.authors?.length > 0 && (
                          <p className="text-xs text-gray-400 mt-1">
                            {paper.authors.slice(0, 3).map(a => a.name).join(', ')}
                            {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
                          </p>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-400">{paper.publication_date ? new Date(paper.publication_date).getFullYear() : '—'}</p>
                        <p className="text-xs text-gray-400 mt-0.5">🔗 {paper.citation_count ?? 0}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {papersLoading && <div className="py-6 text-center text-sm text-gray-400 animate-pulse">Loading…</div>}
            {papers.length === page * PER_PAGE && !papersLoading && (
              <div className="py-4 text-center border-t border-gray-50">
                <button onClick={() => setPage(p => p + 1)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                  Load more papers
                </button>
              </div>
            )}
          </div>
        )}

        {/* Authors tab */}
        {activeTab === 'Authors' && (
          <div>
            {authors.length === 0 ? (
              <div className="py-16 text-center text-gray-400"><div className="text-4xl mb-3">👤</div><p>No authors found.</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {authors.map(author => (
                  <Link
                    key={author.id}
                    to={author.researcher_user_id ? `/authors/${author.researcher_user_id}` : `/authors/${author.id}`}
                    className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {author.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{author.name}</p>
                      <p className="text-xs text-gray-400">{author.paper_count} paper{author.paper_count !== 1 ? 's' : ''}</p>
                    </div>
                    {author.researcher_user_id && (
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">verified</span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
