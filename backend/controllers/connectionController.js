const Connection = require('../models/Connection');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');

// @desc    Send Connection Request / Follow User
// @route   POST /api/connections/request/:id
// @access  Private
exports.sendConnectionRequest = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { type = 'connect', bookTitle = '' } = req.body;

    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot connect with yourself' });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target student not found' });
    }

    // Check if connection already exists (Only for standard connect requests)
    if (type !== 'book') {
      let existingConnection = await Connection.findOne({
        $or: [
          { requester: req.user.id, recipient: targetUserId },
          { requester: targetUserId, recipient: req.user.id }
        ]
      });

      if (existingConnection) {
        return res.status(400).json({
          success: false,
          message: 'Connection record or request already exists between these students',
          status: existingConnection.status
        });
      }
    }

    // Create pending connection
    const newConnection = await Connection.create({
      requester: req.user.id,
      recipient: targetUserId,
      status: 'pending',
      type: type,
      bookTitle: bookTitle
    });

    const populatedConnection = await newConnection.populate('requester', 'name profile reputation');

    // Emit real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId.toString()).emit('new-connection-request', populatedConnection);
    }

    res.status(201).json({
      success: true,
      message: 'Connection request sent successfully',
      data: newConnection
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Accept Connection Request
// @route   PUT /api/connections/accept/:id
// @access  Private
exports.acceptConnectionRequest = async (req, res) => {
  try {
    const connectionId = req.params.id;

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }

    // Confirm that the recipient of the request is accepting it
    if (connection.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to accept this request' });
    }

    connection.status = 'accepted';
    await connection.save();

    // Log in Exchange History if connection is for a book swap
    if (connection.type === 'book') {
      const Book = require('../models/Book');
      const ExchangeHistory = require('../models/ExchangeHistory');
      
      const matchedBook = await Book.findOne({
        title: connection.bookTitle,
        owner: connection.recipient
      });

      const { meetupLocation } = req.body;

      if (matchedBook) {
        matchedBook.status = 'Exchanged';
        await matchedBook.save();

        await ExchangeHistory.create({
          bookTitle: connection.bookTitle,
          listingType: matchedBook.listingType || 'Exchange',
          price: matchedBook.price || 0,
          owner: connection.recipient,
          recipient: connection.requester,
          meetupLocation: meetupLocation || 'Library'
        });
      } else {
        await ExchangeHistory.create({
          bookTitle: connection.bookTitle,
          listingType: 'Exchange',
          price: 0,
          owner: connection.recipient,
          recipient: connection.requester,
          meetupLocation: meetupLocation || 'Library'
        });
      }
    }

    // Mutually add to followers & following lists
    await User.findByIdAndUpdate(connection.requester, {
      $addToSet: { followers: connection.recipient, following: connection.recipient }
    });
    await User.findByIdAndUpdate(connection.recipient, {
      $addToSet: { followers: connection.requester, following: connection.requester }
    });

    const { meetupLocation } = req.body;

    // Auto-create a 1-on-1 Chat Room (if it does not exist)
    const isBookExchange = connection.type === 'book';

    let chatRoom = await ChatRoom.findOne({
      isGroup: false,
      participants: { $all: [connection.requester, connection.recipient], $size: 2 },
      isBookExchange
    });

    if (!chatRoom) {
      chatRoom = await ChatRoom.create({
        isGroup: false,
        participants: [connection.requester, connection.recipient],
        isBookExchange
      });
    }

    const io = req.app.get('io');

    if (meetupLocation) {
      const Message = require('../models/Message');
      const savedMsg = await Message.create({
        sender: req.user.id,
        chatRoom: chatRoom._id,
        messageType: 'text',
        content: `🤝 [MEETUP CONFIRMED] I've accepted your request. Let's meet at: "${meetupLocation}" to exchange the book!`
      });

      const populatedMsg = await savedMsg.populate('sender', 'name profile role');

      if (io) {
        io.to(chatRoom._id.toString()).emit('receive-message', populatedMsg);
      }
    }
    if (io) {
      io.to(connection.requester.toString()).emit('connection-accepted', {
        connectionId: connection._id,
        recipientId: connection.recipient,
        chatRoomId: chatRoom._id
      });
    }

    res.status(200).json({
      success: true,
      message: 'Connection request accepted. You are now study peers!',
      data: connection
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject Connection Request
// @route   PUT /api/connections/reject/:id
// @access  Private
exports.rejectConnectionRequest = async (req, res) => {
  try {
    const connectionId = req.params.id;

    const connection = await Connection.findById(connectionId);
    if (!connection) {
      return res.status(404).json({ success: false, message: 'Connection request not found' });
    }

    if (connection.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not authorized to reject this request' });
    }

    connection.status = 'rejected';
    await connection.save();

    res.status(200).json({
      success: true,
      message: 'Connection request rejected',
      data: connection
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get List of Connections, Pending Requests, and Followers
// @route   GET /api/connections/list
// @access  Private
exports.getConnectionsList = async (req, res) => {
  try {
    // 1. Get accepted connections
    const acceptedConnections = await Connection.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }],
      status: 'accepted'
    })
    .populate('requester', 'name profile reputation')
    .populate('recipient', 'name profile reputation');

    const peers = acceptedConnections.map(conn => {
      return conn.requester._id.toString() === req.user.id ? conn.recipient : conn.requester;
    });

    // 2. Get incoming pending requests
    const incomingPending = await Connection.find({
      recipient: req.user.id,
      status: 'pending'
    }).populate('requester', 'name profile reputation');

    // 3. Get outgoing pending requests
    const outgoingPending = await Connection.find({
      requester: req.user.id,
      status: 'pending'
    }).populate('recipient', 'name profile reputation');

    res.status(200).json({
      success: true,
      data: {
        peers,
        incomingRequests: incomingPending,
        outgoingRequests: outgoingPending
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
