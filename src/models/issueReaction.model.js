// models/issueReaction.model.js
import mongoose from 'mongoose';

const issueReactionSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['thumbs_up', 'thumbs_down', 'fire'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: one user can only have one reaction of each type per issue
issueReactionSchema.index({ issue: 1, user: 1, type: 1 }, { unique: true });
issueReactionSchema.index({ issue: 1 });

export default mongoose.model('IssueReaction', issueReactionSchema);