const express = require('express');
const router = express.Router();
const {
  getOrCreateRoom,
  getUserRooms,
  getRoomMessages,
  uploadFile,
  deleteRoom,
  createMessage,
  markRoomMessagesAsSeen,
  updateProposalStatus
} = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.post('/room', protect, getOrCreateRoom);
router.get('/rooms', protect, getUserRooms);
router.get('/rooms/:roomId/messages', protect, getRoomMessages);
router.post('/rooms/:roomId/messages', protect, createMessage);
router.post('/rooms/:roomId/upload', protect, upload.single('file'), uploadFile);
router.delete('/rooms/:roomId', protect, deleteRoom);
router.put('/rooms/:roomId/seen', protect, markRoomMessagesAsSeen);
router.put('/messages/:messageId/proposal', protect, updateProposalStatus);

module.exports = router;
