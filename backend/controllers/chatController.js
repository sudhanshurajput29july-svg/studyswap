const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const User = require('../models/User');
const Connection = require('../models/Connection');

// @desc    Get or Create Direct or Group Chat Room
// @route   POST /api/chats/room
// @access  Private
exports.getOrCreateRoom = async (req, res) => {
  try {
    const { recipientId, isGroup, name } = req.body;

    // 1-on-1 Chat Room logic
    if (!isGroup) {
      if (!recipientId) {
        return res.status(400).json({ success: false, message: 'Please provide recipientId for direct chat' });
      }

      // Check if room already exists for these two participants
      let room = await ChatRoom.findOne({
        isGroup: false,
        participants: { $all: [req.user.id, recipientId], $size: 2 }
      }).populate('participants', 'name profile role reputation');

      if (!room) {
        // Create new room
        room = await ChatRoom.create({
          isGroup: false,
          participants: [req.user.id, recipientId]
        });
        room = await room.populate('participants', 'name profile role reputation');
      }

      return res.status(200).json({ success: true, data: room });
    }

    // Group Chat Room logic
    if (isGroup) {
      const { participants = [] } = req.body;
      
      // Force current user into participants list
      const allParticipants = Array.from(new Set([...participants, req.user.id]));

      const room = await ChatRoom.create({
        isGroup: true,
        name: name || 'Group Study Workspace',
        participants: allParticipants,
        groupAdmin: req.user.id
      });

      const populatedRoom = await room.populate('participants', 'name profile role reputation');

      return res.status(201).json({ success: true, data: populatedRoom });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Chat Rooms of Authenticated Student
// @route   GET /api/chats/rooms
// @access  Private
exports.getUserRooms = async (req, res) => {
  try {
    // Check all accepted connections and ensure 1-on-1 ChatRooms exist
    const acceptedConnections = await Connection.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: 'accepted'
    });

    for (const conn of acceptedConnections) {
      const peerId = conn.requester.toString() === req.user.id ? conn.recipient : conn.requester;
      const existingRoom = await ChatRoom.findOne({
        isGroup: false,
        participants: { $all: [req.user.id, peerId], $size: 2 }
      });

      if (!existingRoom) {
        await ChatRoom.create({
          isGroup: false,
          participants: [req.user.id, peerId]
        });
      }
    }

    const rooms = await ChatRoom.find({
      participants: req.user.id
    })
    .populate('participants', 'name profile role reputation')
    .populate('groupAdmin', 'name')
    .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Retrieve Room Messages (Paginated)
// @route   GET /api/chats/rooms/:roomId/messages
// @access  Private
exports.getRoomMessages = async (req, res) => {
  try {
    const { roomId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const skip = (page - 1) * limit;

    // Confirm participant status
    const room = await ChatRoom.findOne({ _id: roomId, participants: req.user.id });
    if (!room) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view this room history' });
    }

    const messages = await Message.find({ chatRoom: roomId })
      .populate('sender', 'name profile role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages.reverse() // Render chronologically on frontend
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload Notes or PDFs to Cloudinary for Chat Sharing
// @route   POST /api/chats/rooms/:roomId/upload
// @access  Private
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { messageType = 'notes' } = req.body;
    const fileUrl = req.file.path || req.file.filename;

    res.status(200).json({
      success: true,
      data: {
        fileUrl: fileUrl,
        fileName: req.file.originalname,
        messageType: messageType
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete Workspace Chat Room
// @route   DELETE /api/chats/rooms/:roomId
// @access  Private
exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findOne({ _id: roomId, participants: req.user.id });
    if (!room) {
      return res.status(404).json({ success: false, message: 'Workspace chat room not found or unauthorized' });
    }

    // Delete associated messages and room
    await Message.deleteMany({ chatRoom: roomId });
    await ChatRoom.findByIdAndDelete(roomId);

    res.status(200).json({
      success: true,
      message: 'Workspace chat room deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

