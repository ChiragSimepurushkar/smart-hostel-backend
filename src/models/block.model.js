import mongoose from 'mongoose';

const blockSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
    },
    floorCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

blockSchema.index({ hostel: 1, name: 1 }, { unique: true });

export default mongoose.model('Block', blockSchema);