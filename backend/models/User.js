const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: function() { return !this.googleId; } },
  googleId: { type: String },
  role: { type: String, enum: ['Student', 'Mentor', 'Admin'], default: 'Student' },
  profile: {
    avatar: { type: String, default: '' },
    bio: { type: String, default: '' },
    college: { type: String, default: '' },
    course: { type: String, default: '' },
    strengths: [{ type: String, index: true }], // Indexed for smart matching
    weaknesses: [{ type: String, index: true }], // Indexed for smart matching
    learningGoals: [{ type: String }]
  },
  reputation: {
    score: { type: Number, default: 0 },
    badges: [{ type: String }],
    mentorLevel: { type: String, enum: ['Novice', 'Sage', 'Expert', 'Legend'], default: 'Novice' }
  },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  isVerified: { type: Boolean, default: false }
}, { timestamps: true });

UserSchema.index({ location: '2dsphere' });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
