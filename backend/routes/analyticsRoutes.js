const express = require('express');
const router = express.Router();
const { getUserAnalytics } = require('../controllers/analyticsController');
const { protect } = require('../middlewares/auth');

router.get('/', protect, getUserAnalytics);

module.exports = router;
