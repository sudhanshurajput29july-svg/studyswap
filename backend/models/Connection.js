const mongoose = require('mongoose');

const ConnectionSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  type: { type: String, enum: ['connect', 'book'], default: 'connect' },
  bookTitle: { type: String, default: '' }
}, { timestamps: true });

ConnectionSchema.index({ requester: 1, recipient: 1 });
module.exports = mongoose.model('Connection', ConnectionSchema);
