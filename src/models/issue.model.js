import mongoose from 'mongoose';

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: [
        'PLUMBING',
        'ELECTRICAL',
        'CLEANLINESS',
        'INTERNET',
        'FURNITURE',
        'MAINTENANCE',
        'MESS_FOOD',
        'MEDICAL',
        'SECURITY',
        'OTHER',
      ],
      required: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'],
      default: 'REPORTED',
    },
    isPublic: {
      type: Boolean,
      default: true,
    },

    // Location
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: true,
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
    },
    roomNumber: String,

    // Reporter
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Assignment
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Staff',
    },
    assignedAt: Date,

    // AI-generated fields
    aiCategory: String,
    aiPriority: String,
    aiConfidence: Number,
    similarIssueIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
    }],

    // Duplicate handling
    duplicateOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Issue',
      default: null
    },
    duplicateCount: {
      type: Number,
      default: 0  // How many duplicates point to this
    },
    duplicateReporters: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    isDuplicateMaster: {
      type: Boolean,
      default: false
    },

    // Timestamps
    reportedAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: Date,
    closedAt: Date,

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
issueSchema.index({ reporter: 1 });
issueSchema.index({ hostel: 1 });
issueSchema.index({ block: 1 });
issueSchema.index({ category: 1 });
issueSchema.index({ status: 1 });
issueSchema.index({ priority: 1 });
issueSchema.index({ reportedAt: -1 });
issueSchema.index({ assignedTo: 1 });
//Index for duplicate queries
issueSchema.index({ duplicateOf: 1 });
issueSchema.index({ isDuplicateMaster: 1 });


export default mongoose.model('Issue', issueSchema);