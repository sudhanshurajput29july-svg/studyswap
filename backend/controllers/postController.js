const Post = require('../models/Post');

// @desc    Create Social Feed Post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ success: false, message: 'Please provide content for post' });
    }

    let mediaUrl = '';
    let mediaType = 'none';

    if (req.file) {
      let url = req.file.path;
      if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        url = `/uploads/${req.file.filename}`;
      }
      mediaUrl = url;
      mediaType = req.file.mimetype === 'application/pdf' ? 'pdf' : 'image';
    }

    const post = await Post.create({
      author: req.user.id,
      content,
      mediaUrl,
      mediaType
    });

    const populatedPost = await post.populate('author', 'name profile reputation');

    res.status(201).json({ success: true, data: populatedPost });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get All Feed Posts
// @route   GET /api/posts
// @access  Private
exports.getPosts = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'name profile reputation')
      .populate('comments.user', 'name profile')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: posts.length, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Like / Unlike Post
// @route   POST /api/posts/:id/like
// @access  Private
exports.likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const isLiked = post.likes.includes(req.user.id);

    if (isLiked) {
      // Unlike
      post.likes = post.likes.filter((like) => like.toString() !== req.user.id);
    } else {
      // Like
      post.likes.push(req.user.id);
    }

    await post.save();

    res.status(200).json({
      success: true,
      likesCount: post.likes.length,
      isLiked: !isLiked
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add Comment to Post
// @route   POST /api/posts/:id/comment
// @access  Private
exports.commentPost = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ success: false, message: 'Please enter a comment' });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    post.comments.push({
      user: req.user.id,
      content: content
    });

    await post.save();
    
    const updatedPost = await Post.findById(req.params.id)
      .populate('comments.user', 'name profile');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: updatedPost.comments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
