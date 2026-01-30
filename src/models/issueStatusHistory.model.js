import mongoose from 'mongoose';

const issueStatusHistorySchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      required: true,
    },
    status: {
      type: String,
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    remarks: String,
  },
  {
    timestamps: true,
  }
);

issueStatusHistorySchema.index({ issue: 1 });

export default mongoose.model('IssueStatusHistory', issueStatusHistorySchema);