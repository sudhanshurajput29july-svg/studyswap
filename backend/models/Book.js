const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  author: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  genre: {
    type: String,
    trim: true,
    default: ''
  },
  condition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Poor'],
    default: 'Good'
  },
  status: {
    type: String,
    enum: ['Available', 'Reserved', 'Exchanged', 'Unavailable'],
    default: 'Available'
  },
  listingType: {
    type: String,
    enum: ['Exchange', 'Sell', 'Donate'],
    default: 'Exchange'
  },
  price: {
    type: Number,
    default: 0
  },
  image: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Book', BookSchema);
