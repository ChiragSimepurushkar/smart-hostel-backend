import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['MAINTENANCE', 'FOOD', 'EVENT', 'EMERGENCY', 'GENERAL'],
      default: 'GENERAL',
    },
    
    // Targeting
    targetHostels: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
    }],
    targetBlocks: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
    }],
    targetRole: {
      type: String,
      enum: ['STUDENT', 'MANAGEMENT', 'ALL'],
      default: 'ALL',
    },
    
    // Creator
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    
    // Status
    isPinned: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    
    // Attachments
    attachments: [String],
    
    // Analytics
    viewCount: {
      type: Number,
      default: 0,
    },
    
    // Scheduling
    publishAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

announcementSchema.index({ createdBy: 1 });
announcementSchema.index({ publishAt: -1 });
announcementSchema.index({ category: 1 });

export default mongoose.model('Announcement', announcementSchema);