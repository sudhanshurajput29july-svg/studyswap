const express = require('express');
const router = express.Router();
const {
  getOrCreateRoom,
  getUserRooms,
  getRoomMessages,
  uploadFile
} = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.post('/room', protect, getOrCreateRoom);
router.get('/rooms', protect, getUserRooms);
router.get('/rooms/:roomId/messages', protect, getRoomMessages);
router.post('/rooms/:roomId/upload', protect, upload.single('file'), uploadFile);

module.exports = router;
