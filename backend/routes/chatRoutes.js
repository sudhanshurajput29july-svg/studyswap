const express = require('express');
const router = express.Router();
const {
  getOrCreateRoom,
  getUserRooms,
  getRoomMessages,
  uploadFile,
  deleteRoom
} = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.post('/room', protect, getOrCreateRoom);
router.get('/rooms', protect, getUserRooms);
router.get('/rooms/:roomId/messages', protect, getRoomMessages);
router.post('/rooms/:roomId/upload', protect, upload.single('file'), uploadFile);
router.delete('/rooms/:roomId', protect, deleteRoom);

module.exports = router;

