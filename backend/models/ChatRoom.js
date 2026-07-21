const mongoose = require('mongoose');

const ChatRoomSchema = new mongoose.Schema({
  isGroup: { type: Boolean, default: false },
  name: { type: String, default: '' }, // For group chats
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  groupAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isBookExchange: { type: Boolean, default: false },
  book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' }
}, { timestamps: true });

module.exports = mongoose.model('ChatRoom', ChatRoomSchema);
