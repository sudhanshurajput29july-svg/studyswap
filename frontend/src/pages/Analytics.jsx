import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import MainLayout from '../layouts/MainLayout';
import API from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import {
  TrendingUp,
  Award,
  BookOpen,
  Clock,
  Loader,
  AlertCircle,
  Users,
  Sparkles
} from 'lucide-react';

export default function Analytics() {
  const { user } = useSelector((state) => state.auth);

  // States
  const [analytics, setAnalytics] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, leaderboardRes] = await Promise.all([
        API.get('/analytics'),
        API.get('/users/leaderboard')
      ]);

      setAnalytics(analyticsRes.data.data);
      setLeaderboard(leaderboardRes.data.data);
    } catch (err) {
      setError('Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Top Header */}
        <div className="flex justify-between items-center bg-white dark:bg-dark-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm text-left">
          <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
            <TrendingUp className="w-5 h-5 text-primary-500" />
            <h1 className="text-lg">Student Activity & Analytics</h1>
          </div>
          <span className="text-xs text-slate-400 font-medium">Track learning hours & leaderboard ranks</span>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center space-x-3 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader className="w-8 h-8 text-primary-500 animate-spin mb-2" />
            <p className="text-xs text-slate-400">Loading progress boards...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* Left Col (2/3 width): Stat Cards and Charts */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Stat Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass p-5 rounded-2xl border border-white/20 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-primary-50 dark:bg-primary-950/20 text-primary-500 rounded-xl">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Learning Session</span>
                    <span className="block text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {analytics?.learningHours || 0} hrs
                    </span>
                  </div>
                </div>

                <div className="glass p-5 rounded-2xl border border-white/20 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tutor Hours</span>
                    <span className="block text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {analytics?.teachingHours || 0} hrs
                    </span>
                  </div>
                </div>

                <div className="glass p-5 rounded-2xl border border-white/20 shadow-sm flex items-center space-x-4">
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-500 rounded-xl">
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reputation score</span>
                    <span className="block text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                      {user.reputation?.score || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Weekly Study Activity Chart */}
              <div className="glass p-6 rounded-2xl border border-white/20 shadow-md">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider flex items-center space-x-2 text-left">
                  <Clock className="w-4.5 h-4.5 text-primary-500" />
                  <span>Weekly Study Log</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics?.weeklyActivity || []}>
                      <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '11px'
                        }}
                      />
                      <Bar dataKey="hours" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Subject Progress Chart */}
              <div className="glass p-6 rounded-2xl border border-white/20 shadow-md">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 uppercase tracking-wider flex items-center space-x-2 text-left">
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-500" />
                  <span>Subject Mastery Progression</span>
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics?.subjectProgress || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
                      <XAxis dataKey="subject" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(30, 41, 59, 0.9)',
                          border: 'none',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '11px'
                        }}
                      />
                      <Line type="monotone" dataKey="masteryPercentage" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Right Col (1/3 width): Badges Showcase and Leaderboard */}
            <div className="space-y-6">
              
              {/* Badges showcase */}
              <div className="glass p-6 rounded-2xl border border-white/20 shadow-md text-left">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center space-x-2">
                  <Award className="w-4.5 h-4.5 text-yellow-500" />
                  <span>Badges Portfolio</span>
                </h3>
                {user.reputation?.badges?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {user.reputation.badges.map((badge, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400 font-bold text-xs border border-yellow-100 dark:border-yellow-900/30 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{badge}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic leading-normal">No badges earned yet. Answer doubts or teach peers to level up!</p>
                )}
              </div>

              {/* Leaderboard list */}
              <div className="glass p-6 rounded-2xl border border-white/20 shadow-md text-left">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center space-x-2">
                  <Users className="w-4.5 h-4.5 text-indigo-500" />
                  <span>Leaderboard Ranking</span>
                </h3>
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                  {leaderboard.map((student, idx) => {
                    const isSelf = student._id === user._id;

                    return (
                      <div
                        key={student._id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                          isSelf
                            ? 'border-primary-500 bg-primary-50/20 dark:bg-primary-950/10 font-bold'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-dark-900/40'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <span className="w-5 font-extrabold text-slate-400 text-center">#{idx + 1}</span>
                          <div className="w-8 h-8 rounded-lg bg-gradient-purple text-white font-bold flex items-center justify-center text-xs">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="text-left overflow-hidden">
                            <p className="font-bold truncate max-w-28 text-slate-900 dark:text-white leading-tight">
                              {student.name}
                            </p>
                            <span className="text-[9px] text-slate-400 uppercase tracking-wider block mt-0.5">
                              {student.reputation?.mentorLevel}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-extrabold text-primary-600 dark:text-primary-400 font-display">
                          {student.reputation?.score} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

          </div>
        )}

      </div>
    </MainLayout>
  );
}
