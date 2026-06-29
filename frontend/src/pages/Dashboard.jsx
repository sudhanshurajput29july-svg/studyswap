import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Suggestions from '../components/Suggestions';
import {
  BookOpen,
  User,
  Users,
  MessageSquare,
  Video,
  FileText,
  HelpCircle,
  TrendingUp,
  Award,
  Sparkles,
  Search,
  BookMarked,
  PlusCircle,
  GraduationCap,
  ArrowRight
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  
  const [profile, setProfile] = useState({
    college: '',
    course: '',
    bio: '',
    strengths: [],
    weaknesses: []
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (user?.profile) {
      setProfile(user.profile);
    }
  }, [isAuthenticated, navigate, user]);

  // Dynamic modules list for grid navigation
  const modules = [
    {
      title: 'Smart Matching',
      desc: 'Connect with ideal peer partners based on academic subjects.',
      icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
      color: 'bg-yellow-50/50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/40 hover:border-yellow-400',
      accent: 'text-yellow-600 dark:text-yellow-400',
      path: '/matching'
    },
    {
      title: 'Real-Time Chat',
      desc: 'Collaborate in private 1-on-1 rooms or group study chats.',
      icon: <MessageSquare className="w-6 h-6 text-primary-500" />,
      color: 'bg-primary-50/50 dark:bg-primary-950/20 border-primary-200 dark:border-primary-900/40 hover:border-primary-400',
      accent: 'text-primary-600 dark:text-primary-400',
      path: '/chats'
    },
    {
      title: 'Video Learning',
      desc: 'Host HD calls with shared whiteboard & screen share zoom.',
      icon: <Video className="w-6 h-6 text-red-500" />,
      color: 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40 hover:border-red-400',
      accent: 'text-red-600 dark:text-red-400',
      path: '/calls'
    },
    {
      title: 'Social Feed',
      desc: 'Discover and share study notes, resources, and community posts.',
      icon: <FileText className="w-6 h-6 text-emerald-500" />,
      color: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 hover:border-emerald-400',
      accent: 'text-emerald-600 dark:text-emerald-400',
      path: '/feed'
    },
    {
      title: 'Doubt Solving',
      desc: 'Ask academic questions and get verified student answers.',
      icon: <HelpCircle className="w-6 h-6 text-blue-500" />,
      color: 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40 hover:border-blue-400',
      accent: 'text-blue-600 dark:text-blue-400',
      path: '/doubts'
    },
    {
      title: 'Analytics Dashboard',
      desc: 'Monitor study hours, reputation badges, and peer stats.',
      icon: <TrendingUp className="w-6 h-6 text-purple-500" />,
      color: 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/40 hover:border-purple-400',
      accent: 'text-purple-600 dark:text-purple-400',
      path: '/analytics'
    }
  ];

  if (!user) return null;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Workspace Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Peer Learning Workspaces</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Welcome back, <span className="text-primary-500 font-bold">{user.name}</span>! Choose a study workspace below to get started.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Study Session Active</span>
            </span>
          </div>
        </div>

        {/* 3-Column Split: Modules Grid on Left, Suggestions on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Left 2 Columns: 6 Compact Workspace Boxes */}
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {modules.map((mod, idx) => (
                <div
                  key={idx}
                  onClick={() => mod.path && navigate(mod.path)}
                  className={`p-5 rounded-2xl border ${mod.color} hover:scale-[1.01] hover:shadow-md cursor-pointer transition-all duration-200 flex flex-col justify-between space-y-4 text-left group`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2.5 bg-white dark:bg-dark-900 rounded-xl shadow-sm border border-black/5 dark:border-white/5 group-hover:scale-105 transition-transform">
                      {mod.icon}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-white/60 dark:bg-dark-900/60 px-2 py-0.5 rounded-full border border-black/5 dark:border-white/5">
                      Workspace 0{idx + 1}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug group-hover:text-primary-500 transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal font-medium">
                      {mod.desc}
                    </p>
                  </div>

                  <div className={`inline-flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider ${mod.accent}`}>
                    <span>Explore Workspace</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right 1 Column: Suggestions Sticky Sidebar */}
          <div className="lg:col-span-1 sticky top-6">
            <Suggestions />
          </div>

        </div>

      </div>
    </MainLayout>
  );
}
