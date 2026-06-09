const express = require('express');
const router = express.Router();
const { logCall, getCallHistory } = require('../controllers/callController');
const { protect } = require('../middlewares/auth');

router.post('/log', protect, logCall);
router.get('/history', protect, getCallHistory);

module.exports = router;
