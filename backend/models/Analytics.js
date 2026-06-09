const mongoose = require('mongoose');

const AnalyticsSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  learningHours: { type: Number, default: 0 },
  teachingHours: { type: Number, default: 0 },
  reputationGrowth: [{
    date: { type: Date, default: Date.now },
    score: { type: Number }
  }],
  subjectProgress: [{
    subject: { type: String },
    masteryPercentage: { type: Number, default: 0 }
  }],
  weeklyActivity: [{
    day: { type: String }, // e.g. "Mon", "Tue"
    hours: { type: Number, default: 0 }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Analytics', AnalyticsSchema);
