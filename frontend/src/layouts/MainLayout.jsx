import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { logoutSuccess } from '../features/authSlice';
import API from '../services/api';
import io from 'socket.io-client';
import {
  BookOpen,
  Home,
  Sparkles,
  MessageSquare,
  Video,
  FileText,
  HelpCircle,
  TrendingUp,
  User,
  LogOut,
  Sun,
  Moon,
  Menu,
  Bell,
  Check,
  X as XIcon,
  Phone
} from 'lucide-react';

export default function MainLayout({ children }) {
  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => document.body.classList.contains('dark'));
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);
  const audioCtxRef = React.useRef(null);
  const ringtoneIntervalRef = React.useRef(null);

  React.useEffect(() => {
    if (incomingCall) {
      startIncomingRingtone();
    } else {
      stopIncomingRingtone();
    }
    return () => stopIncomingRingtone();
  }, [incomingCall]);

  const startIncomingRingtone = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playTone = () => {
        if (!audioCtxRef.current) return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      };

      playTone();
      ringtoneIntervalRef.current = setInterval(playTone, 2000);
    } catch (e) {
      console.error('AudioContext incoming ringtone error:', e);
    }
  };

  const stopIncomingRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
  };

  const socketRef = React.useRef(null);

  React.useEffect(() => {
    if (!user) return;
    
    // Fetch initial notifications
    const fetchNotifications = async () => {
      try {
        const response = await API.get('/connections/list');
        setNotifications(response.data.data.incomingRequests || []);
      } catch (e) {
        console.error('Failed to fetch notifications:', e);
      }
    };
    fetchNotifications();

    // Socket.io connection for real-time alerts
    const socket = io(import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
    socketRef.current = socket;
    socket.emit('register-user', user._id);

    socket.on('new-connection-request', (data) => {
      setNotifications(prev => [data, ...prev]);
    });

    socket.on('incoming-call', (data) => {
      setIncomingCall(data);
      if (data?.roomId) {
        socket.emit('join-call', data.roomId);
      }
      startIncomingRingtone();
    });

    socket.on('call-declined', () => {
      stopIncomingRingtone();
      setIncomingCall(null);
    });

    socket.on('peer-left-call', () => {
      stopIncomingRingtone();
      setIncomingCall(null);
    });

    return () => {
      stopIncomingRingtone();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);

  const acceptCall = () => {
    if (incomingCall) {
      stopIncomingRingtone();
      const startVideo = incomingCall.callType === 'video' || incomingCall.callType === 'screen';
      navigate('/calls', { state: { roomId: incomingCall.roomId, startVideo, startScreenShare: false, isCaller: false } });
      setIncomingCall(null);
    }
  };

  const declineCall = () => {
    stopIncomingRingtone();
    if (incomingCall && socketRef.current) {
      socketRef.current.emit('decline-call', { roomId: incomingCall.roomId });
    }
    setIncomingCall(null);
  };

  const handleAccept = async (id) => {
    try {
      await API.put(`/connections/accept/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      // Auto redirect to chats could be done, but keeping them on current page is safer
    } catch (e) {
      console.error('Failed to accept:', e);
    }
  };

  const handleReject = async (id) => {
    try {
      await API.put(`/connections/reject/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
    } catch (e) {
      console.error('Failed to reject:', e);
    }
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (e) {
      console.error('Logout failed:', e);
    }
    dispatch(logoutSuccess());
    navigate('/login');
  };

  const menuItems = [
    { name: 'Home', path: '/dashboard', icon: <Home className="w-5 h-5" /> },
    { name: 'Discover Smart Match', path: '/matching', icon: <Sparkles className="w-5 h-5" /> },
    { name: 'My Connection', path: '/chats', icon: <MessageSquare className="w-5 h-5" /> },
    { name: 'Social Feed', path: '/feed', icon: <FileText className="w-5 h-5" /> },
    { name: 'Doubt Board', path: '/doubts', icon: <HelpCircle className="w-5 h-5" /> },
    { name: 'My Analytics', path: '/analytics', icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'My Profile', path: '/profile', icon: <User className="w-5 h-5" /> }
  ];

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-dark-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* 1. INSTAGRAM-STYLE LEFT VERTICAL SIDEBAR (Desktop) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col justify-between border-r border-slate-200 dark:border-slate-850 bg-white dark:bg-dark-900/60 p-6 flex-shrink-0 sticky top-0 h-screen overflow-y-auto z-30 backdrop-blur-lg">
        
        <div className="space-y-6">
          {/* Brand Logo & Notifications */}
          <div className="flex items-center justify-between px-2 relative z-50">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-purple text-white rounded-xl shadow-md">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Study<span className="text-primary-600 dark:text-primary-400">Swap</span>
              </span>
            </div>

            {/* Desktop Notifications Button */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white relative transition-colors"
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center shadow-sm border border-white dark:border-dark-900">
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Desktop Notifications Dropdown Popup */}
              {showNotifications && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-dark-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white flex justify-between items-center">
                    <span>Connection Requests</span>
                    <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600"><XIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-6 text-xs text-slate-500 text-center">You're all caught up!</p>
                    ) : (
                      notifications.map(req => (
                        <div key={req._id} className="p-4 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-dark-950 transition-colors">
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{req.requester?.name}</p>
                          <p className="text-xs text-slate-500 mb-3">Wants to start a workspace</p>
                          <div className="flex space-x-2">
                            <button onClick={() => handleAccept(req._id)} className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg flex items-center justify-center space-x-1 shadow-sm">
                              <Check className="w-3.5 h-3.5" /> <span>Accept</span>
                            </button>
                            <button onClick={() => handleReject(req._id)} className="flex-1 py-1.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg flex items-center justify-center space-x-1">
                              <XIcon className="w-3.5 h-3.5" /> <span>Ignore</span>
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links list */}
          <nav className="space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-4 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-extrabold shadow-sm border border-primary-100 dark:border-primary-900/10'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-950'
                  }`
                }
              >
                {item.icon}
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-850 relative">
          
          {/* Theme toggler button */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center space-x-4 px-4 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-dark-950 text-sm font-medium transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span>{isDark ? 'Light Theme' : 'Dark Theme'}</span>
          </button>



          {/* Logout button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-4 px-4 py-2.5 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 text-sm font-bold transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* 2. MOBILE TOP BAR */}
      <header className="md:hidden flex-shrink-0 bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 flex justify-between items-center z-20 sticky top-0 backdrop-blur-lg">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-primary-600 text-white rounded-lg">
            <BookOpen className="w-4 h-4" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white">StudySwap</span>
        </div>
        
        <div className="flex items-center space-x-3 relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <Bell className="w-5 h-5" />
            {notifications.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-dark-900">
                {notifications.length}
              </span>
            )}
          </button>
          <button
            onClick={toggleTheme}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={handleLogout}
            className="p-1.5 text-red-500"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>

          {/* Mobile Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-dark-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-white">Notifications</div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-slate-500 text-center">No new requests</p>
                ) : (
                  notifications.map(req => (
                    <div key={req._id} className="p-3 border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-dark-950 transition-colors">
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{req.requester?.name}</p>
                      <p className="text-[10px] text-slate-500 mb-2">Wants to study with you</p>
                      <div className="flex space-x-2">
                        <button onClick={() => handleAccept(req._id)} className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center space-x-1">
                          <Check className="w-3 h-3" /> <span>Accept</span>
                        </button>
                        <button onClick={() => handleReject(req._id)} className="flex-1 py-1.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold rounded-lg flex items-center justify-center space-x-1">
                          <XIcon className="w-3 h-3" /> <span>Ignore</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 3. MAIN WORKSPACE VIEW */}
      <main className="flex-1 overflow-y-auto min-h-[calc(100vh-65px)] md:min-h-screen pb-20 md:pb-0">
        {children}
      </main>

      {/* 4. MOBILE BOTTOM TAB NAVIGATION (Instagram style) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-dark-900 border-t border-slate-200 dark:border-slate-800/80 flex justify-around items-center z-30 px-2 shadow-lg backdrop-blur-lg">
        {menuItems.slice(0, 5).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-2 rounded-lg text-xs font-semibold transition-colors ${
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-slate-400 hover:text-slate-700'
              }`}
            >
              {item.icon}
            </NavLink>
          );
        })}
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center p-2 rounded-lg text-slate-400 ${
              isActive ? 'text-primary-600 dark:text-primary-400' : ''
            }`
          }
        >
          <User className="w-5 h-5" />
        </NavLink>
      </nav>

      {/* 5. FULLSCREEN INCOMING CALL MODAL POP-UP */}
      {incomingCall && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn">
          <div className="w-full max-w-sm bg-white dark:bg-dark-900 border-2 border-primary-500/50 rounded-3xl p-6 shadow-2xl text-center space-y-6 relative overflow-hidden ring-8 ring-primary-500/10">
            {/* Ambient background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-primary-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
            
            {/* Pulsing Avatar / Icon */}
            <div className="relative inline-block my-2">
              <div className="w-24 h-24 rounded-full bg-gradient-purple text-white flex items-center justify-center shadow-xl ring-8 ring-purple-500/20 animate-pulse mx-auto">
                {incomingCall.callType === 'video' || incomingCall.callType === 'screen' ? (
                  <Video className="w-10 h-10 animate-bounce" />
                ) : (
                  <Phone className="w-10 h-10 animate-bounce" />
                )}
              </div>
              <span className="absolute top-0 right-0 w-6 h-6 bg-emerald-500 border-4 border-white dark:border-dark-900 rounded-full animate-ping" />
            </div>

            <div>
              <span className="text-[10px] uppercase font-extrabold tracking-widest px-3 py-1 bg-primary-100 dark:bg-primary-950/50 text-primary-600 dark:text-primary-400 rounded-full border border-primary-500/20">
                Incoming {incomingCall.callType === 'audio' ? 'Audio' : 'Video'} Call
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
                {incomingCall.callerName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Inviting you to a private study session...
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center space-x-6 pt-2">
              <div className="flex flex-col items-center space-y-1">
                <button 
                  onClick={declineCall} 
                  className="w-16 h-16 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 ring-4 ring-red-500/20" 
                  title="Decline Call"
                >
                  <XIcon className="w-7 h-7" />
                </button>
                <span className="text-[11px] font-bold text-slate-500">Decline</span>
              </div>

              <div className="flex flex-col items-center space-y-1">
                <button 
                  onClick={acceptCall} 
                  className="w-16 h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 ring-4 ring-emerald-500/30 animate-pulse" 
                  title="Accept Call"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Accept</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
