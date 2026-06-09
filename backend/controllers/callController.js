const CallHistory = require('../models/CallHistory');

// @desc    Log Call History Item
// @route   POST /api/calls/log
// @access  Private
exports.logCall = async (req, res) => {
  try {
    const { roomName, participants, durationMinutes, startTime } = req.body;

    if (!roomName || !startTime) {
      return res.status(400).json({ success: false, message: 'Please provide roomName and startTime' });
    }

    const call = await CallHistory.create({
      roomName,
      participants: participants || [req.user.id],
      durationMinutes: durationMinutes || 0,
      startTime,
      endTime: new Date()
    });

    res.status(201).json({ success: true, data: call });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Current User's Call Histories
// @route   GET /api/calls/history
// @access  Private
exports.getCallHistory = async (req, res) => {
  try {
    const history = await CallHistory.find({
      participants: req.user.id
    })
    .populate('participants', 'name profile')
    .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
