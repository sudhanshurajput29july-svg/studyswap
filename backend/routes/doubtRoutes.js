const express = require('express');
const router = express.Router();
const {
  createQuestion,
  getQuestions,
  addAnswer,
  upvoteQuestion,
  upvoteAnswer,
  acceptAnswer
} = require('../controllers/doubtController');
const { protect } = require('../middlewares/auth');

router.post('/', protect, createQuestion);
router.get('/', protect, getQuestions);
router.post('/:id/answers', protect, addAnswer);
router.put('/:id/upvote', protect, upvoteQuestion);
router.put('/:id/answers/:answerId/upvote', protect, upvoteAnswer);
router.put('/:id/answers/:answerId/accept', protect, acceptAnswer);

module.exports = router;
