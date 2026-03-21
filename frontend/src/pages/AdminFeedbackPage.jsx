import { useState, useEffect } from 'react';
import api from '../api/axios';
import EmptyState from '../components/common/EmptyState';

const ROLE_BADGE = {
  researcher: 'bg-blue-100 text-blue-700',
  venue_user: 'bg-purple-100 text-purple-700',
  admin:      'bg-red-100 text-red-700',
  user:       'bg-gray-100 text-gray-600',
};

function FeedbackItem({ fb, onRespond }) {
  const [responding, setResponding] = useState(false);
  const [text, setText]             = useState(fb.response ?? '');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(!!fb.response);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await api.put(`/feedback/${fb.id}/respond`, { response: text.trim() });
      setSaved(true);
      setResponding(false);
      onRespond(fb.id, text.trim());
    } catch {
      alert('Failed to save response.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${saved ? 'border-green-100' : 'border-gray-100'}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {fb.sender_name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{fb.sender_name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[fb.sender_role] ?? ROLE_BADGE.user}`}>
              {fb.sender_role}
            </span>
            {saved && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Responded</span>}
          </div>
          <p className="text-xs text-gray-400">{fb.sender_email}</p>
        </div>
        <p className="text-xs text-gray-400 flex-shrink-0">
          {new Date(fb.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      {fb.subject && <p className="font-semibold text-gray-800 text-sm mb-1">{fb.subject}</p>}
      <p className="text-sm text-gray-700 leading-relaxed mb-4">{fb.message}</p>
      {saved && fb.response && !responding && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-3">
          <p className="text-xs font-semibold text-blue-700 mb-1">Your response</p>
          <p className="text-sm text-gray-700">{fb.response}</p>
        </div>
      )}
      {!responding ? (
        <button onClick={() => setResponding(true)} className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors">
          {saved ? 'Edit response' : 'Write response'}
        </button>
      ) : (
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            placeholder="Type your response…"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none transition-all"
          />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving || !text.trim()} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Send Response'}
            </button>
            <button onClick={() => setResponding(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');

  useEffect(() => {
    api.get('/feedback')
      .then(res => setFeedbacks(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleRespond(fbId, responseText) {
    setFeedbacks(prev => prev.map(f => f.id === fbId ? { ...f, response: responseText } : f));
  }

  const filtered = feedbacks.filter(fb => {
    if (filter === 'pending')   return !fb.response;
    if (filter === 'responded') return !!fb.response;
    return true;
  });

  const pendingCount   = feedbacks.filter(f => !f.response).length;
  const respondedCount = feedbacks.filter(f => !!f.response).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Feedback Inbox</h1>
          <p className="text-gray-500 mt-1">{feedbacks.length} messages — {pendingCount} pending response</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {[
            { key: 'all',       label: `All (${feedbacks.length})` },
            { key: 'pending',   label: `Pending (${pendingCount})` },
            { key: 'responded', label: `Responded (${respondedCount})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                filter === tab.key ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="✅"
            title="No feedback in this category"
            body="Try another filter or check back later for new messages."
            className="py-12"
          />
        ) : (
          <div className="space-y-4">
            {filtered.map(fb => <FeedbackItem key={fb.id} fb={fb} onRespond={handleRespond} />)}
          </div>
        )}
      </div>
    </div>
  );
}
