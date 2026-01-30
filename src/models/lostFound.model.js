import mongoose from 'mongoose';

const lostFoundSchema = new mongoose.Schema(
  {
    itemName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['ELECTRONICS', 'DOCUMENTS', 'ACCESSORIES', 'CLOTHING', 'KEYS', 'OTHER'],
      required: true,
    },
    type: {
      type: String,
      enum: ['LOST', 'FOUND'],
      required: true,
    },
    
    // Location
    location: {
      type: String,
      required: true,
    },
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
    },
    
    // Dates
    dateLostFound: {
      type: Date,
      required: true,
    },
    
    // Reporter
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Media
    imageUrl: String,
    
    // Contact
    contactPhone: String,
    contactEmail: String,
    
    // Claim
    status: {
      type: String,
      enum: ['OPEN', 'CLAIMED', 'CLOSED'],
      default: 'OPEN',
    },
    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    claimedAt: Date,
    verificationInfo: String,
  },
  {
    timestamps: true,
  }
);

lostFoundSchema.index({ reporter: 1 });
lostFoundSchema.index({ status: 1 });
lostFoundSchema.index({ type: 1 });
lostFoundSchema.index({ category: 1 });

export default mongoose.model('LostFound', lostFoundSchema);