import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Modern syntax for Mongoose 6+ and Node 22
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    // Suggestion: Check if IP is whitelisted in Atlas Network Access
    process.exit(1);
  }
};

export default connectDB;