const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const Analytics = require('../models/Analytics');

const rawBackendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
const backendUrl = rawBackendUrl.replace(/\/+$/, '');

module.exports = function (passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID || 'DUMMY_CLIENT_ID',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'DUMMY_CLIENT_SECRET',
        callbackURL: `${backendUrl}/api/auth/google/callback`,
        proxy: true
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
          if (!email) {
            return done(new Error('No email found in Google profile'), null);
          }

          const lowercaseEmail = email.toLowerCase();

          // Check if user already exists
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email: lowercaseEmail }]
          });

          if (user) {
            // Update googleId if not present (case where email matched but they signed up with password previously)
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
            }
            return done(null, user);
          }

          // Create new user if not exists
          user = await User.create({
            name: profile.displayName || profile.name.givenName || 'Google User',
            email: lowercaseEmail,
            googleId: profile.id,
            role: 'Student',
            profile: {
              avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
              bio: 'Learning and sharing on StudySwap!',
              college: '',
              course: '',
              strengths: [],
              weaknesses: [],
              learningGoals: []
            }
          });

          // Create Analytics document for new user
          await Analytics.create({
            user: user._id,
            reputationGrowth: [{ date: new Date(), score: 0 }],
            weeklyActivity: [
              { day: 'Mon', hours: 0 },
              { day: 'Tue', hours: 0 },
              { day: 'Wed', hours: 0 },
              { day: 'Thu', hours: 0 },
              { day: 'Fri', hours: 0 },
              { day: 'Sat', hours: 0 },
              { day: 'Sun', hours: 0 }
            ]
          });

          return done(null, user);
        } catch (err) {
          console.error('Passport Google OAuth Error:', err);
          return done(err, null);
        }
      }
    )
  );
};
