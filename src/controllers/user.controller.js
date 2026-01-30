import UserModel from '../models/user.model.js';
import bcrypt from 'bcryptjs';

/**
 * Get all users (Admin/Management only)
 */
export const getUsers = async (req, res) => {
    try {
        const {
            role,
            hostelId,
            isActive,
            search,
            page = 1,
            limit = 20,
        } = req.query;

        // Build where clause
        const where = {};

        if (role) where.role = role;
        if (hostelId) where.hostel = hostelId;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        // Search
        if (search) {
            where.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
            ];
        }

        // Pagination
        const skip = (page - 1) * limit;

        const [users, total] = await Promise.all([
            UserModel.find(where)
                .select('-password -refresh_token -verificationOTP')
                .skip(skip)
                .limit(parseInt(limit))
                .sort({ createdAt: -1 })
                .populate('hostel', 'name')
                .populate('block', 'name'),
            UserModel.countDocuments(where),
        ]);

        res.json({
            success: true,
            data: {
                users,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message,
        });
    }
};

/**
 * Update user
 */
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Don't allow password update through this endpoint
        delete updates.password;
        delete updates.refresh_token;
        delete updates.verificationOTP;

        const user = await UserModel.findByIdAndUpdate(id, updates, {
            new: true,
        })
            .select('-password -refresh_token -verificationOTP')
            .populate('hostel', 'name')
            .populate('block', 'name');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user },
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message,
        });
    }
};
/**

Change password
*/
export const changePassword = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { currentPassword, newPassword } = req.body;
        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect',
            });
        }
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        await user.save();
        res.json({
            success: true,
            message: 'Password changed successfully',
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password',
            error: error.message,
        });
    }
};

/**

Deactivate user
*/
export const deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await UserModel.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        ).select('-password -refresh_token');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        res.json({
            success: true,
            message: 'User deactivated successfully',
        });
    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deactivating user',
            error: error.message,
        });
    }
};


// ==================== GET USER SETTINGS ====================
export const getUserSettings = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.userId)
      .select('email fullName phone profileImage notifications preferences');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Default settings structure
    const settings = {
      profile: {
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        profileImage: user.profileImage,
      },
      notifications: {
        emailNotifications: user.notifications?.email ?? true,
        pushNotifications: user.notifications?.push ?? true,
        issueUpdates: user.notifications?.issueUpdates ?? true,
        announcements: user.notifications?.announcements ?? true,
      },
      preferences: {
        darkMode: user.preferences?.darkMode ?? false,
        language: user.preferences?.language || 'en',
        timezone: user.preferences?.timezone || 'Asia/Kolkata',
      },
    };

    res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message,
    });
  }
};

// ==================== UPDATE USER SETTINGS ====================
export const updateUserSettings = async (req, res) => {
  try {
    const { notifications, preferences } = req.body;

    const user = await UserModel.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update notifications
    if (notifications) {
      user.notifications = {
        ...user.notifications,
        ...notifications,
      };
    }

    // Update preferences
    if (preferences) {
      user.preferences = {
        ...user.preferences,
        ...preferences,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        notifications: user.notifications,
        preferences: user.preferences,
      },
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message,
    });
  }
};

// ==================== GET NOTIFICATION SETTINGS ====================
export const getNotificationSettings = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.userId).select('notifications');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const notificationSettings = {
      emailNotifications: user.notifications?.email ?? true,
      pushNotifications: user.notifications?.push ?? true,
      issueUpdates: user.notifications?.issueUpdates ?? true,
      announcements: user.notifications?.announcements ?? true,
      comments: user.notifications?.comments ?? true,
      statusChanges: user.notifications?.statusChanges ?? true,
    };

    res.status(200).json({
      success: true,
      notifications: notificationSettings,
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification settings',
      error: error.message,
    });
  }
};

// ==================== UPDATE NOTIFICATION SETTINGS ====================
export const updateNotificationSettings = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.notifications = {
      ...user.notifications,
      ...req.body,
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully',
      notifications: user.notifications,
    });
  } catch (error) {
    console.error('Update notification settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
      error: error.message,
    });
  }
};

// ==================== UPLOAD PROFILE IMAGE ====================
export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const user = await UserModel.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Cloudinary URL will be in req.file.path
    user.profileImage = req.file.path;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      profileImage: user.profileImage,
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile image',
      error: error.message,
    });
  }
};

// ==================== DELETE ACCOUNT ====================
export const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to delete account',
      });
    }

    const user = await UserModel.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify password
    const bcrypt = require('bcryptjs');
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password',
      });
    }

    // Soft delete - deactivate account instead of deleting
    user.isActive = false;
    user.isDeleted = true;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete account',
      error: error.message,
    });
  }
};

export default {
  getUserSettings,
  updateUserSettings,
  getNotificationSettings,
  updateNotificationSettings,
  uploadProfileImage,
  deleteAccount,
};



















