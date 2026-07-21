const Book = require('../models/Book');
const User = require('../models/User');
const ExchangeHistory = require('../models/ExchangeHistory');

// Helper to calculate distance in km between two [lon, lat] coordinates (Haversine formula)
const calculateDistance = (coord1, coord2) => {
  if (!coord1 || !coord2 || coord1.length < 2 || coord2.length < 2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(2)); // Return distance in km with 2 decimals
};

// @desc    Add a book listing
// @route   POST /api/books
// @access  Private
exports.createBook = async (req, res) => {
  try {
    const { title, author, description, genre, condition, listingType, price } = req.body;
    if (!title || !author) {
      return res.status(400).json({ success: false, message: 'Please provide book title and author' });
    }

    let imageUrl = '';
    if (req.file) {
      imageUrl = req.file.path;
      if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
        imageUrl = `/uploads/${req.file.filename}`;
      }
    }

    const book = await Book.create({
      owner: req.user.id,
      title,
      author,
      description,
      genre,
      condition,
      listingType: listingType || 'Exchange',
      price: listingType === 'Sell' ? (Number(price) || 0) : 0,
      image: imageUrl
    });

    res.status(201).json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user's book listings
// @route   GET /api/books/my
// @access  Private
exports.getMyBooks = async (req, res) => {
  try {
    const books = await Book.find({ owner: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: books });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get nearby book listings from other students
// @route   GET /api/books/nearby
// @access  Private
exports.getNearbyBooks = async (req, res) => {
  try {
    const maxDistance = parseInt(req.query.maxDistance) || 15000; // default 15km

    // 1. Get current user profile for location info
    const currentUser = await User.findById(req.user.id);
    if (!currentUser || !currentUser.location || !currentUser.location.coordinates || currentUser.location.coordinates[0] === 0) {
      return res.status(200).json({ 
        success: true, 
        locationRequired: true, 
        message: 'Location required to search nearby books.',
        data: [] 
      });
    }

    // 2. Find nearby users using geospatial `$near` query on index, with JS distance fallback
    let nearbyUsers = [];
    try {
      nearbyUsers = await User.find({
        _id: { $ne: req.user.id },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: currentUser.location.coordinates
            },
            $maxDistance: maxDistance
          }
        }
      }).select('_id name profile location reputation');
    } catch (geoError) {
      console.warn('Geospatial index query failed, falling back to in-memory distance calculations:', geoError.message);
      // Fallback: fetch all active students and calculate distance in Javascript
      const otherUsers = await User.find({
        _id: { $ne: req.user.id },
        'location.coordinates': { $exists: true }
      }).select('_id name profile location reputation');

      nearbyUsers = otherUsers.filter(user => {
        if (!user.location || !user.location.coordinates || user.location.coordinates[0] === 0) return false;
        const dist = calculateDistance(currentUser.location.coordinates, user.location.coordinates);
        // maxDistance is in meters, calculateDistance returns km
        return dist !== null && dist <= (maxDistance / 1000);
      });
    }

    if (!nearbyUsers || nearbyUsers.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    const nearbyUserIds = nearbyUsers.map(user => user._id);

    // Filter out blocked relationships (mutual exclusion)
    const blockedByMe = currentUser.blockedUsers || [];
    const usersWhoBlockedMe = await User.find({ blockedUsers: req.user.id }).select('_id');
    const blockedMeIds = usersWhoBlockedMe.map(u => u._id);

    // 3. Find books belonging to these users
    const books = await Book.find({
      owner: { 
        $in: nearbyUserIds, 
        $nin: [...blockedByMe, ...blockedMeIds] 
      },
      status: { $in: ['Available', 'Reserved', 'Exchanged'] }
    }).populate('owner', 'name profile location reputation');

    // Calculate distance and format response
    const booksWithDistance = books.map(book => {
      const bookObj = book.toObject();
      if (book.owner && book.owner.location && book.owner.location.coordinates) {
        bookObj.distance = calculateDistance(currentUser.location.coordinates, book.owner.location.coordinates);
      } else {
        bookObj.distance = null;
      }
      return bookObj;
    });

    // Sort by distance ascending
    booksWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));

    res.status(200).json({ success: true, data: booksWithDistance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a book listing
// @route   PUT /api/books/:id
// @access  Private
exports.updateBook = async (req, res) => {
  try {
    const { title, author, description, genre, condition, status } = req.body;
    let book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Check ownership
    if (book.owner.toString() !== req.user.id) {
      if (status === 'Reserved' && book.status === 'Available') {
        book.status = 'Reserved';
        await book.save();
        return res.status(200).json({ success: true, data: book });
      }
      return res.status(403).json({ success: false, message: 'Unauthorized to modify this listing' });
    }

    const oldStatus = book.status;
    book.title = title || book.title;
    book.author = author || book.author;
    book.description = description !== undefined ? description : book.description;
    book.genre = genre !== undefined ? genre : book.genre;
    book.condition = condition || book.condition;
    book.status = status || book.status;

    if (req.file) {
      let imageUrl = req.file.path;
      if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
        imageUrl = `/uploads/${req.file.filename}`;
      }
      book.image = imageUrl;
    }

    await book.save();

    // Log in Exchange History if manually marked as Exchanged
    if (status === 'Exchanged' && oldStatus !== 'Exchanged') {
      const Connection = require('../models/Connection');
      const lastConnection = await Connection.findOne({
        bookTitle: book.title,
        recipient: req.user.id,
        type: 'book'
      }).sort({ createdAt: -1 });

      const recipientId = lastConnection ? lastConnection.requester : req.user.id;

      await ExchangeHistory.create({
        bookTitle: book.title,
        listingType: book.listingType || 'Exchange',
        price: book.price || 0,
        owner: req.user.id,
        recipient: recipientId,
        meetupLocation: 'Campus'
      });
    }
    res.status(200).json({ success: true, data: book });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a book listing
// @route   DELETE /api/books/:id
// @access  Private
exports.deleteBook = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    // Check ownership
    if (book.owner.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to delete this listing' });
    }

    await book.deleteOne();
    res.status(200).json({ success: true, message: 'Book listing removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user's exchange history
// @route   GET /api/books/exchange-history
// @access  Private
exports.getExchangeHistory = async (req, res) => {
  try {
    const history = await ExchangeHistory.find({
      $or: [
        { owner: req.user.id },
        { recipient: req.user.id }
      ]
    })
    .populate('owner', 'name profile')
    .populate('recipient', 'name profile')
    .sort({ completedAt: -1 });

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
