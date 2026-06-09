const express = require('express');
const router = express.Router();
const { getRecommendations } = require('../controllers/matchingController');
const { protect } = require('../middlewares/auth');

router.get('/recommendations', protect, getRecommendations);

module.exports = router;
