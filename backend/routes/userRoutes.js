const express = require('express');
const router = express.Router();
const { updateProfile, getUserProfile, getUsers, getLeaderboard } = require('../controllers/userController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.get('/', protect, getUsers);
router.get('/leaderboard', protect, getLeaderboard);
router.put('/profile', protect, upload.single('avatar'), updateProfile);
router.get('/:id', protect, getUserProfile);

module.exports = router;
