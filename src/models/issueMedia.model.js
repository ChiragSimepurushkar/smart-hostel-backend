import mongoose from 'mongoose';

const issueMediaSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
    publicId: String, // Cloudinary public ID
  },
  {
    timestamps: true,
  }
);

issueMediaSchema.index({ issue: 1 });

export default mongoose.model('IssueMedia', issueMediaSchema);