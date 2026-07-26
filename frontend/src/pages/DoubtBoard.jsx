import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import MainLayout from '../layouts/MainLayout';
import API from '../services/api';
import {
  HelpCircle,
  PlusCircle,
  CheckCircle2,
  ChevronUp,
  MessageSquare,
  Loader,
  AlertCircle,
  X,
  Search
} from 'lucide-react';

export default function DoubtBoard() {
  const { user } = useSelector((state) => state.auth);

  // Lists
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  
  // States
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Forms
  const [showAskModal, setShowAskModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('JavaScript');
  const [asking, setAsking] = useState(false);

  // Active Detailed Question View
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [answering, setAnswering] = useState(false);

  // Supported subject tag filters
  const subjectFilters = ['All', 'JavaScript', 'Node.js', 'Calculus', 'Algebra', 'Physics', 'Chemistry'];

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [questions, selectedSubject, searchQuery]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const response = await API.get('/doubts');
      setQuestions(response.data.data);
    } catch (err) {
      setError('Failed to fetch doubt board logs.');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let list = [...questions];
    if (selectedSubject !== 'All') {
      list = list.filter(q => q.subject.toLowerCase() === selectedSubject.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        item => item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
      );
    }
    setFilteredQuestions(list);
  };

  const handleAskQuestion = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !subject) return;

    setAsking(true);
    try {
      const response = await API.post('/doubts', { title, content, subject });
      setQuestions([response.data.data, ...questions]);
      setTitle('');
      setContent('');
      setShowAskModal(false);
    } catch (err) {
      setError('Failed to submit question. Try again.');
    } finally {
      setAsking(false);
    }
  };

  const handleUpvoteQuestion = async (e, questionId) => {
    e.stopPropagation();
    try {
      await API.put(`/doubts/${questionId}/upvote`);
      setQuestions(questions.map(q => {
        if (q._id === questionId) {
          const isUpvoted = q.upvotes.includes(user._id);
          const updatedUpvotes = isUpvoted
            ? q.upvotes.filter(id => id !== user._id)
            : [...q.upvotes, user._id];
          return { ...q, upvotes: updatedUpvotes };
        }
        return q;
      }));
    } catch (err) {
      console.error('Question upvote failed:', err);
    }
  };

  const handleUpvoteAnswer = async (e, answerId) => {
    e.stopPropagation();
    if (!activeQuestion) return;
    try {
      await API.put(`/doubts/${activeQuestion._id}/answers/${answerId}/upvote`);
      
      const updatedAnswers = activeQuestion.answers.map(ans => {
        if (ans._id === answerId) {
          const isUpvoted = ans.upvotes.includes(user._id);
          const updatedUpvotes = isUpvoted
            ? ans.upvotes.filter(id => id !== user._id)
            : [...ans.upvotes, user._id];
          return { ...ans, upvotes: updatedUpvotes };
        }
        return ans;
      });

      const updatedQ = { ...activeQuestion, answers: updatedAnswers };
      setActiveQuestion(updatedQ);
      setQuestions(questions.map(q => q._id === activeQuestion._id ? updatedQ : q));
    } catch (err) {
      console.error('Answer upvote failed:', err);
    }
  };

  const handleAcceptAnswer = async (answerId) => {
    if (!activeQuestion) return;
    try {
      await API.put(`/doubts/${activeQuestion._id}/answers/${answerId}/accept`);
      
      const updatedAnswers = activeQuestion.answers.map(ans => ({
        ...ans,
        isAccepted: ans._id === answerId
      }));

      const updatedQ = { ...activeQuestion, answers: updatedAnswers, isSolved: true };
      setActiveQuestion(updatedQ);
      setQuestions(questions.map(q => q._id === activeQuestion._id ? updatedQ : q));
    } catch (err) {
      console.error('Accept answer failed:', err);
    }
  };

  const handleAddAnswer = async (e) => {
    e.preventDefault();
    if (!answerText.trim() || !activeQuestion) return;

    setAnswering(true);
    try {
      const response = await API.post(`/doubts/${activeQuestion._id}/answers`, {
        content: answerText
      });

      const updatedQ = response.data.data;
      setActiveQuestion(updatedQ);
      setQuestions(questions.map(q => q._id === activeQuestion._id ? updatedQ : q));
      setAnswerText('');
    } catch (err) {
      console.error('Failed to submit answer:', err);
    } finally {
      setAnswering(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Navbar */}
        <div className="flex justify-between items-center bg-white dark:bg-dark-900 px-6 py-4 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-sm text-left">
          <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-white">
            <HelpCircle className="w-5 h-5 text-primary-500" />
            <h1 className="text-lg">Doubt Clearing Board</h1>
          </div>
          <span className="text-xs text-slate-400 font-medium">Solve doubts with fellow students</span>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30 rounded-xl flex items-center space-x-3 text-red-600 dark:text-red-400 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dashboard Control Row */}
        <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-white/40 dark:bg-dark-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          
          {/* Search filter input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doubts by title or content keywords..."
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-xs shadow-sm"
            />
          </div>

          <button
            onClick={() => setShowAskModal(true)}
            className="py-2.5 px-5 bg-gradient-purple text-white text-xs font-bold rounded-xl shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center space-x-1.5 animate-shimmer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Ask a Question</span>
          </button>
        </div>

        {/* Dynamic Subject Tag Bar */}
        <div className="flex overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap gap-2 pb-2 max-w-full">
          {subjectFilters.map((sub) => (
            <button
              key={sub}
              onClick={() => setSelectedSubject(sub)}
              className={`flex-shrink-0 text-xs px-4 py-2 rounded-full font-bold border transition-all ${
                selectedSubject === sub
                  ? 'border-primary-500 bg-primary-600 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900 text-slate-500 hover:bg-slate-100 dark:hover:bg-dark-800'
              }`}
            >
              {sub}
            </button>
          ))}
        </div>

        {/* Doubt Questions List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader className="w-8 h-8 text-primary-500 animate-spin mb-2" />
            <p className="text-xs text-slate-400">Loading doubt portfolios...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="glass p-12 rounded-2xl text-center border border-white/20">
            <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <h3 className="font-bold text-slate-900 dark:text-white text-md">No questions found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Try altering the search or filter tag to fetch results!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((q) => {
              const isUpvoted = q.upvotes.includes(user._id);

              return (
                <div
                  key={q._id}
                  onClick={() => setActiveQuestion(q)}
                  className="glass p-6 rounded-2xl border border-white/20 shadow-sm flex items-start space-x-4 cursor-pointer hover:scale-[1.01] hover:shadow-md transition-all text-left"
                >
                  {/* Upvotes counter box */}
                  <button
                    onClick={(e) => handleUpvoteQuestion(e, q._id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                      isUpvoted
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900 text-slate-400 hover:text-primary-500'
                    }`}
                  >
                    <ChevronUp className="w-5 h-5" />
                    <span className="text-xs font-extrabold mt-0.5">{q.upvotes.length}</span>
                  </button>

                  {/* Question details summary */}
                  <div className="flex-1 overflow-hidden space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900/30 px-2 py-0.5 rounded">
                        {q.subject}
                      </span>
                      {q.isSolved ? (
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>SOLVED</span>
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-200 dark:bg-dark-800 text-slate-400 px-2 py-0.5 rounded">
                          OPEN
                        </span>
                      )}
                    </div>
                    
                    <h3 className="font-bold text-slate-900 dark:text-white text-md leading-snug hover:underline">
                      {q.title}
                    </h3>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {q.content}
                    </p>

                    <div className="flex justify-between items-center pt-2 text-[10px] text-slate-400 border-t border-black/5 dark:border-white/5">
                      <span>Asked by: <strong className="text-slate-600 dark:text-slate-300">{q.author?.name}</strong></span>
                      <span className="flex items-center space-x-1 font-bold text-primary-500">
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{q.answers?.length || 0} Answers</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Ask Doubt Modal */}
      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleAskQuestion} className="w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-primary-500" />
                <span>Ask Peer Community</span>
              </h3>
              <button type="button" onClick={() => setShowAskModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Question Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Why does my React useEffect run twice?"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Subject Tag</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                >
                  {subjectFilters.filter(s => s !== 'All').map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Question Details</label>
                <textarea
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Explain your problem clearly. List what you tried or errors you hit..."
                  rows={5}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowAskModal(false)}
                className="py-2 px-4 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={asking || !title.trim() || !content.trim()}
                className="py-2 px-5 bg-gradient-purple text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50"
              >
                {asking ? <Loader className="w-4 h-4 animate-spin" /> : <span>Submit Doubt</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Question Details View Modal Overlay */}
      {activeQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4 flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center border-b pb-3 flex-shrink-0">
              <span className="text-xs uppercase font-bold tracking-wider bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded border border-primary-100">
                {activeQuestion.subject}
              </span>
              <button onClick={() => setActiveQuestion(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable details and answers */}
            <div className="flex-1 overflow-y-auto space-y-6 pr-1">
              
              {/* Question Header & Body */}
              <div className="space-y-3">
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-white leading-snug">
                  {activeQuestion.title}
                </h2>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap text-left">
                  {activeQuestion.content}
                </p>
                <div className="text-[10px] text-slate-400 flex items-center justify-between border-b pb-4">
                  <span>Asked by: <strong>{activeQuestion.author?.name}</strong></span>
                  <span>{new Date(activeQuestion.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Answers Section */}
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center space-x-2">
                  <MessageSquare className="w-4.5 h-4.5 text-primary-500" />
                  <span>Discussion ({activeQuestion.answers?.length || 0} Answers)</span>
                </h3>

                {activeQuestion.answers?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 italic text-center">No answers written yet. Share your knowledge!</p>
                ) : (
                  <div className="space-y-3">
                    {activeQuestion.answers.map((ans) => {
                      const isUpvoted = ans.upvotes.includes(user._id);
                      const isOwner = activeQuestion.author?._id === user._id || activeQuestion.author === user._id;

                      return (
                        <div
                          key={ans._id}
                          className={`p-4 rounded-xl border flex items-start space-x-3 transition-colors ${
                            ans.isAccepted
                              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10'
                              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-dark-950/60'
                          }`}
                        >
                          {/* Upvotes button */}
                          <button
                            onClick={(e) => handleUpvoteAnswer(e, ans._id)}
                            className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-xs transition-all ${
                              isUpvoted
                                ? 'border-primary-400 bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900 text-slate-400 hover:text-primary-500'
                            }`}
                          >
                            <ChevronUp className="w-4 h-4" />
                            <span className="font-bold">{ans.upvotes.length}</span>
                          </button>

                          <div className="flex-1 text-left space-y-1.5 overflow-hidden">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-900 dark:text-white">{ans.author?.name}</span>
                              <span className="text-[9px] text-slate-400">{new Date(ans.createdAt).toLocaleDateString()}</span>
                            </div>
                            
                            <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{ans.content}</p>
                            
                            <div className="flex justify-between items-center pt-2">
                              {/* Accepted banner */}
                              {ans.isAccepted ? (
                                <span className="inline-flex items-center space-x-1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">
                                  <CheckCircle2 className="w-3.5 h-3.5 fill-emerald-500 text-white" />
                                  <span>RESOLVER OF DOUBT</span>
                                </span>
                              ) : isOwner && !activeQuestion.isSolved ? (
                                <button
                                  onClick={() => handleAcceptAnswer(ans._id)}
                                  className="py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold rounded shadow flex items-center space-x-1"
                                >
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Accept & Reward +50</span>
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Answer Question form Box */}
            <form onSubmit={handleAddAnswer} className="flex-shrink-0 pt-3 border-t flex space-x-2">
              <input
                type="text"
                required
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Write clear, helpful explanation..."
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-xs"
              />
              <button
                type="submit"
                disabled={answering || !answerText.trim()}
                className="py-2 px-5 bg-gradient-purple text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {answering ? <Loader className="w-4 h-4 animate-spin" /> : <span>Reply</span>}
              </button>
            </form>

          </div>
        </div>
      )}
    </MainLayout>
  );
}
