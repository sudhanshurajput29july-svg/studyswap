const mongoose = require('mongoose');

let mongodInstance = null;
const connectDB = async () => {
  let mongoUri = process.env.MONGO_URI;

  try {
    if (!mongoUri) {
      // Try to use in-memory MongoDB for local development when no MONGO_URI provided.
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodInstance = await MongoMemoryServer.create();
      mongoUri = mongodInstance.getUri();
      console.log('No MONGO_URI found — using in-memory MongoDB');
    }

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.warn(`Primary database connection error (${error.message}). Trying fallback to in-memory MongoDB...`);
    try {
      // If we haven't already created one, try spinning it up now
      if (!mongodInstance) {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        mongodInstance = await MongoMemoryServer.create();
        mongoUri = mongodInstance.getUri();
      }
      
      // Close previous connection attempt just in case
      await mongoose.disconnect();
      
      const conn = await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log(`Fallback in-memory MongoDB Connected: ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error(`Database fallback connection error: ${fallbackError.message}`);
      process.exit(1);
    }
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
