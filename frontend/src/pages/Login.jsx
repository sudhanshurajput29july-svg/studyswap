import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { authStart, authSuccess, authFailure, clearError } from '../features/authSlice';
import API from '../services/api';
import { BookOpen, Key, Mail, ShieldAlert, ArrowRight, Sun, Moon, CheckCircle2, Sparkles } from 'lucide-react';
import OAuthSetupModal from '../components/OAuthSetupModal';

import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark'));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(clearError());
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, dispatch]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      dispatch(authFailure('Please enter both email and password'));
      return;
    }
    dispatch(authStart());
    try {
      const response = await API.post('/auth/login', { email, password });
      dispatch(authSuccess(response.data));
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      dispatch(authFailure(msg));
    }
  };

  const handleGoogleLogin = async () => {
    dispatch(authStart());
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const response = await API.post('/auth/firebase-google', {
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        uid: user.uid
      });
      dispatch(authSuccess(response.data));
      navigate('/dashboard');
    } catch (err) {
      console.error('Firebase Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        dispatch(authFailure('Google Sign-In was cancelled'));
        return;
      }
      // Fallback to Passport URL redirect if Firebase popup is blocked
      let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      apiUrl = apiUrl.replace(/\/+$/, '');
      const cleanApiUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
      window.location.href = `${cleanApiUrl}/auth/google?origin=${encodeURIComponent(window.location.origin)}`;
    }
  };

  const handleMockBypass = () => {
    setIsModalOpen(false);
    let apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    if (window.location.hostname !== 'localhost' && (!apiUrl || apiUrl.includes('localhost'))) {
      alert('Backend API URL is not set in Vercel Environment Variables! Please add VITE_API_URL=https://<your-backend-url>/api in Vercel settings and redeploy.');
      return;
    }
    apiUrl = apiUrl.replace(/\/+$/, '');
    const cleanApiUrl = apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
    window.location.href = `${cleanApiUrl}/auth/google?origin=${encodeURIComponent(window.location.origin)}`;
  };

  const features = [
    { title: "Smart Skill Matching", desc: "Instantly match with peers based on strengths and weaknesses" },
    { title: "Study Call & Whiteboard", desc: "Collaborate in real-time with direct video calls and canvases" },
    { title: "Gamified Doubts Solving", desc: "Help student peers, earn reputation, and rank on the leaderboards" }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-dark-950 transition-colors duration-300 relative overflow-hidden">
      
      {/* Dynamic Background Glows (Right/Mobile backdrop) */}
      <div className="absolute top-0 -right-4 w-72 h-72 bg-primary-300 dark:bg-primary-900 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
      <div className="absolute -bottom-8 right-10 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>

      {/* LEFT PANE: Premium Brand & Onboarding Showcase (Visible on desktop) */}
      <section className="hidden md:flex md:w-1/2 bg-gradient-to-tr from-primary-700 to-indigo-800 text-white p-16 flex-col justify-between relative overflow-hidden">
        {/* Abstract floating glowing background shapes */}
        <div className="absolute top-10 left-10 w-56 h-56 bg-white/10 rounded-full filter blur-2xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-72 h-72 bg-white/5 rounded-full filter blur-3xl animate-pulse"></div>

        {/* Branding header */}
        <div className="flex items-center space-x-3.5 z-10">
          <div className="p-2.5 bg-white/10 backdrop-blur-lg rounded-xl border border-white/20">
            <BookOpen className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight">
            Study<span className="text-primary-200">Swap</span>
          </span>
        </div>

        {/* Dynamic educational slide info */}
        <div className="space-y-8 my-auto z-10 max-w-lg">
          <div>
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-primary-200 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Peer-to-Peer Peer Network</span>
            </span>
            <h2 className="text-4xl font-extrabold tracking-tight leading-tight">
              Teach What You Know,<br />Learn What You Need.
            </h2>
            <p className="mt-4 text-sm text-slate-200/90 leading-relaxed">
              Connect with fellow students globally to swap expertise, clear community doubts, and grow reputation score metrics.
            </p>
          </div>

          <div className="space-y-4 pt-6 border-t border-white/10">
            {features.map((feat, idx) => (
              <div key={idx} className="flex items-start space-x-3.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-white leading-tight">{feat.title}</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-normal">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Left pane footer footer */}
        <div className="text-xs text-slate-300/80 z-10">
          © {new Date().getFullYear()} StudySwap. All rights reserved.
        </div>
      </section>

      {/* RIGHT PANE: Modern Form Workspace */}
      <section className="w-full md:w-1/2 flex items-center justify-center p-6 sm:p-12 z-10 relative">
        
        {/* Floating Theme Switcher */}
        <button
          onClick={toggleTheme}
          className="absolute top-6 right-6 p-2 rounded-full glass border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform"
          aria-label="Toggle Theme"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Login Card */}
        <div className="w-full max-w-md glass p-8 sm:p-10 rounded-2xl shadow-xl border border-white/20">
          
          <div className="text-center mb-8">
            <div className="inline-flex md:hidden items-center justify-center w-14 h-14 bg-primary-600 rounded-xl text-white shadow-lg mb-4">
              <BookOpen className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Sign In
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Welcome back! Please sign in to connect with peers
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-start space-x-3 text-red-600 dark:text-red-400 text-sm">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="w-5 h-5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@college.edu"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Key className="w-5 h-5" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-purple text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2 shadow-md mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-wider">
              <span className="bg-slate-50 dark:bg-dark-900 px-3 text-slate-500 dark:text-slate-400 font-semibold rounded-md">
                Or continue with
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-dark-800/80 active:scale-[0.98] transition-all flex items-center justify-center space-x-3 shadow-sm hover:shadow"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Sign In with Google</span>
          </button>

          <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-800/60 pt-6">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-bold text-primary-600 dark:text-primary-400 hover:underline text-sm"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </section>

      <OAuthSetupModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onMockBypass={handleMockBypass} 
      />
    </div>
  );
}
