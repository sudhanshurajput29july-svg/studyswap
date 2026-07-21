const express = require('express');
const router = express.Router();
const passport = require('passport');
const { register, login, logout, getMe, forgotPassword } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);

// Google OAuth Routes
router.get('/google/status', (req, res) => {
  const isConfigured = process.env.GOOGLE_CLIENT_ID && 
                       process.env.GOOGLE_CLIENT_ID !== 'DUMMY_CLIENT_ID' &&
                       process.env.GOOGLE_CLIENT_ID !== '' &&
                       process.env.GOOGLE_CLIENT_SECRET &&
                       process.env.GOOGLE_CLIENT_SECRET !== 'DUMMY_CLIENT_SECRET' &&
                       process.env.GOOGLE_CLIENT_SECRET !== '';
  res.status(200).json({
    success: true,
    configured: !!isConfigured
  });
});

router.get('/google', (req, res, next) => {
  const origin = req.query.origin || process.env.FRONTEND_URL || 'http://localhost:5173';
  
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'DUMMY_CLIENT_ID') {
    // Demo Mode: Bypass real Google redirect and simulate callback
    console.log('Using Mock Google OAuth Bypass (Client ID not configured)');
    
    const User = require('../models/User');
    const Analytics = require('../models/Analytics');
    const mockEmail = 'demo.google@gmail.com';
    
    User.findOne({ email: mockEmail })
      .then(async (user) => {
        if (!user) {
          user = await User.create({
            name: 'Demo Google User',
            email: mockEmail,
            googleId: 'google-mock-id-12345',
            role: 'Student',
            profile: {
              avatar: 'https://lh3.googleusercontent.com/a/default-user=s96-c',
              bio: 'Learning and sharing on StudySwap (Demo Mode)!',
              college: 'StudySwap University',
              course: 'Computer Science',
              strengths: ['React', 'NodeJS'],
              weaknesses: ['Algorithms'],
              learningGoals: ['System Design']
            }
          });
          
          await Analytics.create({
            user: user._id,
            reputationGrowth: [{ date: new Date(), score: 0 }],
            weeklyActivity: [
              { day: 'Mon', hours: 2 },
              { day: 'Tue', hours: 3 },
              { day: 'Wed', hours: 1 },
              { day: 'Thu', hours: 4 },
              { day: 'Fri', hours: 5 },
              { day: 'Sat', hours: 0 },
              { day: 'Sun', hours: 0 }
            ]
          });
        }
        
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
          expiresIn: process.env.JWT_EXPIRE || '30d'
        });
        
        const userPayload = JSON.stringify({
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          profile: user.profile,
          reputation: user.reputation
        });
        
        const encodedUser = encodeURIComponent(userPayload);
        const encodedToken = encodeURIComponent(token);
        res.redirect(`${origin}/oauth-success?token=${encodedToken}&user=${encodedUser}`);
      })
      .catch((err) => {
        console.error('Demo Google login error:', err);
        res.redirect(`${origin}/login?error=oauth_failed`);
      });
  } else {
    // Proceed with real Google OAuth redirect, serializing the origin in the state parameter
    const stateStr = JSON.stringify({ origin });
    passport.authenticate('google', { 
      scope: ['profile', 'email'],
      state: Buffer.from(stateStr).toString('base64')
    })(req, res, next);
  }
});

router.get(
  '/google/callback',
  (req, res, next) => {
    // Extract dynamic origin from Google state to handle dynamic failure redirection
    let targetOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (req.query.state) {
      try {
        const decodedState = Buffer.from(req.query.state, 'base64').toString('utf-8');
        const parsedState = JSON.parse(decodedState);
        if (parsedState.origin) {
          targetOrigin = parsedState.origin;
        }
      } catch (e) {
        console.error('Error parsing OAuth state for failure redirect:', e);
      }
    }
    
    passport.authenticate('google', { 
      failureRedirect: `${targetOrigin}/login?error=oauth_failed`, 
      session: false 
    })(req, res, next);
  },
  (req, res) => {
    // Generate JWT token on success
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '30d'
    });

    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (req.query.state) {
      try {
        const decodedState = Buffer.from(req.query.state, 'base64').toString('utf-8');
        const parsedState = JSON.parse(decodedState);
        if (parsedState.origin) {
          frontendUrl = parsedState.origin;
        }
      } catch (e) {
        console.error('Error parsing OAuth state for success redirect:', e);
      }
    }
    
    // Construct user info payload
    const userPayload = JSON.stringify({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      profile: req.user.profile,
      reputation: req.user.reputation
    });

    const encodedUser = encodeURIComponent(userPayload);
    const encodedToken = encodeURIComponent(token);
    res.redirect(`${frontendUrl}/oauth-success?token=${encodedToken}&user=${encodedUser}`);
  }
);

module.exports = router;
