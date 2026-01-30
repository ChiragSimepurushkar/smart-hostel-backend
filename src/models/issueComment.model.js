import mongoose from 'mongoose';

const issueCommentSchema = new mongoose.Schema(
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
    comment: {
      type: String,
      required: true,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IssueComment',
    },
  },
  {
    timestamps: true,
  }
);

issueCommentSchema.index({ issue: 1 });
issueCommentSchema.index({ user: 1 });

export default mongoose.model('IssueComment', issueCommentSchema);