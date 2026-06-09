const Connection = require('../models/Connection');
const User = require('../models/User');
const ChatRoom = require('../models/ChatRoom');

// @desc    Send Connection Request / Follow User
// @route   POST /api/connections/request/:id
// @access  Private
exports.sendConnectionRequest = async (req, res) => {
  try {
    const targetUserId = req.params.id;

    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot connect with yourself' });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target student not found' });
    }

    // Check if connection already exists
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

    // Create pending connection
    const newConnection = await Connection.create({
      requester: req.user.id,
      recipient: targetUserId,
      status: 'pending'
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

    // Mutually add to followers & following lists
    await User.findByIdAndUpdate(connection.requester, {
      $addToSet: { followers: connection.recipient, following: connection.recipient }
    });
    await User.findByIdAndUpdate(connection.recipient, {
      $addToSet: { followers: connection.requester, following: connection.requester }
    });

    // Auto-create a 1-on-1 Chat Room
    const chatRoom = await ChatRoom.create({
      isGroup: false,
      participants: [connection.requester, connection.recipient]
    });

    const io = req.app.get('io');
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
