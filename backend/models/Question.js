const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  subject: { type: String, required: true, index: true },
  upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  answers: [{
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isAccepted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],
  isSolved: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Question', QuestionSchema);
