// backend/models/staff.model.js
import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    // Basic Info
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    role: {
      type: String,
      required: true,
      enum: [
        "PLUMBER",
        "ELECTRICIAN",
        "CLEANER",
        "IT_SUPPORT",
        "CARPENTER",
        "GENERAL_MAINTENANCE",
        "MESS_MANAGER",
        "SECURITY",
        "MEDICAL",
        "OTHER",
      ],
    },

    phone: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // Skills / Expertise
    specialization: [
      {
        type: String,
      },
    ],

    expertiseCategories: [
      {
        type: String,
        enum: [
          "PLUMBING",
          "ELECTRICAL",
          "CLEANLINESS",
          "INTERNET",
          "FURNITURE",
          "MAINTENANCE",
          "MESS_FOOD",
          "SECURITY",
          "MEDICAL",
          "OTHER",
        ],
      },
    ],

    // Assignment
    assignedHostels: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Hostel",
      },
    ],

    assignedBlocks: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Block",
      },
    ],

    // Workload
    currentWorkload: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Performance Tracking
    totalIssuesHandled: {
      type: Number,
      default: 0,
      min: 0,
    },

    avgResolutionTime: {
      type: Number, // in hours
      default: null,
    },

    satisfactionScore: {
      type: Number,
      min: 0,
      max: 5,
      default: null,
    },

    // Availability
    isActive: {
      type: Boolean,
      default: true,
    },

    workingHours: {
      start: {
        type: String,
        default: "09:00",
      },
      end: {
        type: String,
        default: "18:00",
      },
    },
  },
  {
    timestamps: true, // auto adds createdAt & updatedAt
  }
);

/* Indexes for Performance */
staffSchema.index({ role: 1, isActive: 1 });
staffSchema.index({ expertiseCategories: 1, isActive: 1 });
staffSchema.index({ currentWorkload: 1 });
staffSchema.index({ phone: 1 }, { unique: true });

export default mongoose.model("Staff", staffSchema);
