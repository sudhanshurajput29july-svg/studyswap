const User = require('../models/User');

// @desc    Update User Profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, college, course, strengths, weaknesses, learningGoals } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Handle updates
    if (name) user.name = name;
    
    // Parse arrays in case they were sent as stringified JSON or comma-separated strings
    const parseArray = (input) => {
      if (!input) return [];
      if (Array.isArray(input)) return input;
      try {
        return JSON.parse(input);
      } catch (e) {
        return input.split(',').map(s => s.trim()).filter(Boolean);
      }
    };

    user.profile.bio = bio !== undefined ? bio : user.profile.bio;
    user.profile.college = college !== undefined ? college : user.profile.college;
    user.profile.course = course !== undefined ? course : user.profile.course;
    
    if (strengths) user.profile.strengths = parseArray(strengths);
    if (weaknesses) user.profile.weaknesses = parseArray(weaknesses);
    if (learningGoals) user.profile.learningGoals = parseArray(learningGoals);

    // If file uploaded (profile image)
    if (req.file) {
      // If Cloudinary is used, req.file.path holds the remote secure url.
      // Otherwise (fallback local storage), we generate a path.
      user.profile.avatar = req.file.path || req.file.filename;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Detailed User Profile
// @route   GET /api/users/:id
// @access  Private
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('followers', 'name profile')
      .populate('following', 'name profile');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search and Filter Users
// @route   GET /api/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const { search, strength, weakness, course, role } = req.query;
    const query = { _id: { $ne: req.user.id } }; // Exclude active user

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'profile.college': { $regex: search, $options: 'i' } },
        { 'profile.course': { $regex: search, $options: 'i' } }
      ];
    }

    if (strength) {
      query['profile.strengths'] = { $in: strength.split(',').map(s => new RegExp(s.trim(), 'i')) };
    }

    if (weakness) {
      query['profile.weaknesses'] = { $in: weakness.split(',').map(w => new RegExp(w.trim(), 'i')) };
    }

    if (course) {
      query['profile.course'] = { $regex: course, $options: 'i' };
    }

    if (role) {
      query.role = role;
    }

    const users = await User.find(query).select('name email role profile reputation');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Leaderboard sorted by reputation points
// @route   GET /api/users/leaderboard
// @access  Private
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.find()
      .select('name role profile reputation')
      .sort({ 'reputation.score': -1 })
      .limit(20);

    res.status(200).json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
