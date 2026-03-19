import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function SaveButton({ paperId, className = '' }) {
  const { isAuthenticated } = useAuth();
  const navigate            = useNavigate();
  const [saved, setSaved]   = useState(false);
  const [loading, setLoad]  = useState(true);
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !paperId) { setLoad(false); return; }
    api.get(`/library/status/${paperId}`)
      .then(res => setSaved(res.data.data.saved))
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [paperId, isAuthenticated]);

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) { navigate('/login'); return; }
    setBusy(true);
    try {
      if (saved) {
        await api.delete(`/library/${paperId}`);
        setSaved(false);
      } else {
        await api.post(`/library/${paperId}`);
        setSaved(true);
      }
    } catch { /* silent */ }
    finally { setBusy(false); }
  }

  if (loading) {
    return (
      <button disabled className={`p-2 rounded-lg text-gray-300 ${className}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={saved ? 'Remove from library' : 'Save to library'}
      className={`p-2 rounded-lg transition-all disabled:opacity-50 ${
        saved ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
      } ${className}`}
    >
      <svg className="w-5 h-5" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    </button>
  );
}
