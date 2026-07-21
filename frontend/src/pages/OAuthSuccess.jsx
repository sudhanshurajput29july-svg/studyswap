import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { authSuccess } from '../features/authSlice';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export default function OAuthSuccess() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userStr = params.get('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(decodeURIComponent(userStr));
        // Dispatch success action to Redux store
        dispatch(authSuccess({ token, user }));
        
        // Redirect to dashboard after a brief delay for user feedback/premium feel
        const timeout = setTimeout(() => {
          navigate('/dashboard');
        }, 1500);

        return () => clearTimeout(timeout);
      } catch (err) {
        console.error('Error parsing OAuth user data:', err);
        navigate('/login?error=oauth_parse_failed');
      }
    } else {
      console.warn('OAuth parameters missing');
      navigate('/login?error=oauth_missing_params');
    }
  }, [dispatch, navigate, location]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-dark-950 transition-colors duration-300 relative overflow-hidden">
      {/* Background glow animations */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-primary-300 dark:bg-primary-900 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-2xl opacity-20 animate-pulse"></div>

      <div className="w-full max-w-md glass p-8 sm:p-10 rounded-2xl shadow-xl border border-white/20 text-center z-10">
        <div className="relative inline-flex items-center justify-center mb-6">
          {/* Rotating gradient ring */}
          <div className="absolute inset-0 rounded-full border-4 border-t-primary-500 border-r-indigo-500 border-b-emerald-400 border-l-transparent animate-spin w-16 h-16 m-auto"></div>
          <div className="w-16 h-16 bg-white dark:bg-dark-900 rounded-full flex items-center justify-center border border-slate-100 dark:border-slate-800 shadow-md">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 animate-bounce" />
          </div>
        </div>

        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-4 animate-pulse">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Login Successful</span>
        </div>

        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Authenticating...
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
          We are securely logging you into your StudySwap profile. Please wait a moment while we redirect you.
        </p>

        {/* Small subtle progress bar */}
        <div className="w-32 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full mx-auto mt-8 overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-indigo-500 h-full w-full rounded-full origin-left animate-pulse"></div>
        </div>
      </div>
    </div>
  );
}
