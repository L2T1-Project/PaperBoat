import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function FollowButton({ targetUserId, className = '' }) {
  const { isAuthenticated, user } = useAuth();
  const navigate                  = useNavigate();
  const [following, setFollowing] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [busy, setBusy]           = useState(false);

  const hasTarget = Number.isInteger(Number(targetUserId));
  const isSelf = user?.userId === Number(targetUserId);

  useEffect(() => {
    if (!isAuthenticated || !hasTarget || isSelf) { setLoading(false); return; }
    api.get(`/follows/status/${targetUserId}`)
      .then(res => setFollowing(res.data.data.following))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [targetUserId, isAuthenticated, isSelf, hasTarget]);

  if (isSelf) return null;

  async function toggle() {
    if (!isAuthenticated) { navigate('/login'); return; }
    if (!hasTarget) { return; }
    setBusy(true);
    try {
      if (following) {
        await api.delete(`/follows/${targetUserId}`);
        setFollowing(false);
      } else {
        await api.post(`/follows/${targetUserId}`);
        setFollowing(true);
      }
    } catch { /* silent */ }
    finally { setBusy(false); }
  }

  if (loading) return <div className={`h-9 w-24 bg-gray-100 rounded-xl animate-pulse ${className}`} />;

  if (!hasTarget) {
    return (
      <button
        type="button"
        disabled
        title="Follow unavailable: this author is not linked to a user account yet"
        className={`px-5 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed ${className}`}
      >
        Follow unavailable
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
        following
          ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200'
          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
      } ${className}`}
    >
      {busy ? '…' : following ? 'Following' : 'Follow'}
    </button>
  );
}
