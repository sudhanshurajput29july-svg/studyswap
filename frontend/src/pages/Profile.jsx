import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import { updateProfileSuccess } from '../features/authSlice';
import API from '../services/api';
import {
  User,
  GraduationCap,
  Plus,
  X,
  Camera,
  CheckCircle2,
  AlertTriangle,
  BookOpen
} from 'lucide-react';

export default function Profile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  // States
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  
  const [strengths, setStrengths] = useState([]);
  const [weaknesses, setWeaknesses] = useState([]);
  const [learningGoals, setLearningGoals] = useState([]);

  // Chip Input Temporary States
  const [newStrength, setNewStrength] = useState('');
  const [newWeakness, setNewWeakness] = useState('');
  const [newGoal, setNewGoal] = useState('');

  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    setName(user.name || '');
    if (user.profile) {
      setBio(user.profile.bio || '');
      setCollege(user.profile.college || '');
      setCourse(user.profile.course || '');
      setStrengths(user.profile.strengths || []);
      setWeaknesses(user.profile.weaknesses || []);
      setLearningGoals(user.profile.learningGoals || []);
      setAvatarPreview(user.profile.avatar || '');
    }
  }, [user, navigate]);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAddStrength = (e) => {
    e.preventDefault();
    if (newStrength.trim() && !strengths.includes(newStrength.trim())) {
      setStrengths([...strengths, newStrength.trim()]);
      setNewStrength('');
    }
  };

  const handleRemoveStrength = (item) => {
    setStrengths(strengths.filter((s) => s !== item));
  };

  const handleAddWeakness = (e) => {
    e.preventDefault();
    if (newWeakness.trim() && !weaknesses.includes(newWeakness.trim())) {
      setWeaknesses([...weaknesses, newWeakness.trim()]);
      setNewWeakness('');
    }
  };

  const handleRemoveWeakness = (item) => {
    setWeaknesses(weaknesses.filter((w) => w !== item));
  };

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (newGoal.trim() && !learningGoals.includes(newGoal.trim())) {
      setLearningGoals([...learningGoals, newGoal.trim()]);
      setNewGoal('');
    }
  };

  const handleRemoveGoal = (item) => {
    setLearningGoals(learningGoals.filter((g) => g !== item));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError('');

    const formData = new FormData();
    formData.append('name', name);
    formData.append('bio', bio);
    formData.append('college', college);
    formData.append('course', course);
    formData.append('strengths', JSON.stringify(strengths));
    formData.append('weaknesses', JSON.stringify(weaknesses));
    formData.append('learningGoals', JSON.stringify(learningGoals));
    
    if (avatar) {
      formData.append('avatar', avatar);
    }

    try {
      const response = await API.put('/users/profile', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      dispatch(updateProfileSuccess(response.data.data));
      setSuccess(true);
      setIsEditing(false); // Switch back to view mode
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Top Header Row */}
        <div className="flex justify-between items-center bg-white dark:bg-dark-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm text-left">
          <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
            <User className="w-5 h-5 text-primary-500" />
            <h1 className="text-lg">Study Portfolio Builder</h1>
          </div>
          <span className="text-xs text-slate-400 font-medium">Build profile tags to connect with peers</span>
        </div>

        {success && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 flex items-start space-x-3 text-emerald-600 dark:text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="font-semibold text-left">Your student profile has been created successfully!</span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 flex items-start space-x-3 text-red-600 dark:text-red-400 text-sm">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Profile Onboarding Builder Form Card */}
        <div className="glass p-8 rounded-2xl border border-white/20 shadow-lg text-left">
          {!isEditing ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-850 pb-6">
                <div className="flex items-center space-x-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-purple flex items-center justify-center text-white text-3xl font-extrabold shadow-lg overflow-hidden border-2 border-white dark:border-dark-800">
                    {user.profile?.avatar ? (
                      <img src={user.profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{name}</h2>
                    <p className="text-sm text-slate-500 mt-1 flex items-center"><GraduationCap className="w-4 h-4 mr-1"/> {college || 'No college specified'} • {course || 'No course specified'}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{bio || 'No bio provided yet.'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
                >
                  Edit Profile
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h3 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mb-3">Strengths (Can Teach)</h3>
                  <div className="flex flex-wrap gap-2">
                    {strengths.length > 0 ? strengths.map(sub => (
                      <span key={sub} className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold">{sub}</span>
                    )) : <span className="text-xs text-slate-400">None added</span>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 mb-3">Weaknesses (Want to Learn)</h3>
                  <div className="flex flex-wrap gap-2">
                    {weaknesses.length > 0 ? weaknesses.map(sub => (
                      <span key={sub} className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold">{sub}</span>
                    )) : <span className="text-xs text-slate-400">None added</span>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary-600 dark:text-primary-400 mb-3">Learning Goals</h3>
                  <div className="flex flex-wrap gap-2">
                    {learningGoals.length > 0 ? learningGoals.map(goal => (
                      <span key={goal} className="px-3 py-1 bg-primary-50 text-primary-600 rounded-lg text-xs font-bold">{goal}</span>
                    )) : <span className="text-xs text-slate-400">None added</span>}
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Avatar Picture Row */}
            <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 pb-6 border-b border-slate-100 dark:border-slate-850">
              <div className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-full bg-gradient-purple flex items-center justify-center text-white text-3xl font-extrabold shadow-lg overflow-hidden border-2 border-white dark:border-dark-800">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    name.charAt(0).toUpperCase()
                  )}
                </div>
                <label className="absolute -bottom-2 -right-2 p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg cursor-pointer shadow-md transition-colors">
                  <Camera className="w-4 h-4" />
                  <input type="file" onChange={handleAvatarChange} className="hidden" accept="image/*" />
                </label>
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-md font-bold text-slate-900 dark:text-white">Profile Photo</h3>
                <p className="text-xs text-slate-400 mt-1">Add a photo to let friends identify you. Max 2MB.</p>
              </div>
            </div>

            {/* Standard inputs block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  College/University
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <GraduationCap className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="Harvard University"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Course/Major
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Bio Description
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Introduce yourself to other study buddies..."
                  rows={1}
                  className="w-full px-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm shadow-sm resize-none"
                />
              </div>
            </div>

            {/* Dynamic chips portfolio setup */}
            <div className="border-t border-slate-100 dark:border-slate-850 pt-6 space-y-6">
              
              {/* Strengths (Can Teach) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                  Subjects You Can Teach (Strengths)
                </label>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={newStrength}
                    onChange={(e) => setNewStrength(e.target.value)}
                    placeholder="e.g. JavaScript, Algebra, Chemistry"
                    className="flex-1 px-4 py-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddStrength}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {strengths.map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs border border-emerald-100 dark:border-emerald-900/30"
                    >
                      <span>{sub}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStrength(sub)}
                        className="p-0.5 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Weaknesses (Want to Learn) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 mb-2">
                  Subjects You Want to Learn (Weaknesses)
                </label>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={newWeakness}
                    onChange={(e) => setNewWeakness(e.target.value)}
                    placeholder="e.g. Node.js, Calculus, Physics"
                    className="flex-1 px-4 py-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddWeakness}
                    className="p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {weaknesses.map((sub) => (
                    <span
                      key={sub}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-100 dark:border-rose-900/30"
                    >
                      <span>{sub}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveWeakness(sub)}
                        className="p-0.5 rounded-full hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Learning Goals */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-2">
                  Learning Goals
                </label>
                <div className="flex space-x-2 mb-3">
                  <input
                    type="text"
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    placeholder="e.g. Build an app, Pass finals"
                    className="flex-1 px-4 py-2 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddGoal}
                    className="p-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl shadow-sm transition-colors flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {learningGoals.map((goal) => (
                    <span
                      key={goal}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-bold text-xs border border-primary-100 dark:border-primary-900/30"
                    >
                      <span>{goal}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(goal)}
                        className="p-0.5 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/30 text-primary-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

            </div>

            <div className="flex space-x-4 mt-8">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-dark-800 dark:hover:bg-dark-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-all shadow-sm text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] py-3.5 bg-gradient-purple text-white font-bold rounded-xl hover:shadow-lg hover:shadow-primary-500/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 shadow-md text-xs"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Save Portfolio Details</span>
                )}
              </button>
            </div>
          </form>
          )}
        </div>

      </div>
    </MainLayout>
  );
}
