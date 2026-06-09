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
    socket.emit('register-user', user._id);

    socket.on('new-connection-request', (data) => {
      setNotifications(prev => [data, ...prev]);
    });

    socket.on('incoming-call', (data) => {
      setIncomingCall(data);
      // Auto-hide call popup after 30 seconds
      setTimeout(() => setIncomingCall(null), 30000);
    });

    return () => socket.disconnect();
  }, [user]);

  const acceptCall = () => {
    if (incomingCall) {
      const startVideo = incomingCall.callType === 'video' || incomingCall.callType === 'screen';
      navigate('/calls', { state: { roomId: incomingCall.roomId, startVideo, startScreenShare: false } });
      setIncomingCall(null);
    }
  };

  const declineCall = () => {
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
    { name: 'Workspaces Chat', path: '/chats', icon: <MessageSquare className="w-5 h-5" /> },
    { name: 'Study Room Calls', path: '/calls', icon: <Video className="w-5 h-5" /> },
    { name: 'Social Feed', path: '/feed', icon: <FileText className="w-5 h-5" /> },
    { name: 'Doubt Board', path: '/doubts', icon: <HelpCircle className="w-5 h-5" /> },
    { name: 'My Analytics', path: '/analytics', icon: <TrendingUp className="w-5 h-5" /> },
    { name: 'My Profile', path: '/profile', icon: <User className="w-5 h-5" /> }
  ];

  if (!user) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-dark-950 text-slate-800 dark:text-slate-100 transition-colors duration-300">
      
      {/* 1. INSTAGRAM-STYLE LEFT VERTICAL SIDEBAR (Desktop) */}
      <aside className="hidden md:flex md:w-64 lg:w-72 flex-col justify-between border-r border-slate-200 dark:border-slate-850 bg-white dark:bg-dark-900/60 p-6 flex-shrink-0 sticky top-0 h-screen z-30 backdrop-blur-lg">
        
        <div className="space-y-8">
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

      {/* 5. INCOMING CALL NOTIFICATION */}
      {incomingCall && (
        <div className="fixed top-10 left-1/2 transform -translate-x-1/2 z-[100] bg-white dark:bg-dark-900 border-2 border-primary-500 rounded-2xl shadow-2xl p-4 flex items-center space-x-4 animate-bounce">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 text-primary-500 rounded-full flex items-center justify-center animate-pulse">
            {incomingCall.callType === 'video' || incomingCall.callType === 'screen' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Incoming {incomingCall.callType === 'audio' ? 'Audio' : 'Video'} Call</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">from <span className="font-bold text-primary-600 dark:text-primary-400">{incomingCall.callerName}</span></p>
          </div>
          <div className="flex items-center space-x-2 pl-4">
            <button onClick={declineCall} className="p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-colors" title="Decline">
              <XIcon className="w-5 h-5" />
            </button>
            <button onClick={acceptCall} className="p-2 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 shadow-md transition-colors" title="Accept">
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
