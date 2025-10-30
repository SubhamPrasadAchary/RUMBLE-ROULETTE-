const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    console.log('Connecting to MongoDB...');
    
    // Use the connection string from environment variables
    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'rumble-roulette' // Specify the database name
    });
    
    console.log('✅ MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

module.exports = connectDB;
