const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reason: {
    type: String,
    required: true,
    enum: ['Harassment', 'Spam', 'Inappropriate Content', 'Fake Listing', 'Other']
  },
  details: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Reviewed', 'Actioned'],
    default: 'Pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);
