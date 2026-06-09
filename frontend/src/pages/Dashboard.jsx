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
  GraduationCap
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
      desc: 'Find study partners based on subjects',
      icon: <Sparkles className="w-6 h-6 text-yellow-500" />,
      color: 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-100 dark:border-yellow-900/30',
      path: '/matching'
    },
    {
      title: 'Real-Time Chat',
      desc: 'Connect in rooms or group workspaces',
      icon: <MessageSquare className="w-6 h-6 text-primary-500" />,
      color: 'bg-primary-50 dark:bg-primary-950/20 border-primary-100 dark:border-primary-900/30',
      path: '/chats'
    },
    {
      title: 'Video Learning',
      desc: 'Host 1-on-1 calls with whiteboard integration',
      icon: <Video className="w-6 h-6 text-red-500" />,
      color: 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30',
      path: '/calls'
    },
    {
      title: 'Social Feed',
      desc: 'Share learning notes, resources, and ideas',
      icon: <FileText className="w-6 h-6 text-emerald-500" />,
      color: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30',
      path: '/feed'
    },
    {
      title: 'Doubt Solving',
      desc: 'Ask and answer educational questions',
      icon: <HelpCircle className="w-6 h-6 text-blue-500" />,
      color: 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30',
      path: '/doubts'
    },
    {
      title: 'Analytics Dashboard',
      desc: 'Track learning hours & reputation points',
      icon: <TrendingUp className="w-6 h-6 text-purple-500" />,
      color: 'bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30',
      path: '/analytics'
    }
  ];

  if (!user) return null;

  // Check if profile is complete (acts as onboarding status helper)
  const isProfileIncomplete = !profile.college || !profile.course || profile.strengths.length === 0;

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Unified Double-Column Grid (Instagram style: feed in middle, suggestions on right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT 2/3 COLUMN: Main Dashboard widgets */}
          <div className="lg:col-span-2 space-y-6">
            

            {/* Quick platform highlights */}
            <div className="space-y-4">
              <h2 className="text-md font-extrabold uppercase tracking-wider text-slate-400">Workspace Dashboard</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {modules.map((mod, idx) => (
                  <div
                    key={idx}
                    onClick={() => mod.path && navigate(mod.path)}
                    className={`p-6 rounded-2xl border ${mod.color} hover:scale-[1.01] hover:shadow-md cursor-pointer transition-all flex flex-col space-y-4 text-left`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-white dark:bg-dark-900 rounded-xl shadow-sm border border-black/5 dark:border-white/5">
                        {mod.icon}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Workspace 0{idx + 1}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{mod.title}</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">{mod.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* RIGHT 1/3 COLUMN: Onboarding Profile & Instagram-style Suggestions */}
          <div className="space-y-6">
            

            {/* INSTAGRAM-STYLE "SUGGESTIONS FOR YOU" FRIEND RECOMMENDATIONS */}
            <Suggestions />

          </div>

        </div>

      </div>
    </MainLayout>
  );
}
