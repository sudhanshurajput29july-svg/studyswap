const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  chatRoom: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom', required: true },
  messageType: { type: String, enum: ['text', 'image', 'pdf', 'notes', 'call', 'proposal'], default: 'text' },
  content: { type: String, required: true },
  fileUrl: { type: String }, // For file/PDF/notes sharing
  fileName: { type: String },
  seen: { type: Boolean, default: false },
  proposal: {
    location: { type: String },
    dateTime: { type: String },
    price: { type: Number },
    proposalStatus: { type: String, enum: ['pending', 'accepted', 'rejected', 'countered'] }
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
