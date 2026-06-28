import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import io from 'socket.io-client';
import API from '../services/api';
import {
  ArrowLeft,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Palette,
  Eraser,
  Phone,
  PhoneOff,
  Sparkles,
  Users,
  Maximize2,
  MonitorUp,
  Clock,
  Loader
} from 'lucide-react';

export default function CallRoom() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();
  
  const location = useLocation();
  
  // Call session room id
  const [roomId, setRoomId] = useState(location.state?.roomId || 'Workspace-StudySession');
  const [inCall, setInCall] = useState(false);

  // User Media States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoOn, setVideoOn] = useState(location.state?.startVideo ?? true);
  const [audioOn, setAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState('00:00');
  const timerRef = useRef(null);

  useEffect(() => {
    if (callStartTime) {
      timerRef.current = setInterval(() => {
        const diff = Math.floor((new Date() - callStartTime) / 1000);
        const mins = String(Math.floor(diff / 60)).padStart(2, '0');
        const secs = String(diff % 60).padStart(2, '0');
        setCallDuration(`${mins}:${secs}`);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStartTime]);

  // Auto start call if redirected from chat
  useEffect(() => {
    if (location.state?.roomId) {
      startCall(location.state?.roomId, location.state?.startVideo ?? true, location.state?.startScreenShare ?? false);
    }
  }, []);

  // Whiteboard States
  const [color, setColor] = useState('#8b5cf6'); // Default primary purple
  const [brushSize, setBrushSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);

  // Sockets & Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const drawThrottler = useRef(false);

  const outgoingAudioCtxRef = useRef(null);
  const outgoingRingtoneIntervalRef = useRef(null);

  const startOutgoingRingtone = () => {
    try {
      if (!outgoingAudioCtxRef.current) {
        outgoingAudioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = outgoingAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const playRingTone = () => {
        if (!outgoingAudioCtxRef.current) return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.5);
        osc2.stop(now + 1.5);
      };

      playRingTone();
      outgoingRingtoneIntervalRef.current = setInterval(playRingTone, 3000);
    } catch (e) {
      console.error('AudioContext outgoing ringtone error:', e);
    }
  };

  const stopOutgoingRingtone = () => {
    if (outgoingRingtoneIntervalRef.current) {
      clearInterval(outgoingRingtoneIntervalRef.current);
      outgoingRingtoneIntervalRef.current = null;
    }
  };

  // STUN config for WebRTC peer connection
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize Canvas
  useEffect(() => {
    if (inCall && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement.offsetWidth * 2;
      canvas.height = canvas.parentElement.offsetHeight * 2;
      canvas.style.width = '100%';
      canvas.style.height = '100%';

      const context = canvas.getContext('2d');
      context.scale(2, 2);
      context.lineCap = 'round';
      context.strokeStyle = color;
      context.lineWidth = brushSize;
      contextRef.current = context;
    }
  }, [inCall]);

  // Handle color or size change
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [color, brushSize]);

  // Handle video stream attachments reliably to prevent black feeds
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, inCall]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, inCall]);

  // Connect Sockets & Setup WebRTC
  const startCall = async (callRoomId = roomId, initialVideo = videoOn, startWithScreenShare = false) => {
    if (!callRoomId.trim()) return;

    setInCall(true);
    startOutgoingRingtone();

    try {
      let stream;
      if (startWithScreenShare) {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.addTrack(audioStream.getAudioTracks()[0]);
        setIsScreenSharing(true);
        
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          video: initialVideo,
          audio: true
        });
      }
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // 2. Initialize Sockets
      socketRef.current = io(import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : 'http://localhost:5000');
      
      if (user?._id) {
        socketRef.current.emit('register-user', user._id);
      }
      socketRef.current.emit('join-call', callRoomId);

      // Emit initiate call signal to target recipient if redirected from chats
      if (location.state?.roomId) {
        socketRef.current.emit('initiate-call', {
          roomId: callRoomId,
          callerId: user._id,
          callerName: user.name,
          callType: initialVideo ? 'video' : 'audio'
        });
      }

      // Save Start Call session analytics
      try {
        await API.post('/calls/log', {
          roomName: roomId,
          participants: [user._id],
          startTime: new Date()
        });
      } catch (logErr) {
        console.error('Failed to log call start:', logErr);
      }

      // 3. Bind Sockets Receivers
      socketRef.current.on('user-connected', (userId) => {
        console.log(`Study peer joined call: ${userId}`);
        initiatePeerConnection(userId, stream);
      });

      socketRef.current.on('receive-signal', async (data) => {
        const { senderId, signalData } = data;
        
        if (signalData.sdp) {
          // Received SDP Offer or Answer
          if (signalData.sdp.type === 'offer') {
            await handleReceiveOffer(senderId, signalData.sdp, stream);
          } else if (signalData.sdp.type === 'answer') {
            await handleReceiveAnswer(signalData.sdp);
          }
        } else if (signalData.candidate) {
          // Received ICE Candidate
          await handleReceiveIceCandidate(signalData.candidate);
        }
      });

      socketRef.current.on('peer-left-call', () => {
        console.log('Peer left the call session');
        endCall();
      });

      socketRef.current.on('call-declined', () => {
        console.log('Peer declined the call');
        endCall();
      });

      socketRef.current.on('whiteboard-draw', (data) => {
        drawOnCanvas(data.x, data.y, data.prevX, data.prevY, data.color, data.size);
      });

      socketRef.current.on('whiteboard-clear', () => {
        clearLocalCanvas();
      });

    } catch (err) {
      console.error('Failed to boot call workspace:', err);
      stopOutgoingRingtone();
      if (err.name === 'NotAllowedError' || err.name === 'NotFoundError' || err.name === 'NotReadableError') {
        alert('Camera or Microphone access denied/unavailable. Please check your browser permissions.');
      }
      endCall();
    }
  };

  // --- WebRTC signaling logic ---
  const initiatePeerConnection = (targetUserId, stream) => {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    // Add local tracks to peer connection
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      stopOutgoingRingtone();
      setRemoteStream(event.streams[0]);
      setCallStartTime(prev => prev || new Date());
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Gather ICE candidates and relay
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('send-signal', {
          targetUserId,
          signalData: { candidate: event.candidate }
        });
      }
    };

    // Create SDP Offer
    pc.createOffer().then((offer) => {
      pc.setLocalDescription(offer).then(() => {
        socketRef.current.emit('send-signal', {
          targetUserId,
          signalData: { sdp: offer }
        });
      });
    });
  };

  const handleReceiveOffer = async (senderId, offer, stream) => {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.ontrack = (event) => {
      stopOutgoingRingtone();
      setRemoteStream(event.streams[0]);
      setCallStartTime(prev => prev || new Date());
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('send-signal', {
          targetUserId: senderId,
          signalData: { candidate: event.candidate }
        });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socketRef.current.emit('send-signal', {
      targetUserId: senderId,
      signalData: { sdp: answer }
    });
  };

  const handleReceiveAnswer = async (answer) => {
    if (peerConnectionRef.current) {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleReceiveIceCandidate = async (candidate) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    }
  };

  // --- Whiteboard drawing logic ---
  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = getCoordinates(nativeEvent);

    const prevX = contextRef.current.currentX || offsetX;
    const prevY = contextRef.current.currentY || offsetY;

    drawOnCanvas(offsetX, offsetY, prevX, prevY, color, brushSize);

    // Save previous
    contextRef.current.currentX = offsetX;
    contextRef.current.currentY = offsetY;

    // Relay to socket peers (throttled to 25ms to ensure high sync resolution)
    if (!drawThrottler.current) {
      drawThrottler.current = true;
      socketRef.current.emit('whiteboard-draw', {
        roomId,
        x: offsetX,
        y: offsetY,
        prevX,
        prevY,
        color,
        size: brushSize
      });
      setTimeout(() => {
        drawThrottler.current = false;
      }, 25);
    }
  };

  const stopDrawing = () => {
    if (contextRef.current) {
      contextRef.current.currentX = null;
      contextRef.current.currentY = null;
    }
    setIsDrawing(false);
  };

  const getCoordinates = (event) => {
    if (event.touches && event.touches.length > 0) {
      const rect = event.target.getBoundingClientRect();
      return {
        offsetX: event.touches[0].clientX - rect.left,
        offsetY: event.touches[0].clientY - rect.top
      };
    }
    return {
      offsetX: event.offsetX,
      offsetY: event.offsetY
    };
  };

  const drawOnCanvas = (x, y, prevX, prevY, brushColor, brushWidth) => {
    const context = contextRef.current;
    if (!context) return;

    context.beginPath();
    context.strokeStyle = brushColor;
    context.lineWidth = brushWidth;
    context.moveTo(prevX, prevY);
    context.lineTo(x, y);
    context.stroke();
    context.closePath();
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleClearWhiteboard = () => {
    clearLocalCanvas();
    if (socketRef.current) {
      socketRef.current.emit('whiteboard-clear', { roomId });
    }
  };

  // Toggle Video / Audio channels
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoOn(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioOn(audioTrack.enabled);
      }
    }
  };

  // Screen Sharing
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Replace track in peer connection
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        }

        // Replace track in local video
        if (localVideoRef.current) {
          const audioTracks = localStream ? localStream.getAudioTracks() : [];
          localVideoRef.current.srcObject = new MediaStream([screenTrack, ...audioTracks]);
        }

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Failed to start screen share', err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (peerConnectionRef.current) {
        const sender = peerConnectionRef.current.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }
    }
    setIsScreenSharing(false);
  };

  // Terminate Calls
  const endCall = () => {
    stopOutgoingRingtone();
    if (socketRef.current && roomId) {
      socketRef.current.emit('leave-call', { roomId });
    }

    if (callStartTime && roomId && roomId !== 'Workspace-StudySession') {
      const isVideo = location.state?.startVideo ?? true;
      const typeText = isVideo ? 'Video Call' : 'Audio Call';
      
      socketRef.current?.emit('end-call-history', {
        roomId,
        callerId: user._id,
        durationText: `${typeText} - ${callDuration}`
      });
    }

    setInCall(false);
    
    // Stop local media
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
      setLocalStream(null);
    }
    setRemoteStream(null);

    // Close peer connections
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-dark-950 text-slate-800 dark:text-slate-100 transition-colors duration-300 flex flex-col h-screen overflow-hidden">
      
      {!inCall ? (
        /* Onboarding Setup Screen */
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass p-8 rounded-2xl border border-white/20 shadow-xl space-y-6 text-center">
            <div className="inline-flex p-3.5 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Workspace Study Calls</h2>
              <p className="text-xs text-slate-400 mt-1">Host private video sessions and shared interactive whiteboards.</p>
            </div>
            
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Study Room Name / Code</label>
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <Link to="/dashboard" className="flex-1 py-2.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5">
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <button
                onClick={startCall}
                className="flex-1 py-2.5 bg-gradient-purple text-white font-bold rounded-xl text-xs shadow-md hover:shadow-lg flex items-center justify-center space-x-1.5"
              >
                <span>Launch call</span>
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Fullscreen Call Workspace Grid */
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          
          {/* Left panel: Video Streams grid */}
          <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-dark-900 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-slate-400">
              <span className="flex items-center space-x-1.5">
                <Users className="w-4 h-4 text-primary-500" />
                <span>Studio Peer Feeds</span>
              </span>
              <div className="flex items-center space-x-2">
                {callStartTime && (
                  <span className="flex items-center space-x-1 text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-dark-800 px-2 py-0.5 rounded-full font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{callDuration}</span>
                  </span>
                )}
                <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">Call Active</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-center">
              
              {/* Local video capsule */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-dark-950 shadow-sm border border-slate-200 dark:border-slate-800 aspect-video flex items-center justify-center">
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                <span className="absolute bottom-3 left-3 text-[10px] bg-black/60 text-white py-0.5 px-2 rounded-md font-semibold backdrop-blur-sm">
                  {user.name} (You)
                </span>
                {!videoOn && (
                  <div className="absolute inset-0 bg-slate-900/90 flex items-center justify-center text-white text-xs">
                    Camera Off
                  </div>
                )}
              </div>

              {/* Remote video capsule */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-dark-950 shadow-sm border border-slate-200 dark:border-slate-800 aspect-video flex items-center justify-center">
                {remoteStream ? (
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center animate-pulse mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                      <Phone className="w-8 h-8 animate-bounce" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 tracking-wide">Ringing...</p>
                    <p className="text-xs text-slate-400 mt-1">Waiting for them to pick up</p>
                  </div>
                )}
                {remoteStream && (
                  <span className="absolute bottom-3 left-3 text-[10px] bg-black/60 text-white py-0.5 px-2 rounded-md font-semibold backdrop-blur-sm">
                    Study Peer
                  </span>
                )}
              </div>

            </div>

            {/* Video / Audio stream controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-dark-950/60 flex justify-center space-x-3">
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full shadow border transition-colors ${
                  videoOn 
                    ? 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-dark-900 dark:text-white border-slate-200 dark:border-slate-800' 
                    : 'bg-red-500 text-white border-red-500'
                }`}
                title={videoOn ? 'Mute Camera' : 'Unmute Camera'}
              >
                {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full shadow border transition-colors ${
                  audioOn 
                    ? 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-dark-900 dark:text-white border-slate-200 dark:border-slate-800' 
                    : 'bg-red-500 text-white border-red-500'
                }`}
                title={audioOn ? 'Mute Mic' : 'Unmute Mic'}
              >
                {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleScreenShare}
                className={`p-3 rounded-full shadow border transition-colors ${
                  isScreenSharing 
                    ? 'bg-primary-500 text-white border-primary-500' 
                    : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-dark-900 dark:text-white border-slate-200 dark:border-slate-800'
                }`}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <MonitorUp className="w-5 h-5" />
              </button>

              <button
                onClick={endCall}
                className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow border border-red-600 transition-colors"
                title="Hang Up call"
              >
                <PhoneOff className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right panel: Collaborative Whiteboard */}
          <div className="flex-1 bg-slate-100 dark:bg-dark-950 flex flex-col overflow-hidden">
            <div className="p-4 bg-white dark:bg-dark-900 border-b border-slate-200 dark:border-slate-800/80 flex justify-between items-center z-10 shadow-sm">
              <div className="flex items-center space-x-2">
                <Palette className="w-5 h-5 text-primary-500" />
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Collaborative Whiteboard Canvas</h3>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Palette picker */}
                <div className="flex items-center space-x-1.5">
                  {['#8b5cf6', '#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#000000'].map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-6 h-6 rounded-full border border-white hover:scale-110 active:scale-95 transition-all shadow-sm ${
                        color === c ? 'ring-2 ring-primary-500 ring-offset-2' : ''
                      }`}
                    />
                  ))}
                </div>

                <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

                {/* Clear canvas */}
                <button
                  onClick={handleClearWhiteboard}
                  className="py-1.5 px-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-bold flex items-center space-x-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Eraser className="w-4 h-4" />
                  <span>Clear canvas</span>
                </button>
              </div>
            </div>

            {/* Main Interactive whiteboard draw area */}
            <div className="flex-1 bg-white relative dark:bg-slate-950 overflow-hidden">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                className="whiteboard-canvas bg-white dark:bg-slate-900 w-full h-full block"
              />
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
