const express = require('express');
const router = express.Router();
const { createPost, getPosts, likePost, commentPost } = require('../controllers/postController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.post('/', protect, upload.single('file'), createPost);
router.get('/', protect, getPosts);
router.post('/:id/like', protect, likePost);
router.post('/:id/comment', protect, commentPost);

module.exports = router;
