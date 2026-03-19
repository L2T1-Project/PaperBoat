import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

function PaperCard({ paper, onUnsave }) {
  const [removing, setRemoving] = useState(false);

  async function handleUnsave() {
    setRemoving(true);
    try {
      await api.delete(`/library/${paper.id}`);
      onUnsave(paper.id);
    } catch {
      alert('Failed to remove paper.');
      setRemoving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 group hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/papers/${paper.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-blue-700 transition-colors line-clamp-2">
            {paper.is_retracted && (
              <span className="mr-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">RETRACTED</span>
            )}
            {paper.title}
          </h3>
        </Link>
        <button
          onClick={handleUnsave}
          disabled={removing}
          className="flex-shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Remove from library"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      {paper.authors?.length > 0 && (
        <p className="text-xs text-gray-400">
          {paper.authors.slice(0, 3).map(a => a.name).join(', ')}
          {paper.authors.length > 3 && ` +${paper.authors.length - 3} more`}
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <Link to={`/venues/${paper.venue_id}`} className="hover:text-blue-600 transition-colors">{paper.venue_name}</Link>
          <span>·</span>
          <span>{paper.publication_date ? new Date(paper.publication_date).getFullYear() : '—'}</span>
          <span>·</span>
          <span>🔗 {paper.citation_count ?? 0}</span>
        </div>
        {paper.pdf_url && (
          <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer"
            className="text-blue-500 hover:text-blue-700 font-medium" onClick={e => e.stopPropagation()}>
            PDF
          </a>
        )}
      </div>
      <p className="text-xs text-gray-300 border-t border-gray-50 pt-2">
        Saved {new Date(paper.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
    </div>
  );
}

export default function MyLibraryPage() {
  const [papers, setPapers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    api.get('/library')
      .then(res => setPapers(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? papers.filter(p =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.authors?.some(a => a.name.toLowerCase().includes(search.toLowerCase()))
      )
    : papers;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Library</h1>
            <p className="text-gray-500 mt-1">{papers.length} saved paper{papers.length !== 1 ? 's' : ''}</p>
          </div>
          <Link to="/papers" className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
            Discover papers →
          </Link>
        </div>
        {papers.length > 0 && (
          <div className="relative mb-6">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search saved papers…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-4/5 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-3/5 mb-4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : papers.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <div className="text-6xl mb-4">🔖</div>
            <h2 className="text-xl font-semibold text-gray-600 mb-2">Your library is empty</h2>
            <p className="text-sm mb-6">Save papers from the discovery page to access them here.</p>
            <Link to="/papers" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors shadow">
              Browse Papers
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400"><p>No papers match your search.</p></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(p => <PaperCard key={p.id} paper={p} onUnsave={id => setPapers(prev => prev.filter(x => x.id !== id))} />)}
          </div>
        )}
      </div>
    </div>
  );
}
