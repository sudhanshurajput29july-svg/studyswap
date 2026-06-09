import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { BookOpen, Mail, ShieldAlert, CheckCircle2, ArrowLeft, Sun, Moon } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [mockLink, setMockLink] = useState('');
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark'));

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
    if (!email) {
      setError('Please enter your email address');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await API.post('/auth/forgot-password', { email });
      setSuccess(response.data.message);
      if (response.data.recoveryLink) {
        setMockLink(response.data.recoveryLink);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send recovery request. Check email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-dark-950 transition-colors duration-300 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 -left-4 w-72 h-72 bg-primary-300 dark:bg-primary-900 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute -bottom-8 right-0 w-80 h-80 bg-indigo-300 dark:bg-indigo-900 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>

      {/* Floating Theme Switcher */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-2 rounded-full glass border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:scale-105 transition-transform"
        aria-label="Toggle Theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Forgot Password Card */}
      <div className="w-full max-w-md glass p-8 rounded-2xl shadow-xl z-10 transition-all border border-white/20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-600 rounded-xl text-white shadow-lg mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Reset Password
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            We will help you recover your StudySwap account
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-start space-x-3 text-red-600 dark:text-red-400 text-sm">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex flex-col space-y-2 text-emerald-600 dark:text-emerald-400 text-sm">
            <div className="flex items-start space-x-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="font-medium">{success}</span>
            </div>
            {mockLink && (
              <div className="mt-3 p-3 bg-white dark:bg-dark-900 rounded-lg border border-slate-100 dark:border-slate-800 text-xs">
                <span className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Developer Recovery Link:</span>
                <a href={mockLink} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline break-all">
                  {mockLink}
                </a>
              </div>
            )}
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Registered Email Address
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
                  placeholder="name@college.edu"
                  className="w-full pl-11 pr-4 py-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-purple text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-primary-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center space-x-2 shadow-md mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <span>Request Recovery Link</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-800/60 pt-6">
          <Link
            to="/login"
            className="inline-flex items-center space-x-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
