const express = require('express');
const router = express.Router();
const { 
  updateProfile, 
  getUserProfile, 
  getUsers, 
  getLeaderboard, 
  updateLocation,
  blockUser,
  unblockUser,
  getBlockedUsers,
  reportUser,
  submitReview,
  getUserReviews
} = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.get('/', protect, getUsers);
router.get('/leaderboard', protect, getLeaderboard);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.put('/location', protect, updateLocation);

// Safety & Moderation
router.get('/blocked', protect, getBlockedUsers);
router.post('/block/:id', protect, blockUser);
router.post('/unblock/:id', protect, unblockUser);
router.post('/report/:id', protect, reportUser);

// Ratings & Reviews
router.post('/:id/reviews', protect, submitReview);
router.get('/:id/reviews', protect, getUserReviews);

router.get('/:id', protect, getUserProfile);

module.exports = router;
