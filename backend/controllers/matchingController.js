const User = require('../models/User');
const Connection = require('../models/Connection');

// @desc    Get recommended study matches
// @route   GET /api/matching/recommendations
// @access  Private
exports.getRecommendations = async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { strengths = [], weaknesses = [], college = '', course = '' } = currentUser.profile;

    // Retrieve all connection records involving current user
    const userConnections = await Connection.find({
      $or: [{ requester: req.user.id }, { recipient: req.user.id }]
    });

    const connectionMap = {};
    userConnections.forEach(conn => {
      const otherId = conn.requester.toString() === req.user.id ? conn.recipient.toString() : conn.requester.toString();
      connectionMap[otherId] = conn.status;
    });

    // Retrieve all other users
    const candidates = await User.find({ _id: { $ne: req.user.id } })
      .select('name role profile reputation');

    const recommendations = [];

    // Calculate match scores
    candidates.forEach((candidate) => {
      const candProfile = candidate.profile || {};
      const candStrengths = candProfile.strengths || [];
      const candWeaknesses = candProfile.weaknesses || [];
      const candCollege = candProfile.college || '';
      const candCourse = candProfile.course || '';

      let score = 0;
      const overlapsTeachLearn = []; // Strengths candidate has that current user wants to learn
      const overlapsLearnTeach = []; // Weaknesses candidate has that current user can teach

      // 1. Check what the candidate can teach us (Intersection of candidate's strengths and current user's weaknesses)
      candStrengths.forEach((subject) => {
        if (weaknesses.some(w => w.toLowerCase() === subject.toLowerCase())) {
          score += 15; // Teach weight
          overlapsTeachLearn.push(subject);
        }
      });

      // 2. Check what we can teach the candidate (Intersection of candidate's weaknesses and current user's strengths)
      candWeaknesses.forEach((subject) => {
        if (strengths.some(s => s.toLowerCase() === subject.toLowerCase())) {
          score += 15; // Learn weight
          overlapsLearnTeach.push(subject);
        }
      });

      // 3. College boost
      if (college && candCollege && college.toLowerCase() === candCollege.toLowerCase()) {
        score += 5;
      }

      // 4. Course boost
      if (course && candCourse && course.toLowerCase() === candCourse.toLowerCase()) {
        score += 5;
      }

      // Always include candidates for discovery, even if match score is 0
      recommendations.push({
        user: candidate,
        matchScore: score,
        matchingTeach: overlapsTeachLearn,
        matchingLearn: overlapsLearnTeach,
        sameCollege: college && candCollege && college.toLowerCase() === candCollege.toLowerCase(),
        sameCourse: course && candCourse && course.toLowerCase() === candCourse.toLowerCase(),
        connectionStatus: connectionMap[candidate._id.toString()] || 'none'
      });
    });

    // Sort by match score in descending order
    recommendations.sort((a, b) => b.matchScore - a.matchScore);

    res.status(200).json({
      success: true,
      count: recommendations.length,
      data: recommendations
    });
  } catch (error) {
    console.error('Matching Recommendations Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

