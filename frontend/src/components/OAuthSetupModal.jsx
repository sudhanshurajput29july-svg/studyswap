import React from 'react';
import { X, Sparkles, AlertCircle, Copy, Check } from 'lucide-react';

export default function OAuthSetupModal({ isOpen, onClose, onMockBypass }) {
  const [copiedField, setCopiedField] = React.useState(null);

  if (!isOpen) return null;

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden transform scale-100 transition-all duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-500">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Google OAuth Configuration Required
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <p>
            StudySwap supports real Google OAuth. To enable Google Sign-In, please configure the credentials in your backend <strong>.env</strong> file.
          </p>

          {/* Steps */}
          <div className="space-y-4">
            <h4 className="font-bold text-slate-800 dark:text-slate-200">How to get credentials:</h4>
            
            <div className="space-y-3 pl-4 border-l-2 border-primary-500">
              <div>
                <span className="font-bold text-primary-600 dark:text-primary-400">Step 1:</span> Visit the{' '}
                <a 
                  href="https://console.cloud.google.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 underline hover:text-primary-700"
                >
                  Google Cloud Console
                </a>{' '}
                and create a project.
              </div>
              <div>
                <span className="font-bold text-primary-600 dark:text-primary-400">Step 2:</span> Configure the <strong>OAuth Consent Screen</strong> as an External Web App and add your email.
              </div>
              <div>
                <span className="font-bold text-primary-600 dark:text-primary-400">Step 3:</span> Create <strong>OAuth Client ID</strong> credentials with these parameters:
                <div className="mt-2 bg-slate-50 dark:bg-dark-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 space-y-2 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span>Authorized Origin: <strong className="text-slate-800 dark:text-slate-200">http://localhost:5000</strong></span>
                    <button 
                      onClick={() => copyToClipboard('http://localhost:5000', 'origin')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      {copiedField === 'origin' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Authorized Redirect URI: <strong className="text-slate-800 dark:text-slate-200">http://localhost:5000/api/auth/google/callback</strong></span>
                    <button 
                      onClick={() => copyToClipboard('http://localhost:5000/api/auth/google/callback', 'redirect')}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                    >
                      {copiedField === 'redirect' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div>
                <span className="font-bold text-primary-600 dark:text-primary-400">Step 4:</span> Add the generated variables to your <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-red-500">backend/.env</code> file:
                <pre className="mt-2 bg-slate-50 dark:bg-dark-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 font-mono text-xs text-slate-700 dark:text-slate-300">
{`GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
BACKEND_URL=http://localhost:5000`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-dark-950/40 border-t border-slate-100 dark:border-slate-800/60 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            onClick={onMockBypass}
            className="w-full sm:w-auto px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 animate-pulse"
          >
            <Sparkles className="w-4 h-4" />
            <span>Use Mock Google Login Bypass</span>
          </button>
          
          <div className="flex gap-2.5 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-50 dark:hover:bg-dark-800 transition-all"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
