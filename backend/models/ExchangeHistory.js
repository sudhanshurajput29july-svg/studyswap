const mongoose = require('mongoose');

const ExchangeHistorySchema = new mongoose.Schema({
  bookTitle: {
    type: String,
    required: true,
    trim: true
  },
  listingType: {
    type: String,
    enum: ['Exchange', 'Sell', 'Donate'],
    required: true
  },
  price: {
    type: Number,
    default: 0
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  meetupLocation: {
    type: String,
    default: ''
  },
  completedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ExchangeHistory', ExchangeHistorySchema);
