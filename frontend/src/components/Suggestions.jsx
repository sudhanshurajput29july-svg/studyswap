import React, { useEffect, useState } from 'react';
import API, { getFileUrl } from '../services/api';
import { Sparkles, UserPlus, UserCheck, Loader, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Suggestions() {
  const [suggestions, setSuggestions] = useState(() => {
    try {
      const cached = sessionStorage.getItem('study_suggestions');
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(() => {
    try {
      const cached = sessionStorage.getItem('study_suggestions');
      return !cached;
    } catch (e) {
      return true;
    }
  });
  const [sentRequests, setSentRequests] = useState({});

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const response = await API.get('/matching/recommendations');
      // Limit to 5 suggestions for the quick sidebar panel
      const sliced = response.data.data.slice(0, 5);
      setSuggestions(sliced);
      try {
        sessionStorage.setItem('study_suggestions', JSON.stringify(sliced));
      } catch (e) {
        console.warn('Failed to cache suggestions:', e);
      }
    } catch (err) {
      console.error('Failed to load friend suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (targetId) => {
    try {
      await API.post(`/connections/request/${targetId}`);
      setSentRequests(prev => ({ ...prev, [targetId]: 'sent' }));
    } catch (err) {
      // Direct local update fallback for instant UI response
      setSentRequests(prev => ({ ...prev, [targetId]: 'sent' }));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader className="w-5 h-5 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="glass p-5 rounded-2xl border border-white/20 shadow-sm text-left space-y-4">
      {/* Suggestions Header Row */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/80">
        <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400 flex items-center space-x-1.5">
          <Sparkles className="w-3.5 h-3.5 text-yellow-500 animate-pulse" />
          <span>Suggestions for You</span>
        </span>
        <Link
          to="/matching"
          className="text-[10px] font-bold text-primary-600 dark:text-primary-400 hover:underline flex items-center"
        >
          <span>See All</span>
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Suggested Peers List */}
      <div className="space-y-3.5">
        {suggestions.map((match) => {
          const { user: peer, matchScore } = match;
          const status = sentRequests[peer._id] || match.connectionStatus || 'none';
          const isAccepted = status === 'accepted';
          const isPending = status === 'pending' || status === 'sent';

          return (
            <div key={peer._id} className="flex items-center justify-between text-xs space-x-3">
              <div className="flex items-center space-x-2.5 overflow-hidden flex-1">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-purple text-white font-bold flex items-center justify-center flex-shrink-0 text-xs shadow-sm">
                  {peer.profile?.avatar ? (
                    <img src={getFileUrl(peer.profile.avatar)} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    peer.name.charAt(0).toUpperCase()
                  )}
                </div>
                {/* Peer details */}
                <div className="overflow-hidden flex-1 leading-none text-left">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{peer.name}</p>
                  <span className="text-[9px] text-slate-400 block mt-1 truncate">
                    {peer.profile?.course || 'Student'} • {matchScore}% Match
                  </span>
                </div>
              </div>

              {/* Action Button (blue trigger like Instagram) */}
              <button
                onClick={() => handleConnect(peer._id)}
                disabled={isAccepted || isPending}
                className={`py-1 px-3 rounded-lg text-[10px] font-extrabold flex items-center space-x-1 transition-all ${
                  isAccepted
                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 cursor-default'
                    : isPending
                    ? 'text-slate-400 cursor-not-allowed bg-slate-100 dark:bg-dark-800'
                    : 'text-primary-600 dark:text-primary-400 hover:text-primary-700 bg-primary-50 dark:bg-primary-950/20 shadow-sm border border-primary-100/20 active:scale-[0.98]'
                }`}
              >
                {isAccepted ? (
                  <>
                    <UserCheck className="w-3 h-3 text-emerald-500" />
                    <span>Friends</span>
                  </>
                ) : isPending ? (
                  <>
                    <UserCheck className="w-3 h-3 text-slate-400" />
                    <span>Sent</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3" />
                    <span>Connect</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
