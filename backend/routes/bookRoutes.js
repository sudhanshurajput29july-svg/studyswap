const express = require('express');
const router = express.Router();
const {
  createBook,
  getMyBooks,
  getNearbyBooks,
  updateBook,
  deleteBook,
  getExchangeHistory
} = require('../controllers/bookController');
const { protect } = require('../middlewares/auth');
const { upload } = require('../config/cloudinary');

router.route('/')
  .post(protect, upload.single('image'), createBook);

router.get('/my', protect, getMyBooks);
router.get('/nearby', protect, getNearbyBooks);
router.get('/exchange-history', protect, getExchangeHistory);

router.route('/:id')
  .put(protect, upload.single('image'), updateBook)
  .delete(protect, deleteBook);

module.exports = router;
