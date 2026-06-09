const Question = require('../models/Question');
const User = require('../models/User');

// Helper to recalculate user reputation mentor levels
const updateUserReputation = async (userId, scoreDelta, badgeReward) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.reputation.score = Math.max(0, user.reputation.score + scoreDelta);

    // Dynamic Level Up
    const score = user.reputation.score;
    if (score < 100) {
      user.reputation.mentorLevel = 'Novice';
    } else if (score < 500) {
      user.reputation.mentorLevel = 'Sage';
    } else if (score < 1000) {
      user.reputation.mentorLevel = 'Expert';
    } else {
      user.reputation.mentorLevel = 'Legend';
    }

    if (badgeReward && !user.reputation.badges.includes(badgeReward)) {
      user.reputation.badges.push(badgeReward);
    }

    await user.save();
  } catch (err) {
    console.error('Gamification Engine reputation update failed:', err);
  }
};

// @desc    Ask a Question
// @route   POST /api/doubts
// @access  Private
exports.createQuestion = async (req, res) => {
  try {
    const { title, content, subject } = req.body;

    if (!title || !content || !subject) {
      return res.status(400).json({ success: false, message: 'Please provide title, content, and subject' });
    }

    const question = await Question.create({
      author: req.user.id,
      title,
      content,
      subject
    });

    const populatedQuestion = await question.populate('author', 'name profile reputation');

    res.status(201).json({ success: true, data: populatedQuestion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Questions with filters
// @route   GET /api/doubts
// @access  Private
exports.getQuestions = async (req, res) => {
  try {
    const { subject, isSolved } = req.query;
    const query = {};

    if (subject) {
      query.subject = { $regex: subject, $options: 'i' };
    }

    if (isSolved !== undefined) {
      query.isSolved = isSolved === 'true';
    }

    const questions = await Question.find(query)
      .populate('author', 'name profile reputation')
      .populate('answers.author', 'name profile reputation')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: questions.length, data: questions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Submit Answer to Question
// @route   POST /api/doubts/:id/answers
// @access  Private
exports.addAnswer = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Please enter answer text' });
    }

    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    question.answers.push({
      author: req.user.id,
      content
    });

    await question.save();

    const updatedQuestion = await Question.findById(req.params.id)
      .populate('author', 'name profile reputation')
      .populate('answers.author', 'name profile reputation');

    res.status(201).json({ success: true, data: updatedQuestion });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upvote Question
// @route   PUT /api/doubts/:id/upvote
// @access  Private
exports.upvoteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const isUpvoted = question.upvotes.includes(req.user.id);
    if (isUpvoted) {
      question.upvotes = question.upvotes.filter(id => id.toString() !== req.user.id);
    } else {
      question.upvotes.push(req.user.id);
    }

    await question.save();
    res.status(200).json({ success: true, count: question.upvotes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upvote Answer (+10 points to author)
// @route   PUT /api/doubts/:id/answers/:answerId/upvote
// @access  Private
exports.upvoteAnswer = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    const answer = question.answers.id(req.params.answerId);
    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    const isUpvoted = answer.upvotes.includes(req.user.id);
    if (isUpvoted) {
      answer.upvotes = answer.upvotes.filter(id => id.toString() !== req.user.id);
      // Revert reputation
      await updateUserReputation(answer.author, -10, null);
    } else {
      answer.upvotes.push(req.user.id);
      // Reward reputation
      await updateUserReputation(answer.author, 10, 'Helpful Hand');
    }

    await question.save();
    res.status(200).json({ success: true, count: answer.upvotes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark Answer Accepted (+50 points to author)
// @route   PUT /api/doubts/:id/answers/:answerId/accept
// @access  Private
exports.acceptAnswer = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found' });
    }

    if (question.author.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only question author can accept answers' });
    }

    const answer = question.answers.id(req.params.answerId);
    if (!answer) {
      return res.status(404).json({ success: false, message: 'Answer not found' });
    }

    if (answer.isAccepted) {
      return res.status(400).json({ success: false, message: 'Answer already accepted' });
    }

    // Set all answers to false, accept this one
    question.answers.forEach(ans => {
      ans.isAccepted = false;
    });
    answer.isAccepted = true;
    question.isSolved = true;

    await question.save();

    // Reward points for helping
    await updateUserReputation(answer.author, 50, 'Doubt Destroyer');

    res.status(200).json({ success: true, message: 'Answer marked as accepted. Peer rewarded!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
