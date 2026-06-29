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
  Loader,
  ZoomIn,
  ZoomOut,
  Minimize2,
  RotateCcw,
  X,
  User as UserIcon,
  Copy,
  Check
} from 'lucide-react';

export default function CallRoom() {
  const { user } = useSelector((state) => state.auth);
  const navigate = useNavigate();

  const location = useLocation();

  // Call session room id
  const [roomId, setRoomId] = useState(location.state?.roomId || 'Workspace-StudySession');
  const [inCall, setInCall] = useState(false);

  // User Media & Peer States
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoOn, setVideoOn] = useState(location.state?.startVideo ?? true);
  const [audioOn, setAudioOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [callDuration, setCallDuration] = useState('00:00');
  const [peersList, setPeersList] = useState([]);
  const [selectedPeerId, setSelectedPeerId] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const res = await API.get('/connections/list');
        setPeersList(res.data.data.peers || []);
      } catch (err) {
        console.error('Failed to fetch peers for study call setup:', err);
      }
    };
    fetchFriends();
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

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

  // Zoom Inspection States
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomingStream, setZoomingStream] = useState(null);
  const zoomedVideoRef = useRef(null);

  useEffect(() => {
    if (isZoomModalOpen && zoomedVideoRef.current && zoomingStream) {
      zoomedVideoRef.current.srcObject = zoomingStream;
    }
  }, [isZoomModalOpen, zoomingStream]);

  const openZoomInspection = (streamToInspect) => {
    setZoomingStream(streamToInspect || remoteStream || localStream);
    setZoomLevel(1);
    setIsZoomModalOpen(true);
  };

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
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' }
    ]
  };

  const iceCandidatesQueueRef = useRef([]);

  const processIceCandidatesQueue = async (pc) => {
    if (!pc) return;
    while (iceCandidatesQueueRef.current.length > 0) {
      const candidate = iceCandidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding queued ICE candidate:', e);
      }
    }
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
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: initialVideo,
            audio: true
          });
        } catch (mediaErr) {
          console.warn('Camera media acquisition failed, attempting audio-only fallback:', mediaErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });
          setVideoOn(false);
        }
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

      // Emit initiate call signal to target recipient if caller or selecting peer
      if ((location.state?.roomId && location.state?.isCaller === true) || selectedPeerId) {
        socketRef.current.emit('initiate-call', {
          roomId: callRoomId,
          callerId: user._id,
          callerName: user.name,
          callType: initialVideo ? 'video' : 'audio',
          targetUserId: selectedPeerId || null
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
    await processIceCandidatesQueue(pc);
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
      await processIceCandidatesQueue(peerConnectionRef.current);
    }
  };

  const handleReceiveIceCandidate = async (candidate) => {
    if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding ICE candidate:', e);
      }
    } else {
      iceCandidatesQueueRef.current.push(candidate);
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
          <div className="w-full max-w-lg glass p-8 rounded-3xl border border-white/20 shadow-2xl space-y-6 text-center">
            <div className="inline-flex p-4 bg-gradient-purple text-white rounded-2xl shadow-lg ring-4 ring-purple-500/20">
              <Video className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Workspace Study Calls</h2>
              <p className="text-xs text-slate-400 mt-1.5">Host private video sessions and shared interactive whiteboards with peers.</p>
            </div>

            <div className="space-y-4 text-left">
              {/* Room Code Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Study Room Name / Code</label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter custom room code"
                    className="w-full pl-4 pr-24 py-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm font-semibold text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="absolute right-2 px-3 py-1.5 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* Peer Invitation Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Invite Study Friend (Optional)</label>
                <select
                  value={selectedPeerId}
                  onChange={(e) => setSelectedPeerId(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none text-sm font-semibold text-slate-900 dark:text-white"
                >
                  <option value="">-- Direct Call / Broadcast to Room --</option>
                  {peersList.map((peer) => (
                    <option key={peer._id} value={peer._id}>
                      {peer.name} ({peer.role || 'Student'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Pre-Call Media Preferences */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Media Preferences</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setVideoOn(!videoOn)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-all ${videoOn
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-dark-900 text-slate-500 border-slate-200 dark:border-slate-800'
                      }`}
                  >
                    {videoOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                    <span>{videoOn ? 'Camera ON' : 'Camera OFF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudioOn(!audioOn)}
                    className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border transition-all ${audioOn
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        : 'bg-slate-100 dark:bg-dark-900 text-slate-500 border-slate-200 dark:border-slate-800'
                      }`}
                  >
                    {audioOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                    <span>{audioOn ? 'Mic ON' : 'Mic OFF'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <Link to="/dashboard" className="flex-1 py-3 bg-slate-100 dark:bg-dark-800 hover:bg-slate-200 dark:hover:bg-dark-750 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <button
                onClick={() => startCall()}
                className="flex-1 py-3 bg-gradient-purple text-white font-extrabold rounded-xl text-xs shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 transition-all hover:scale-[1.02] active:scale-95"
              >
                <span>Launch call</span>
                <Sparkles className="w-4 h-4 animate-spin-slow" />
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

              {/* Local video / audio capsule */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-lg border border-slate-800 aspect-video flex items-center justify-center group">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transform -scale-x-100 ${!videoOn ? 'hidden' : 'block'}`}
                />

                {!videoOn && (
                  <div className="flex flex-col items-center justify-center space-y-3 p-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-purple text-white font-extrabold flex items-center justify-center text-xl shadow-md ring-4 ring-purple-500/20 animate-pulse">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex items-center space-x-1.5 bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                      <MicOff className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-xs font-semibold text-slate-200">Camera Off</span>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10 pointer-events-none">
                  <span className="text-[10px] bg-black/60 text-white py-1 px-2.5 rounded-lg font-semibold backdrop-blur-md border border-white/10 shadow">
                    {user.name} (You)
                  </span>
                  {videoOn && localStream && (
                    <button
                      onClick={() => openZoomInspection(localStream)}
                      className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md border border-white/10 pointer-events-auto transition-all hover:scale-105"
                      title="Zoom & Inspect Feed"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Remote video / audio capsule */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-900 shadow-lg border border-slate-800 aspect-video flex items-center justify-center group">
                {remoteStream ? (
                  <>
                    <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover block" />
                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center z-10 pointer-events-none">
                      <span className="text-[10px] bg-black/60 text-white py-1 px-2.5 rounded-lg font-semibold backdrop-blur-md border border-white/10 shadow flex items-center space-x-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Study Peer</span>
                      </span>
                      <button
                        onClick={() => openZoomInspection(remoteStream)}
                        className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg backdrop-blur-md border border-white/10 pointer-events-auto transition-all hover:scale-105 flex items-center space-x-1"
                        title="Zoom / Fullscreen Screen Share"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span className="text-[9px] font-bold">Zoom</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center animate-pulse mb-3 shadow-[0_0_30px_rgba(16,185,129,0.2)] border border-emerald-500/20">
                      <Phone className="w-7 h-7 animate-bounce" />
                    </div>
                    <p className="text-xs font-bold text-white tracking-wide">Connecting Studio Peer...</p>
                    <p className="text-[10px] text-slate-400 mt-1">Ringing peer device</p>
                  </div>
                )}
              </div>

            </div>

            {/* Video / Audio stream controls */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-dark-950/60 flex justify-center space-x-3">
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-full shadow border transition-all ${videoOn
                    ? 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-dark-900 dark:text-white border-slate-200 dark:border-slate-800'
                    : 'bg-red-500 text-white border-red-500 animate-pulse'
                  }`}
                title={videoOn ? 'Turn Off Camera' : 'Turn On Camera'}
              >
                {videoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleAudio}
                className={`p-3 rounded-full shadow border transition-all ${audioOn
                    ? 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-dark-900 dark:text-white border-slate-200 dark:border-slate-800'
                    : 'bg-red-500 text-white border-red-500 animate-pulse'
                  }`}
                title={audioOn ? 'Mute Microphone' : 'Unmute Microphone'}
              >
                {audioOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleScreenShare}
                className={`p-3 rounded-full shadow border transition-all ${isScreenSharing
                    ? 'bg-primary-600 text-white border-primary-600 ring-2 ring-primary-500/50'
                    : 'bg-white hover:bg-slate-100 text-slate-700 dark:bg-dark-900 dark:text-white border-slate-200 dark:border-slate-800'
                  }`}
                title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
              >
                <MonitorUp className="w-5 h-5" />
              </button>

              {remoteStream && (
                <button
                  onClick={() => openZoomInspection(remoteStream)}
                  className="p-3 bg-white dark:bg-dark-900 text-slate-700 dark:text-white rounded-full shadow border border-slate-200 dark:border-slate-800 hover:bg-slate-100 transition-all"
                  title="Zoom & Inspect Screen Share"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
              )}

              <button
                onClick={endCall}
                className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow border border-red-600 transition-all active:scale-95"
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
                      className={`w-6 h-6 rounded-full border border-white hover:scale-110 active:scale-95 transition-all shadow-sm ${color === c ? 'ring-2 ring-primary-500 ring-offset-2' : ''
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

      {/* Screen Share Zoom & Inspection Modal */}
      {isZoomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col p-4">
          {/* Top Control Header */}
          <div className="flex justify-between items-center bg-dark-900/90 border border-slate-800 px-6 py-3 rounded-2xl shadow-xl z-20 mb-4">
            <div className="flex items-center space-x-3">
              <ZoomIn className="w-5 h-5 text-primary-400" />
              <span className="font-bold text-white text-sm">Screen Share Zoom Inspector</span>
              <span className="text-xs bg-primary-500/20 text-primary-400 font-mono px-2 py-0.5 rounded-md border border-primary-500/30">
                {Math.round(zoomLevel * 100)}% Zoom
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoomLevel(prev => Math.max(0.75, prev - 0.25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(prev => Math.min(3.5, prev + 0.25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsZoomModalOpen(false)}
                className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors ml-4"
                title="Close Inspection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Zoomable Video Stream Display */}
          <div className="flex-1 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 flex items-center justify-center relative p-4">
            <video
              ref={zoomedVideoRef}
              autoPlay
              playsInline
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}

    </div>
  );
}
