import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';

const TYPE_COLOR = {
  Journal:    'bg-blue-100 text-blue-700',
  Conference: 'bg-purple-100 text-purple-700',
  Workshop:   'bg-green-100 text-green-700',
  Preprint:   'bg-yellow-100 text-yellow-700',
};

function VenueCard({ venue }) {
  const typeClass = TYPE_COLOR[venue.type] ?? 'bg-gray-100 text-gray-600';
  return (
    <Link
      to={`/venues/${venue.id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors leading-snug truncate">
            {venue.name}
          </h3>
          {venue.issn && <p className="text-xs text-gray-400 mt-0.5">ISSN: {venue.issn}</p>}
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${typeClass}`}>
          {venue.type}
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Publisher: <span className="text-gray-700 font-medium">{venue.publisher_name}</span>
      </p>
      <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-50 pt-3">
        <span className="flex items-center gap-1">
          <span className="text-base">📄</span>
          <strong className="text-gray-800">{venue.paper_count}</strong> papers
        </span>
        <span className="flex items-center gap-1">
          <span className="text-base">🔗</span>
          <strong className="text-gray-800">{venue.citation_count}</strong> citations
        </span>
      </div>
    </Link>
  );
}

export default function VenuesPage() {
  const [venues, setVenues]     = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [search, setSearch]     = useState('');
  const [typeFilter, setType]   = useState('All');

  const types = ['All', 'Journal', 'Conference', 'Workshop', 'Preprint'];

  useEffect(() => {
    api.get('/venues')
      .then(res => { setVenues(res.data.data); setFiltered(res.data.data); })
      .catch(() => setError('Failed to load venues.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = venues;
    if (typeFilter !== 'All') result = result.filter(v => v.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v =>
        v.name.toLowerCase().includes(q) || v.publisher_name?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [search, typeFilter, venues]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Venues</h1>
          <p className="text-gray-500 mt-1">Browse journals, conferences, and workshops publishing research.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search venues or publishers…"
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {types.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <div className="text-5xl mb-3">🏛️</div>
            <p>No venues found matching your filters.</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">{filtered.length} venue{filtered.length !== 1 ? 's' : ''}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(v => <VenueCard key={v.id} venue={v} />)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
