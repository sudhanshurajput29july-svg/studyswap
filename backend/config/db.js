const mongoose = require('mongoose');

let mongodInstance = null;
const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      // Try to use in-memory MongoDB for local development when no MONGO_URI provided.
      // If the package isn't available (not installed), skip DB connection gracefully.
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create();
        mongoUri = mongodInstance.getUri();
        console.log('No MONGO_URI found — using in-memory MongoDB');
      } catch (e) {
        console.warn('No MONGO_URI and mongodb-memory-server not installed; skipping DB connect. Some features may not work.');
        return;
      }
    }

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

// Ensure in-memory server is stopped on exit
process.on('SIGINT', async () => {
  try {
    if (mongodInstance) await mongodInstance.stop();
  } catch (e) {
    // ignore
  }
  process.exit(0);
});

module.exports = connectDB;
