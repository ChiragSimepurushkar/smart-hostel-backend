import mongoose from 'mongoose';

const hostelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    location: String,
    totalBlocks: {
      type: Number,
      default: 0,
    },
    capacity: Number,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Hostel', hostelSchema);