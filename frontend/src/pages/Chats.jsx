import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import API from '../services/api';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Users,
  Smile,
  FileText,
  Loader,
  MessageCircle,
  PlusCircle,
  File,
  X,
  Plus,
  Phone,
  Video,
  MonitorUp,
  Trash2
} from 'lucide-react';

export default function Chats() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  
  // Lists
  const [rooms, setRooms] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  
  // Inputs
  const [text, setText] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  
  // Modals & Panels
  const [showEmoji, setShowEmoji] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  
  // Group creation inputs
  const [groupName, setGroupName] = useState('');
  const [peersList, setPeersList] = useState([]);
  const [selectedPeers, setSelectedPeers] = useState([]);
  
  // Notes inputs
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Sockets & Refs
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeRoomRef = useRef(null);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // Emojis list
  const emojis = ['📚', '💡', '🎓', '🚀', '🔥', '💻', '📝', '🙌', '✨', '🧠', '👍', '😊'];

  // Initialize socket connection
  useEffect(() => {
    socketRef.current = io(import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');

    if (user?._id) {
      socketRef.current.emit('register-user', user._id);
    }

    socketRef.current.on('receive-message', (message) => {
      const currentActiveRoom = activeRoomRef.current;
      if (currentActiveRoom && message.chatRoom === currentActiveRoom._id) {
        setMessages((prev) => [...prev, message]);
      }
    });

    fetchRooms();
    fetchPeers();

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchRooms = async () => {
    try {
      const response = await API.get('/chats/rooms');
      setRooms(response.data.data);
      if (response.data.data.length > 0 && !activeRoom) {
        selectRoom(response.data.data[0]);
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoadingRooms(false);
    }
  };

  const fetchPeers = async () => {
    try {
      const response = await API.get('/users');
      setPeersList(response.data.data || []);
    } catch (err) {
      console.error('Failed to load peers:', err);
    }
  };

  const selectRoom = async (room) => {
    setActiveRoom(room);
    setLoadingMessages(true);
    setMessages([]);
    socketRef.current.emit('join-chat', room._id);

    try {
      const response = await API.get(`/chats/rooms/${room._id}/messages`);
      setMessages(response.data.data);
    } catch (err) {
      console.error('Failed to fetch chat logs:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    if (!text.trim() || !activeRoom) return;

    const payload = {
      chatRoomId: activeRoom._id,
      senderId: user._id,
      content: text,
      messageType: 'text'
    };

    socketRef.current.emit('send-message', payload);
    setText('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeRoom) return;

    const formData = new FormData();
    formData.append('file', file);
    
    let type = 'notes';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type === 'application/pdf') type = 'pdf';
    formData.append('messageType', type);

    try {
      const response = await API.post(`/chats/rooms/${activeRoom._id}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const { fileUrl, fileName, messageType } = response.data.data;
      
      const payload = {
        chatRoomId: activeRoom._id,
        senderId: user._id,
        content: `Shared resource: ${fileName}`,
        messageType: messageType,
        fileUrl: fileUrl,
        fileName: fileName
      };

      socketRef.current.emit('send-message', payload);
    } catch (err) {
      console.error('File upload failed:', err);
    }
  };

  const handleShareNote = () => {
    if (!noteTitle.trim() || !noteContent.trim() || !activeRoom) return;

    const notesContentString = `📝 NOTEBOOK: ${noteTitle}\n=========================\n${noteContent}`;

    const payload = {
      chatRoomId: activeRoom._id,
      senderId: user._id,
      content: notesContentString,
      messageType: 'notes'
    };

    socketRef.current.emit('send-message', payload);
    setNoteTitle('');
    setNoteContent('');
    setShowNotesModal(false);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    try {
      const response = await API.post('/chats/room', {
        isGroup: true,
        name: groupName,
        participants: selectedPeers
      });

      setRooms(prev => [response.data.data, ...prev]);
      selectRoom(response.data.data);
      setGroupName('');
      setSelectedPeers([]);
      setShowGroupModal(false);
    } catch (err) {
      console.error('Group creation failed:', err);
    }
  };

  const togglePeerSelection = (peerId) => {
    if (selectedPeers.includes(peerId)) {
      setSelectedPeers(selectedPeers.filter(p => p !== peerId));
    } else {
      setSelectedPeers([...selectedPeers, peerId]);
    }
  };

  const handleCall = (type) => {
    if (!activeRoom) return;

    const startVideo = type === 'video' || type === 'screen';
    const startScreenShare = type === 'screen';
    
    navigate('/calls', { state: { roomId: activeRoom._id, startVideo, startScreenShare, isCaller: true } });
  };

  const handleDeleteRoom = async (roomId, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this workspace chat?')) return;

    try {
      await API.delete(`/chats/rooms/${roomId}`);
      const updatedRooms = rooms.filter(r => r._id !== roomId);
      setRooms(updatedRooms);

      if (activeRoom && activeRoom._id === roomId) {
        if (updatedRooms.length > 0) {
          selectRoom(updatedRooms[0]);
        } else {
          setActiveRoom(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete chat room:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col h-screen">
      
      {/* Header bar */}
      <header className="flex-shrink-0 bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 flex justify-between items-center z-10 shadow-sm">
        <div className="flex items-center space-x-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-dark-800 text-slate-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Study<span className="text-primary-600 dark:text-primary-400">Swap My Connections</span>
          </span>
        </div>
        <button
          onClick={() => setShowGroupModal(true)}
          className="py-2 px-4 bg-gradient-purple text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg flex items-center space-x-2"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Group Workspace</span>
        </button>
      </header>

      {/* Main Grid: Sidebar + Chat Room */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar rooms list */}
        <aside className="w-80 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-dark-900/50 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800/60 font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <MessageCircle className="w-4 h-4" />
            <span>My Connections</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loadingRooms ? (
              <div className="flex justify-center py-10">
                <Loader className="w-6 h-6 text-primary-500 animate-spin" />
              </div>
            ) : rooms.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10 italic">No workspaces active. Build one or match with a peer!</p>
            ) : (
              rooms.map((room) => {
                const isSelected = activeRoom && activeRoom._id === room._id;
                const roomPartner = room.isGroup 
                  ? null 
                  : room.participants.find(p => p._id !== user._id);
                
                const roomName = room.isGroup 
                  ? room.name 
                  : (roomPartner ? roomPartner.name : 'Study Peer');

                return (
                  <div
                    key={room._id}
                    onClick={() => selectRoom(room)}
                    className={`w-full p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors group ${
                      isSelected
                        ? 'bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-400 border border-primary-100 dark:border-primary-900/20'
                        : 'hover:bg-slate-100 dark:hover:bg-dark-900/50 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3 overflow-hidden flex-1">
                      <div className="w-9 h-9 rounded-lg bg-gradient-purple flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
                        {roomName.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-left overflow-hidden flex-1">
                        <p className="text-sm font-bold truncate leading-tight">{roomName}</p>
                        <p className="text-[10px] text-slate-400 truncate mt-1">
                          {room.isGroup ? `${room.participants.length} peers` : '1-on-1 Workspace'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteRoom(room._id, e)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Delete Workspace Chat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Chat Window */}
        <section className="flex-1 bg-slate-50 dark:bg-dark-950 flex flex-col overflow-hidden relative">
          {activeRoom ? (
            <>
              {/* Active Room Title */}
              <div className="flex-shrink-0 bg-white dark:bg-dark-900/80 px-6 py-3 border-b border-slate-200 dark:border-slate-800/80 flex justify-between items-center z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-purple flex items-center justify-center text-white text-md font-bold shadow-sm">
                    {(activeRoom.isGroup ? activeRoom.name : (activeRoom.participants.find(p => p._id !== user._id)?.name || 'Study Peer')).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white leading-tight">
                      {activeRoom.isGroup ? activeRoom.name : (activeRoom.participants.find(p => p._id !== user._id)?.name || 'Study Peer')}
                    </h3>
                    <p className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                      <Users className="w-3.5 h-3.5 text-primary-500" />
                      <span>{activeRoom.isGroup ? `${activeRoom.participants.length} participants` : 'Secure private connection'}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleCall('audio')}
                    className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
                    title="Audio Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCall('video')}
                    className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
                    title="Video Call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleCall('screen')}
                    className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
                    title="Screen Share"
                  >
                    <MonitorUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowNotesModal(true)}
                    className="py-1.5 px-3 border border-primary-200 dark:border-primary-800/40 bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-bold flex items-center space-x-1.5 hover:bg-primary-100 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Share Note</span>
                  </button>
                  <button
                    onClick={(e) => handleDeleteRoom(activeRoom._id, e)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                    title="Delete Chat Room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message Feed list */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {loadingMessages ? (
                  <div className="flex justify-center items-center py-20">
                    <Loader className="w-8 h-8 text-primary-500 animate-spin" />
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.sender?._id === user._id || msg.sender === user._id;
                    const senderName = msg.sender?.name || 'Student';

                    return (
                      <div key={idx} className={`flex items-end space-x-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {!isOwn && (
                          <div className="w-7 h-7 rounded-lg bg-indigo-500 text-white font-bold flex items-center justify-center text-xs flex-shrink-0">
                            {senderName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="max-w-md">
                          <div className={`p-3.5 rounded-2xl shadow-sm text-sm border leading-relaxed ${
                            isOwn
                              ? 'bg-primary-600 border-primary-600 text-white rounded-br-none'
                              : 'bg-white dark:bg-dark-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-bl-none'
                          }`}>
                            {/* Rendering dynamic attachment types */}
                            {msg.messageType === 'notes' ? (
                              <pre className="font-sans whitespace-pre-wrap leading-relaxed">{msg.content}</pre>
                            ) : msg.messageType === 'image' ? (
                              <div className="space-y-2">
                                <img src={msg.fileUrl} alt="Shared Resource" className="max-w-full rounded-xl max-h-60 object-contain bg-black/5" />
                                <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-xs underline block opacity-85">Open Full Image</a>
                              </div>
                            ) : msg.messageType === 'pdf' ? (
                              <div className="flex items-center space-x-3 p-2 bg-black/10 dark:bg-white/10 rounded-lg">
                                <File className="w-8 h-8 text-red-400" />
                                <div className="text-left overflow-hidden flex-1">
                                  <p className="text-xs font-bold truncate max-w-40">{msg.fileName || 'Document.pdf'}</p>
                                  <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] underline block mt-0.5">Download PDF</a>
                                </div>
                              </div>
                            ) : msg.messageType === 'call' ? (
                              <div className="flex items-center space-x-2 px-1 py-0.5">
                                <Phone className="w-4 h-4 opacity-75" />
                                <span className="font-medium text-sm">{msg.content}</span>
                              </div>
                            ) : (
                              <span>{msg.content}</span>
                            )}
                          </div>
                          <span className="block text-[8px] text-slate-400 text-right mt-1 px-1">
                            {senderName}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message inputs box */}
              <form onSubmit={handleSendMessage} className="flex-shrink-0 bg-white dark:bg-dark-900 p-4 border-t border-slate-200 dark:border-slate-800/80 z-10">
                {showEmoji && (
                  <div className="absolute bottom-20 left-4 bg-white dark:bg-dark-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex space-x-2 z-30 shadow-md">
                    {emojis.map(e => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => {
                          setText(prev => prev + e);
                          setShowEmoji(false);
                        }}
                        className="text-lg hover:scale-110 transition-transform"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-dark-950 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  {/* File attach button */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-900"
                    title="Attach Notes or PDF"
                  >
                    <Paperclip className="w-5 h-5" />
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*,application/pdf" />
                  </button>

                  {/* Emoji selector */}
                  <button
                    type="button"
                    onClick={() => setShowEmoji(!showEmoji)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-dark-900"
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <input
                    type="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Exchange knowledge here..."
                    className="flex-1 py-1.5 px-3 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
                  />

                  <button
                    type="submit"
                    className="p-2.5 bg-gradient-purple text-white rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col justify-center items-center py-20">
              <MessageCircle className="w-16 h-16 text-slate-300 dark:text-slate-700 animate-pulse" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">Workspaces ready</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select a workspace from the sidebar or make a new group to connect.</p>
            </div>
          )}
        </section>

      </div>

      {/* Note Sharing Modal */}
      {showNotesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-primary-500" />
                <span>Share Notebook Notes</span>
              </h3>
              <button onClick={() => setShowNotesModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Note Title</label>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. JavaScript Arrays cheatsheet"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Note Content</label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  placeholder="Paste study notes or cheat sheets here..."
                  rows={6}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                onClick={() => setShowNotesModal(false)}
                className="py-2 px-4 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleShareNote}
                className="py-2 px-5 bg-gradient-purple text-white font-bold rounded-xl text-xs shadow-md"
              >
                Share immediately
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Workspace Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateGroup} className="w-full max-w-md bg-white dark:bg-dark-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-5 h-5 text-primary-500" />
                <span>Create Study Group</span>
              </h3>
              <button type="button" onClick={() => setShowGroupModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Group Name</label>
                <input
                  type="text"
                  required
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Calculus II Study Group"
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-dark-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Select Peers</label>
                <div className="max-h-40 overflow-y-auto space-y-2 border rounded-xl p-3 bg-slate-50 dark:bg-dark-950 border-slate-200 dark:border-slate-800">
                  {peersList.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4 italic">No peers available to invite</p>
                  ) : (
                    peersList.map((peer) => {
                      const selected = selectedPeers.includes(peer._id);
                      return (
                        <button
                          key={peer._id}
                          type="button"
                          onClick={() => togglePeerSelection(peer._id)}
                          className={`w-full p-2 rounded-lg border text-left flex items-center justify-between text-xs transition-colors ${
                            selected
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 font-bold'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900'
                          }`}
                        >
                          <span>{peer.name} ({peer.profile?.course || 'No course'})</span>
                          {selected && <Plus className="w-3.5 h-3.5 rotate-45 text-primary-500" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-3 border-t">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="py-2 px-4 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!groupName.trim()}
                className="py-2 px-5 bg-gradient-purple text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50"
              >
                Create Workspace
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
