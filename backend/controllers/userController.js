const User = require('../models/User');
const Connection = require('../models/Connection');
const Report = require('../models/Report');
const Review = require('../models/Review');

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
      let avatarUrl = req.file.path;
      if (!avatarUrl || (!avatarUrl.startsWith('http://') && !avatarUrl.startsWith('https://'))) {
        avatarUrl = `/uploads/${req.file.filename}`;
      }
      user.profile.avatar = avatarUrl;
    }

    await user.save();

    // Trigger auto-connections based on strengths/weaknesses matching
    const io = req.app.get('io');
    await autoConnectMatchingPeers(user, io);

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

// Helper to automatically trigger connection requests for matching strengths/weaknesses
async function autoConnectMatchingPeers(currentUser, io) {
  try {
    const strengths = (currentUser.profile?.strengths || []).map(s => s.trim().toLowerCase());
    const weaknesses = (currentUser.profile?.weaknesses || []).map(w => w.trim().toLowerCase());

    if (strengths.length === 0 && weaknesses.length === 0) return;

    // Retrieve all other users
    const candidates = await User.find({
      _id: { $ne: currentUser._id }
    });

    for (const candidate of candidates) {
      const candStrengths = (candidate.profile?.strengths || []).map(s => s.trim().toLowerCase());
      const candWeaknesses = (candidate.profile?.weaknesses || []).map(w => w.trim().toLowerCase());

      // Check if candidate can teach us (candidate's strength is in our weakness)
      const canTeachUs = candStrengths.some(s => weaknesses.includes(s));
      // Check if we can teach candidate (candidate's weakness is in our strength)
      const canWeTeach = candWeaknesses.some(w => strengths.includes(w));

      if (canTeachUs || canWeTeach) {
        // Check if connection record already exists
        const existingConnection = await Connection.findOne({
          $or: [
            { requester: currentUser._id, recipient: candidate._id },
            { requester: candidate._id, recipient: currentUser._id }
          ]
        });

        if (!existingConnection) {
          // Create pending connection from current user to candidate
          const newConnection = await Connection.create({
            requester: currentUser._id,
            recipient: candidate._id,
            status: 'pending'
          });

          const populated = await newConnection.populate('requester', 'name profile reputation');
          
          if (io) {
            io.to(candidate._id.toString()).emit('new-connection-request', populated);
          }
        }
      }
    }
  } catch (error) {
    console.error('Auto-Connect Error:', error.message);
  }
}

// @desc    Update User Location Coordinates
// @route   PUT /api/users/location
// @access  Private
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ success: false, message: 'Please provide latitude and longitude coordinates' });
    }
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.location = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };
    await user.save();
    res.status(200).json({ success: true, message: 'Location updated successfully', data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Block a user
// @route   POST /api/users/block/:id
// @access  Private
exports.blockUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    if (targetUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot block yourself' });
    }

    const user = await User.findById(req.user.id);
    if (!user.blockedUsers.includes(targetUserId)) {
      user.blockedUsers.push(targetUserId);
      await user.save();
    }

    res.status(200).json({ success: true, message: 'User blocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unblock a user
// @route   POST /api/users/unblock/:id
// @access  Private
exports.unblockUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await User.findById(req.user.id);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== targetUserId);
    await user.save();

    res.status(200).json({ success: true, message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get blocked users list
// @route   GET /api/users/blocked
// @access  Private
exports.getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('blockedUsers', 'name email profile');
    res.status(200).json({ success: true, data: user.blockedUsers || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Report a user
// @route   POST /api/users/report/:id
// @access  Private
exports.reportUser = async (req, res) => {
  try {
    const reportedUserId = req.params.id;
    const { reason, details } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Please provide a reason for reporting' });
    }

    const report = await Report.create({
      reporter: req.user.id,
      reportedUser: reportedUserId,
      reason,
      details: details || ''
    });

    res.status(201).json({ success: true, message: 'Report submitted successfully', data: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit a review for a user
// @route   POST /api/users/:id/reviews
// @access  Private
exports.submitReview = async (req, res) => {
  try {
    const reviewedUserId = req.params.id;
    const { rating, comment } = req.body;

    if (!rating || !comment) {
      return res.status(400).json({ success: false, message: 'Please provide rating and comment' });
    }

    if (reviewedUserId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot review yourself' });
    }

    const review = await Review.create({
      reviewer: req.user.id,
      reviewedUser: reviewedUserId,
      rating: Number(rating),
      comment
    });

    // Recalculate average rating and update reputation.score
    const reviews = await Review.find({ reviewedUser: reviewedUserId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    const user = await User.findById(reviewedUserId);
    if (user) {
      user.reputation.score = parseFloat(avgRating.toFixed(1));
      await user.save();
    }

    res.status(201).json({ success: true, message: 'Review submitted successfully', data: review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user reviews list
// @route   GET /api/users/:id/reviews
// @access  Private
exports.getUserReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ reviewedUser: req.params.id })
      .populate('reviewer', 'name profile')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

