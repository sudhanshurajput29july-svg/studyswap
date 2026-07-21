import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Suggestions from '../components/Suggestions';
import API, { getFileUrl } from '../services/api';
import {
  Heart,
  MessageCircle,
  Paperclip,
  Bookmark,
  Share2,
  Send,
  Loader,
  PlusCircle,
  FileText,
  Download,
  AlertCircle,
  X
} from 'lucide-react';

export default function SocialFeed() {
  const { user } = useSelector((state) => state.auth);

  // Lists & States
  const [posts, setPosts] = useState([]);
  const [content, setContent] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Comment Modal States
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const response = await API.get('/posts');
      setPosts(response.data.data);
    } catch (err) {
      setError('Failed to fetch social feed posts.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      if (selected.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selected));
      } else {
        setFilePreview('pdf');
      }
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!content.trim() && !file) return;

    setCreating(true);
    setError('');

    const formData = new FormData();
    formData.append('content', content);
    if (file) {
      formData.append('file', file);
    }

    try {
      const response = await API.post('/posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      setPosts([response.data.data, ...posts]);
      setContent('');
      setFile(null);
      setFilePreview('');
    } catch (err) {
      setError('Failed to create post. Check file constraints.');
    } finally {
      setCreating(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await API.post(`/posts/${postId}/like`);
      const { isLiked } = response.data;
      
      setPosts(posts.map(p => {
        if (p._id === postId) {
          const updatedLikes = isLiked
            ? [...p.likes, user._id]
            : p.likes.filter(id => id !== user._id);
          return { ...p, likes: updatedLikes };
        }
        return p;
      }));
    } catch (err) {
      console.error('Like toggle failed:', err);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !activeCommentPost) return;

    setSubmittingComment(true);
    try {
      const response = await API.post(`/posts/${activeCommentPost._id}/comment`, {
        content: commentText
      });
      
      setPosts(posts.map(p => {
        if (p._id === activeCommentPost._id) {
          return { ...p, comments: response.data.data };
        }
        return p;
      }));

      setActiveCommentPost({ ...activeCommentPost, comments: response.data.data });
      setCommentText('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Unified Double-Column Grid (Instagram style: Feed center, suggestions right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT 2/3 COLUMN: Post Maker & Timeline Feed */}
          <div className="lg:col-span-2 space-y-6">
            
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center space-x-3 text-red-600 dark:text-red-400 text-sm animate-pulse">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Post Creator Card */}
            <div className="glass p-6 rounded-2xl border border-white/20 shadow-md space-y-4">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2 text-left">
                <PlusCircle className="w-5 h-5 text-primary-500" />
                <span>Share Study Resources or Updates</span>
              </h3>

              <form onSubmit={handleCreatePost} className="space-y-4">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share a helpful tip, exam syllabus, or upload your cheat sheet..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm shadow-sm resize-none"
                />

                {filePreview && (
                  <div className="relative p-3 border rounded-xl bg-slate-50 dark:bg-dark-950 border-slate-200 dark:border-slate-800 flex items-center space-x-3">
                    {filePreview === 'pdf' ? (
                      <div className="flex items-center space-x-2 text-xs font-semibold text-red-500">
                        <FileText className="w-8 h-8" />
                        <span>PDF Notes: {file?.name}</span>
                      </div>
                    ) : (
                      <img src={filePreview} alt="Preview" className="h-20 rounded-lg max-w-40 object-cover border" />
                    )}
                    <button
                      type="button"
                      onClick={() => { setFile(null); setFilePreview(''); }}
                      className="absolute top-2 right-2 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded-full text-xs"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="py-2 px-4 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center space-x-1.5 hover:bg-slate-50 dark:hover:bg-dark-900 transition-colors shadow-sm"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span>Attach PDF/Notes</span>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,application/pdf" />
                  </button>

                  <button
                    type="submit"
                    disabled={creating || (!content.trim() && !file)}
                    className="py-2 px-5 bg-gradient-purple text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 flex items-center space-x-1.5"
                  >
                    {creating ? <Loader className="w-4 h-4 animate-spin" /> : <span>Broadcast Post</span>}
                  </button>
                </div>
              </form>
            </div>

            {/* Timeline Posts List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader className="w-8 h-8 text-primary-500 animate-spin mb-2" />
                <p className="text-xs text-slate-400">Loading educational timeline...</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="glass p-12 rounded-2xl text-center border border-white/20">
                <Share2 className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                <h3 className="font-bold text-slate-900 dark:text-white text-md">Social Feed is quiet</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Be the first to share notes or exam questions with study peers!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {posts.map((post) => {
                  const isLiked = post.likes.includes(user._id);

                  return (
                    <div key={post._id} className="glass p-6 rounded-2xl border border-white/20 shadow-md space-y-4 text-left">
                      
                      {/* Author Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-purple text-white font-bold flex items-center justify-center shadow-sm">
                            {post.author?.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white leading-tight">
                              {post.author?.name}
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {post.author?.profile?.course || 'Student'} • {post.author?.profile?.college || 'StudySwap'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Content */}
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                        {post.content}
                      </p>

                      {post.mediaUrl && (
                        <div className="rounded-xl overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-dark-950 flex justify-center max-h-96">
                          {post.mediaType === 'pdf' ? (
                            <div className="p-6 flex flex-col items-center justify-center text-center space-y-3 w-full bg-white dark:bg-dark-900">
                              <FileText className="w-12 h-12 text-red-500" />
                              <div>
                                <span className="block text-sm font-bold text-slate-800 dark:text-white">Shared Document (PDF)</span>
                                <span className="block text-xs text-slate-400 mt-0.5">Learn from other peers notes</span>
                              </div>
                              <a
                                href={getFileUrl(post.mediaUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="py-1.5 px-4 bg-primary-600 text-white text-xs font-bold rounded-lg shadow flex items-center space-x-1.5 hover:bg-primary-700 transition-colors"
                              >
                                <Download className="w-4 h-4" />
                                <span>Download Resource</span>
                              </a>
                            </div>
                          ) : (
                            <img src={getFileUrl(post.mediaUrl)} alt="Shared Resource" className="max-w-full object-cover max-h-96" />
                          )}
                        </div>
                      )}

                      {/* Footer interaction bar */}
                      <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 flex justify-between text-slate-400">
                        <button
                          onClick={() => handleLike(post._id)}
                          className={`flex items-center space-x-1.5 text-xs font-bold hover:scale-105 transition-transform ${
                            isLiked ? 'text-red-500' : 'hover:text-red-500'
                          }`}
                        >
                          <Heart className={`w-4.5 h-4.5 ${isLiked ? 'fill-red-500' : ''}`} />
                          <span>{post.likes.length} Likes</span>
                        </button>

                        <button
                          onClick={() => setActiveCommentPost(post)}
                          className="flex items-center space-x-1.5 text-xs font-bold hover:text-primary-500 hover:scale-105 transition-transform"
                        >
                          <MessageCircle className="w-4.5 h-4.5" />
                          <span>{post.comments?.length || 0} Comments</span>
                        </button>

                        <button className="flex items-center space-x-1.5 text-xs font-bold hover:text-slate-600 hover:scale-105 transition-transform">
                          <Bookmark className="w-4.5 h-4.5" />
                          <span>Save</span>
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* RIGHT 1/3 COLUMN: Instagram-style Friend Suggestions */}
          <div className="space-y-6">
            <Suggestions />
          </div>

        </div>

      </div>

      {/* Discussion Modal */}
      {activeCommentPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 flex flex-col max-h-[85vh]">
            
            <div className="flex justify-between items-center border-b pb-3 flex-shrink-0">
              <h3 className="text-md font-bold text-slate-900 dark:text-white">Post Discussion</h3>
              <button onClick={() => setActiveCommentPost(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List comments */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {activeCommentPost.comments?.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-10 italic">No comments written yet. Start the dialogue!</p>
              ) : (
                activeCommentPost.comments.map((comm, idx) => (
                  <div key={idx} className="flex space-x-3 p-3 bg-slate-50 dark:bg-dark-950 rounded-xl border border-slate-100 dark:border-slate-850 text-left">
                    <div className="w-8 h-8 rounded-lg bg-gradient-purple text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                      {comm.user?.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left overflow-hidden flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{comm.user?.name}</span>
                        <span className="text-[9px] text-slate-400">{new Date(comm.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">{comm.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add comment form */}
            <form onSubmit={handleAddComment} className="flex-shrink-0 pt-3 border-t flex space-x-2">
              <input
                type="text"
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write constructive comment..."
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-xs"
              />
              <button
                type="submit"
                disabled={submittingComment || !commentText.trim()}
                className="p-2.5 bg-gradient-purple text-white rounded-xl shadow flex items-center justify-center disabled:opacity-50"
              >
                {submittingComment ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>

          </div>
        </div>
      )}
    </MainLayout>
  );
}
