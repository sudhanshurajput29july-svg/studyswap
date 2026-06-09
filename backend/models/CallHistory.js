const mongoose = require('mongoose');

const CallHistorySchema = new mongoose.Schema({
  roomName: { type: String, required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  durationMinutes: { type: Number, default: 0 },
  startTime: { type: Date, required: true },
  endTime: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('CallHistory', CallHistorySchema);
