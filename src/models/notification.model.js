import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'ISSUE_CREATED',
        'ISSUE_ASSIGNED',
        'ISSUE_STATUS_UPDATED',
        'ISSUE_COMMENTED',
        'ANNOUNCEMENT_POSTED',
        'LOST_FOUND_MATCH',
        'SYSTEM',
      ],
      required: true,
    },
    
    // Related entity
    entityType: String, // issue, announcement, lost_found
    entityId: mongoose.Schema.Types.ObjectId,
    
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: Date,
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ user: 1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ createdAt: -1 });

export default mongoose.model('Notification', notificationSchema);