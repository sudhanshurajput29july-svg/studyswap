const express = require('express');
const router = express.Router();
const {
  sendConnectionRequest,
  acceptConnectionRequest,
  rejectConnectionRequest,
  getConnectionsList
} = require('../controllers/connectionController');
const { protect } = require('../middlewares/auth');

router.get('/list', protect, getConnectionsList);
router.post('/request/:id', protect, sendConnectionRequest);
router.put('/accept/:id', protect, acceptConnectionRequest);
router.put('/reject/:id', protect, rejectConnectionRequest);

module.exports = router;
