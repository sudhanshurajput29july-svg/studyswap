require('dotenv').config();
const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');

// Initialize database
connectDB();

const app = express();
const server = http.createServer(app);

// CORS config
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Body parser
app.use(express.json());

// Custom simple cookie parser middleware
app.use((req, res, next) => {
  req.cookies = {};
  const rawCookies = req.headers.cookie;
  if (rawCookies) {
    rawCookies.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts.length >= 2) {
        req.cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
      }
    });
  }
  next();
});

// Socket.IO setup
const io = socketio(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible in controllers
app.set('io', io);

// Import socket event handlers
// We will build socket listeners in later phases, but let's mount standard room managers
io.on('connection', (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  // Register user for private notifications
  socket.on('register-user', (userId) => {
    if (userId) {
      socket.join(userId.toString());
      console.log(`Socket ${socket.id} registered for user room ${userId.toString()}`);
    }
  });

  // Join Room Event
  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined room ${roomId}`);
  });

  // Join Chat Room
  socket.on('join-chat', (roomId) => {
    socket.join(roomId);
    console.log(`User socket ${socket.id} joined chat room ${roomId}`);
  });

  // Real-time Chat message
  socket.on('send-message', async (data) => {
    try {
      const { chatRoomId, senderId, content, messageType, fileUrl, fileName } = data;
      
      // Save Message to DB
      const Message = require('./models/Message');
      const savedMsg = await Message.create({
        sender: senderId,
        chatRoom: chatRoomId,
        messageType: messageType || 'text',
        content: content,
        fileUrl: fileUrl,
        fileName: fileName
      });

      const populatedMsg = await savedMsg.populate('sender', 'name profile role');

      // Broadcast to all participants in the room
      io.to(chatRoomId).emit('receive-message', populatedMsg);
    } catch (err) {
      console.error('Socket send-message error:', err.message);
    }
  });

  // Relay initiate call notification
  socket.on('initiate-call', async (data) => {
    try {
      const { roomId, callerId, callerName, callType } = data;
      const ChatRoom = require('./models/ChatRoom');
      const room = await ChatRoom.findById(roomId);
      if (room && room.participants) {
        room.participants.forEach((participantId) => {
          if (participantId.toString() !== callerId.toString()) {
            io.to(participantId.toString()).emit('incoming-call', data);
          }
        });
      }
    } catch (err) {
      console.error('Socket initiate-call error:', err.message);
    }
  });

  // Relay decline call event
  socket.on('decline-call', async (data) => {
    try {
      const { roomId } = data;
      io.to(roomId).emit('call-declined');
    } catch (err) {
      console.error('Socket decline-call error:', err.message);
    }
  });

  // Relay leave call event
  socket.on('leave-call', (data) => {
    const { roomId } = data;
    if (roomId) {
      socket.to(roomId).emit('peer-left-call');
    }
  });

  // Save Call History message
  socket.on('end-call-history', async (data) => {
    try {
      const { roomId, callerId, durationText } = data;
      const Message = require('./models/Message');
      const savedMsg = await Message.create({
        sender: callerId,
        chatRoom: roomId,
        messageType: 'call',
        content: durationText
      });
      const populatedMsg = await savedMsg.populate('sender', 'name profile role');
      io.to(roomId).emit('receive-message', populatedMsg);
    } catch (err) {
      console.error('Socket end-call-history error:', err.message);
    }
  });

  // WebRTC Call Session Room join
  socket.on('join-call', (roomId) => {
    socket.join(roomId);
    console.log(`Socket ${socket.id} joined call room ${roomId}`);
    // Broadcast user-connected to all other participants in the room
    socket.to(roomId).emit('user-connected', socket.id);
  });

  // Relay WebRTC Peer signaling data (sdp offers, answers, ice-candidates)
  socket.on('send-signal', (data) => {
    const { targetUserId, signalData } = data;
    io.to(targetUserId).emit('receive-signal', {
      senderId: socket.id,
      signalData: signalData
    });
  });

  // Shared Whiteboard state synchronization coordinates
  socket.on('whiteboard-draw', (data) => {
    const { roomId } = data;
    socket.to(roomId).emit('whiteboard-draw', data);
  });

  // Shared Whiteboard canvas clear trigger
  socket.on('whiteboard-clear', (data) => {
    const { roomId } = data;
    socket.to(roomId).emit('whiteboard-clear');
  });

  socket.on('disconnect', () => {
    console.log(`Socket Disconnected: ${socket.id}`);
  });
});

// Mount Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/matching', require('./routes/matchingRoutes'));
app.use('/api/connections', require('./routes/connectionRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));
app.use('/api/calls', require('./routes/callRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/doubts', require('./routes/doubtRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'StudySwap Backend API is healthy and active' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.message);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`StudySwap Server running on port ${PORT}`);
});
