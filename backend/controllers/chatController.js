const ChatRoom = require('../models/ChatRoom');
const Message = require('../models/Message');
const User = require('../models/User');
const Connection = require('../models/Connection');

// @desc    Get or Create Direct or Group Chat Room
// @route   POST /api/chats/room
// @access  Private
exports.getOrCreateRoom = async (req, res) => {
  try {
    const { recipientId, isGroup, name, isBookExchange, bookId } = req.body;

    // 1-on-1 Chat Room logic
    if (!isGroup) {
      if (!recipientId) {
        return res.status(400).json({ success: false, message: 'Please provide recipientId for direct chat' });
      }

      // Check if room already exists for these two participants
      let room = await ChatRoom.findOne({
        isGroup: false,
        participants: { $all: [req.user.id, recipientId], $size: 2 },
        isBookExchange: isBookExchange || false,
        book: bookId || null
      }).populate('participants', 'name profile role reputation').populate('book');

      if (!room) {
        // Create new room
        room = await ChatRoom.create({
          isGroup: false,
          participants: [req.user.id, recipientId],
          isBookExchange: isBookExchange || false,
          book: bookId || null
        });
        room = await room.populate('participants', 'name profile role reputation');
        room = await room.populate('book');
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

    const currentUser = await User.findById(req.user.id);
    const blockedByMe = currentUser.blockedUsers || [];
    const usersWhoBlockedMe = await User.find({ blockedUsers: req.user.id }).select('_id');
    const blockedMeIds = usersWhoBlockedMe.map(u => u._id);
    const allBlockedIds = [...blockedByMe, ...blockedMeIds];

    const isBookQuery = req.query.type === 'book';

    const rooms = await ChatRoom.find({
      participants: req.user.id,
      participants: { $nin: allBlockedIds },
      isBookExchange: isBookQuery ? true : { $ne: true }
    })
    .populate('participants', 'name profile role reputation')
    .populate('groupAdmin', 'name')
    .populate('book')
    .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all messages in room as seen
// @route   PUT /api/chats/rooms/:roomId/seen
// @access  Private
exports.markRoomMessagesAsSeen = async (req, res) => {
  try {
    const { roomId } = req.params;
    await Message.updateMany(
      { chatRoom: roomId, sender: { $ne: req.user.id } },
      { seen: true }
    );

    // Socket broadcast
    const io = req.app.get('io');
    io.to(roomId).emit('messages-seen', { roomId, readerId: req.user.id });

    res.status(200).json({ success: true, message: 'Messages marked as seen' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a negotiation proposal status (Accept/Reject/Counter)
// @route   PUT /api/chats/messages/:messageId/proposal
// @access  Private
exports.updateProposalStatus = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status, price } = req.body; // 'accepted', 'rejected', 'countered'

    const message = await Message.findById(messageId).populate('chatRoom');
    if (!message || message.messageType !== 'proposal') {
      return res.status(404).json({ success: false, message: 'Proposal message not found' });
    }

    // Verify participant
    if (!message.chatRoom.participants.includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    message.proposal.proposalStatus = status;
    if (price !== undefined) {
      message.proposal.price = price;
    }
    await message.save();

    const populatedMsg = await message.populate('sender', 'name profile role');

    const io = req.app.get('io');
    io.to(message.chatRoom._id.toString()).emit('proposal-updated', populatedMsg);

    // If accepted, execute exchange updates
    if (status === 'accepted') {
      const Book = require('../models/Book');
      const ExchangeHistory = require('../models/ExchangeHistory');

      const room = message.chatRoom;
      if (room && room.book) {
        const book = await Book.findById(room.book);
        if (book) {
          book.status = 'Exchanged';
          await book.save();

          // Log in Exchange History
          const recipientId = room.participants.find(p => p.toString() !== book.owner.toString());
          await ExchangeHistory.create({
            bookTitle: book.title,
            listingType: book.listingType || 'Exchange',
            price: price || book.price || 0,
            owner: book.owner,
            recipient: recipientId || req.user.id,
            meetupLocation: message.proposal.location || 'Library'
          });
        }
      }
    }

    res.status(200).json({ success: true, data: populatedMsg });
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
    
    let fileUrl = req.file.path;
    if (!fileUrl || (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://'))) {
      fileUrl = `/uploads/${req.file.filename}`;
    }

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

// @desc    Post Message (REST fallback, e.g. for system integrations/book requests)
// @route   POST /api/chats/rooms/:roomId/messages
// @access  Private
exports.createMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { content, messageType } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }

    const room = await ChatRoom.findOne({ _id: roomId, participants: req.user.id });
    if (!room) {
      return res.status(403).json({ success: false, message: 'You are not authorized to send messages to this room' });
    }

    const savedMsg = await Message.create({
      sender: req.user.id,
      chatRoom: roomId,
      messageType: messageType || 'text',
      content: content
    });

    const populatedMsg = await savedMsg.populate('sender', 'name profile role');

    // Notify any active sockets in the room
    const io = req.app.get('io');
    if (io) {
      io.to(roomId).emit('receive-message', populatedMsg);
    }

    res.status(201).json({ success: true, data: populatedMsg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

