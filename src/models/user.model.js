import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['STUDENT', 'MANAGEMENT', 'ADMIN'],
      default: 'STUDENT',
    },
    // Profile details
    department: String,
    year: String,
    profileImage: String,
    
    // Hostel details
    hostel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
    },
    block: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
    },
    roomNumber: String,
    
    // Account status
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    
    // Tokens
    refresh_token: String,
    verificationOTP: String,
    otpExpiry: Date,

     // Add this new field
    resetToken: String,
    resetTokenExpiry: Date,
    
    lastLoginAt: Date,

    
    // Notification Settings
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      issueUpdates: {
        type: Boolean,
        default: true,
      },
      announcements: {
        type: Boolean,
        default: true,
      },
      comments: {
        type: Boolean,
        default: true,
      },
      statusChanges: {
        type: Boolean,
        default: true,
      },
    },
    
    // User Preferences
    preferences: {
      darkMode: {
        type: Boolean,
        default: false,
      },
      language: {
        type: String,
        default: 'en',
      },
      timezone: {
        type: String,
        default: 'Asia/Kolkata',
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function(doc, ret) {
        delete ret.password;
        delete ret.verificationOTP;
        delete ret.otpExpiry;
        delete ret.refresh_token;
        return ret;
      }
    }
  }
);

// Index for faster queries
// userSchema.index({ email: 1 });
// Indexes

userSchema.index({ hostel: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Virtual for full hostel info
userSchema.virtual('hostelInfo', {
  ref: 'Hostel',
  localField: 'hostel',
  foreignField: '_id',
  justOne: true,
});

userSchema.virtual('blockInfo', {
  ref: 'Block',
  localField: 'block',
  foreignField: '_id',
  justOne: true,
});

export default mongoose.model('User', userSchema);