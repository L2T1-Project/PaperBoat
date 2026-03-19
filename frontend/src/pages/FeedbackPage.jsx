import { useState, useEffect } from 'react';
import api from '../api/axios';

function FeedbackCard({ fb }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm">{fb.subject ?? 'General Feedback'}</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(fb.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        {fb.response
          ? <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">Responded</span>
          : <span className="text-xs bg-yellow-100 text-yellow-700 px-2.5 py-0.5 rounded-full font-medium flex-shrink-0">Pending</span>
        }
      </div>
      <p className="text-sm text-gray-700 leading-relaxed mb-3">{fb.message}</p>
      {fb.response && (
        <div className="mt-3 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-semibold text-blue-700 mb-1.5">Admin Response</p>
          <p className="text-sm text-gray-700 leading-relaxed">{fb.response}</p>
          <p className="text-xs text-gray-400 mt-2">
            {new Date(fb.responded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
      )}
    </div>
  );
}

export default function FeedbackPage() {
  const [subject, setSubject]       = useState('');
  const [message, setMessage]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg]   = useState(null);
  const [myFeedback, setMy]         = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    api.get('/feedback/my')
      .then(res => setMy(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      await api.post('/feedback', { subject: subject.trim() || undefined, message: message.trim() });
      setSubject('');
      setMessage('');
      setSubmitMsg({ type: 'success', text: 'Feedback submitted! The admin will respond shortly.' });
      const res = await api.get('/feedback/my');
      setMy(res.data.data);
    } catch {
      setSubmitMsg({ type: 'error', text: 'Failed to submit feedback. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Feedback</h1>
          <p className="text-gray-500 mt-1">Share suggestions, report issues, or ask questions. The admin will respond to your message.</p>
        </div>

        {/* Submit form */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Send New Feedback</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Subject <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Feature request, Bug report…"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                placeholder="Describe your feedback in detail…"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
              />
            </div>
            {submitMsg && (
              <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
                submitMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {submitMsg.text}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {submitting ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </form>
        </div>

        {/* History */}
        <h2 className="text-lg font-semibold text-gray-800 mb-4">My Feedback History</h2>
        {loading ? (
          <div className="space-y-4">
            {[1,2].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-full mb-2" />
                <div className="h-3 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : myFeedback.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">💬</div>
            <p>You haven't submitted any feedback yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myFeedback.map(fb => <FeedbackCard key={fb.id} fb={fb} />)}
          </div>
        )}
      </div>
    </div>
  );
}
