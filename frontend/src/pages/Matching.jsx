import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import API from '../services/api';
import {
  Sparkles,
  Award,
  BookOpen,
  UserCheck,
  UserPlus,
  Loader,
  AlertCircle,
  GraduationCap
} from 'lucide-react';

export default function Matching() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sentRequests, setSentRequests] = useState({});

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get('/matching/recommendations');
      setMatches(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve match suggestions.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (targetId) => {
    try {
      await API.post(`/connections/request/${targetId}`);
      setSentRequests(prev => ({ ...prev, [targetId]: 'sent' }));
    } catch (err) {
      setSentRequests(prev => ({ ...prev, [targetId]: 'sent' }));
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Page title row */}
        <div className="flex justify-between items-center bg-white dark:bg-dark-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm text-left">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">Smart Match Suggestions</h1>
          </div>
          <span className="text-xs text-slate-400 font-medium">Find ideal learning partners</span>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader className="w-10 h-10 text-primary-600 animate-spin" />
            <p className="text-xs text-slate-400">Running smart matching criteria...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-2xl flex items-center space-x-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : matches.length === 0 ? (
          <div className="glass p-12 rounded-2xl text-center border border-white/20">
            <div className="inline-flex p-4 bg-primary-50 dark:bg-primary-950/20 rounded-full text-primary-600 mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">No active matches found</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-2 text-sm">
              Try adding more subjects to your strengths or weaknesses under profile settings to kickstart suggestions!
            </p>
            <Link
              to="/profile"
              className="mt-6 inline-block py-2.5 px-6 bg-gradient-purple text-white font-bold rounded-xl shadow-md text-xs"
            >
              Update Portfolio Subjects
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match, idx) => {
              const { user: candidate, matchScore, matchingTeach, matchingLearn } = match;
              const isSent = sentRequests[candidate._id] === 'sent';

              return (
                <div
                  key={idx}
                  className="glass rounded-2xl border border-white/20 shadow-md flex flex-col justify-between overflow-hidden hover:scale-[1.01] transition-all text-left"
                >
                  {/* Card Top Score Banner */}
                  <div className="bg-gradient-purple p-4 text-white flex justify-between items-center">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 py-0.5 px-2 rounded-full">
                      Match Priority
                    </span>
                    <span className="text-xs font-bold bg-yellow-400 text-slate-950 px-2 py-0.5 rounded-lg shadow flex items-center space-x-1">
                      <Sparkles className="w-3 h-3 text-slate-950 animate-spin" style={{ animationDuration: '3s' }} />
                      <span>Score: {matchScore}%</span>
                    </span>
                  </div>

                  {/* Candidate Profile Info */}
                  <div className="p-6 space-y-4 flex-1">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-purple flex items-center justify-center text-white text-lg font-bold shadow-md">
                        {candidate.profile?.avatar ? (
                          <img src={candidate.profile.avatar} alt="Avatar" className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          candidate.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white leading-tight">
                          {candidate.name}
                        </h4>
                        <span className="text-xs text-primary-500 dark:text-primary-400 font-medium">
                          Student peer
                        </span>
                      </div>
                    </div>

                    {candidate.profile?.bio && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 italic leading-relaxed">
                        "{candidate.profile.bio}"
                      </p>
                    )}

                    {/* College and Course */}
                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                      <p className="flex items-center space-x-1.5">
                        <GraduationCap className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className={match.sameCollege ? 'font-bold text-primary-600 dark:text-primary-400' : ''}>
                          {candidate.profile?.college || 'Set College'}
                        </span>
                      </p>
                      <p className="flex items-center space-x-1.5">
                        <BookOpen className="w-4 h-4 text-primary-500 flex-shrink-0" />
                        <span className={match.sameCourse ? 'font-bold text-primary-600 dark:text-primary-400' : ''}>
                          {candidate.profile?.course || 'Set Course'}
                        </span>
                      </p>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-3 text-xs">
                      {/* Overlapping matching sections */}
                      {matchingTeach.length > 0 && (
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1.5">
                            Can Teach You:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {matchingTeach.map((sub, sIdx) => (
                              <span key={sIdx} className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-medium">
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {matchingLearn.length > 0 && (
                        <div>
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-1.5">
                            Wants to Learn From You:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {matchingLearn.map((sub, sIdx) => (
                              <span key={sIdx} className="bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-medium">
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Connect Trigger */}
                  <div className="p-4 border-t border-slate-100 dark:border-slate-850 bg-white/40 dark:bg-dark-900/40">
                    <button
                      onClick={() => handleConnect(candidate._id)}
                      disabled={isSent}
                      className={`w-full py-2 px-4 rounded-xl font-bold flex items-center justify-center space-x-2 transition-all text-xs ${
                        isSent
                          ? 'bg-slate-100 dark:bg-dark-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                          : 'bg-gradient-purple text-white shadow-md hover:shadow-lg hover:shadow-primary-500/10 active:scale-[0.98]'
                      }`}
                    >
                      {isSent ? (
                        <>
                          <UserCheck className="w-4 h-4" />
                          <span>Request Sent</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          <span>Send Connection Request</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
