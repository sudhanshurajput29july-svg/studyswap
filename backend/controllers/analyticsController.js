const Analytics = require('../models/Analytics');

// @desc    Get Current User's Study/Tutoring Analytics
// @route   GET /api/analytics
// @access  Private
exports.getUserAnalytics = async (req, res) => {
  try {
    let analytics = await Analytics.findOne({ user: req.user.id });

    if (!analytics) {
      // Create a default analytics portfolio if it doesn't exist
      analytics = await Analytics.create({
        user: req.user.id,
        learningHours: 12,
        teachingHours: 8,
        reputationGrowth: [
          { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), score: 10 },
          { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), score: 30 },
          { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), score: 70 },
          { date: new Date(), score: req.user.reputation?.score || 100 }
        ],
        subjectProgress: [
          { subject: 'JavaScript', masteryPercentage: 80 },
          { subject: 'Node.js', masteryPercentage: 60 },
          { subject: 'Calculus', masteryPercentage: 40 },
          { subject: 'Algebra', masteryPercentage: 90 }
        ],
        weeklyActivity: [
          { day: 'Mon', hours: 2.5 },
          { day: 'Tue', hours: 4 },
          { day: 'Wed', hours: 1.5 },
          { day: 'Thu', hours: 3 },
          { day: 'Fri', hours: 5 },
          { day: 'Sat', hours: 2 },
          { day: 'Sun', hours: 1 }
        ]
      });
    }

    res.status(200).json({ success: true, data: analytics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
