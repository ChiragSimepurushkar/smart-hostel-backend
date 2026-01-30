import UserModel from '../models/user.model.js';
import bcrypt from 'bcryptjs';
import generatedAccessToken from '../utils/generatedAccessToken.js';
import generatedRefreshToken from '../utils/generatedRefreshToken.js';
import VerificationEmail from '../utils/verifyEmailTemplate.js';
import { sendEmail } from '../services/email.service.js';
import jwt from 'jsonwebtoken';

/**
 * Register new user
 */
export const register = async (req, res) => {
  try {
    const {
      email,
      phone,
      password,
      fullName,
      role,
      department,
      year,
      hostel,
      block,
      roomNumber,
    } = req.body;

    // Check if user exists
    const existingUser = await UserModel.findOne({
      $or: [{ email }, { phone: phone || null }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email or phone',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create user
    const user = await UserModel.create({
      email,
      phone,
      password: hashedPassword,
      fullName,
      role: role || 'STUDENT',
      department,
      year,
      hostel,
      block,
      roomNumber,
      verificationOTP: otp,
      otpExpiry,
      isVerified: false,
    });

    // Send verification email
    const emailHTML = VerificationEmail(fullName, otp);
    await sendEmail({
      to: email,
      subject: 'SmartWard - Email Verification',
      html: emailHTML,
    });

    // Generate tokens
    const accessToken = await generatedAccessToken(user._id);
    const refreshToken = await generatedRefreshToken(user._id);

    // Remove sensitive data
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationOTP;
    delete userResponse.refresh_token;

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email.',
      data: {
        user: userResponse,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

/**
 * Verify email with OTP
 */
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    // Check OTP
    if (user.verificationOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    // Check OTP expiry
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Verify user
    user.isVerified = true;
    user.verificationOTP = undefined;
    user.otpExpiry = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying email',
      error: error.message,
    });
  }
};

/**
 * Resend verification OTP
 */
export const resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.verificationOTP = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send email
    const emailHTML = VerificationEmail(user.fullName, otp);
    await sendEmail({
      to: email,
      subject: 'SmartWard - New Verification OTP',
      html: emailHTML,
    });

    res.json({
      success: true,
      message: 'New OTP sent to your email',
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resending OTP',
      error: error.message,
    });
  }
};

/**
 * Login user
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await UserModel.findOne({ email })
      .populate('hostel', 'name')
      .populate('block', 'name');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated',
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    user.lastLoginAt = new Date();
    await user.save();

    // Generate tokens
    const accessToken = await generatedAccessToken(user._id);
    const refreshToken = await generatedRefreshToken(user._id);

    // Remove sensitive data
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationOTP;
    delete userResponse.refresh_token;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
};

/**
 * Logout user
 */
export const logout = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Clear refresh token
    await UserModel.updateOne(
      { _id: userId },
      { $unset: { refresh_token: 1 } }
    );

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout',
      error: error.message,
    });
  }
};
// controllers/auth.controller.js

/**
 * Forgot password - Send OTP
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      // Don't reveal if user exists (security best practice)
      return res.json({
        success: true,
        message: 'If email exists, OTP has been sent',
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP to user
    user.verificationOTP = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send email with OTP
    const emailHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            background-color: #f5f5f5;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .otp { 
            font-size: 32px; 
            font-weight: bold; 
            color: #4CAF50; 
            text-align: center;
            padding: 20px;
            background-color: #f0f0f0;
            border-radius: 4px;
            letter-spacing: 5px;
            margin: 20px 0;
          }
          .warning {
            color: #ff6b6b;
            font-size: 14px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hello,</p>
            <p>We received a request to reset your password. Please use the OTP below to verify your identity:</p>
            <div class="otp">${otp}</div>
            <p><strong>This OTP is valid for 10 minutes.</strong></p>
            <p class="warning">⚠️ If you didn't request this password reset, please ignore this email or contact support if you're concerned about your account security.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: email,
      subject: 'SmartWard - Password Reset OTP',
      html: emailHTML,
    });

    res.json({
      success: true,
      message: 'OTP sent to your email',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending OTP',
      error: error.message,
    });
  }
};

/**
 * Verify OTP and get reset token
 */
export const verifyResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await UserModel.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify OTP
    if (!user.verificationOTP || user.verificationOTP !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP',
      });
    }

    // Check OTP expiry
    if (new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Generate reset token (valid for 15 minutes)
    const resetToken = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        purpose: 'password-reset' // Extra security
      },
      process.env.SECRET_KEY_ACCESS_TOKEN, // Or create separate RESET_TOKEN_SECRET
      { expiresIn: '15m' }
    );

    // Store reset token in database (for extra validation)
    const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    
    // Clear OTP (one-time use)
    user.verificationOTP = undefined;
    user.otpExpiry = undefined;
    
    await user.save();

    res.json({
      success: true,
      message: 'OTP verified successfully',
      data: {
        resetToken
      }
    });
  } catch (error) {
    console.error('Verify reset OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying OTP',
      error: error.message,
    });
  }
};

/**
 * Reset password using reset token
 */
export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Reset token and new password are required',
      });
    }

    // Validate password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.SECRET_KEY_ACCESS_TOKEN);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    // Verify purpose (extra security check)
    if (decoded.purpose !== 'password-reset') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    const { userId, email } = decoded;

    // Find user and verify reset token matches
    const user = await UserModel.findOne({
      _id: userId,
      email: email,
      resetToken: resetToken
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid reset token or user not found',
      });
    }

    // Check if reset token has expired
    if (new Date() > user.resetTokenExpiry) {
      return res.status(401).json({
        success: false,
        message: 'Reset token has expired. Please request a new password reset.',
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    user.verificationOTP = undefined;
    user.otpExpiry = undefined;
    
    // Optional: Clear all refresh tokens (logout from all devices)
    user.refresh_token = undefined;
    
    await user.save();

    // Optional: Send confirmation email
    const confirmationEmail = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; padding: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Password Changed Successfully</h2>
          <p>Hello ${user.fullName},</p>
          <p>Your password has been successfully reset.</p>
          <p>If you did not make this change, please contact support immediately.</p>
          <p>Login Time: ${new Date().toLocaleString()}</p>
        </div>
      </body>
      </html>
    `;

    await sendEmail({
      to: user.email,
      subject: 'SmartWard - Password Changed',
      html: confirmationEmail,
    });

    res.json({
      success: true,
      message: 'Password reset successful. Please login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message,
    });
  }
};
/**
 * Refresh access token
 */
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.SECRET_KEY_REFRESH_TOKEN);
    const userId = decoded.id;

    // Check if refresh token exists in database
    const user = await UserModel.findOne({
      _id: userId,
      refresh_token: refreshToken,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    // Generate new access token
    const newAccessToken = await generatedAccessToken(userId);

    res.json({
      success: true,
      data: { accessToken: newAccessToken },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await UserModel.findById(userId)
      .select('-password -refresh_token -verificationOTP')
      .populate('hostel', 'name location')
      .populate('block', 'name');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message,
    });
  }
};


// ==================== CHANGE PASSWORD ====================
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password',
      error: error.message,
    });
  }
};


// ==================== UPDATE PROFILE ====================
export const updateProfile = async (req, res) => {
  try {
    const {
      fullName,
      phone,
      department,
      year,
      roomNumber,
      profileImage,
    } = req.body;

    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Update only provided fields
    if (fullName) user.fullName = fullName;
    if (phone) {
      // Check if phone is already used by another user
      const existingPhone = await User.findOne({ phone, _id: { $ne: user._id } });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already in use',
        });
      }
      user.phone = phone;
    }
    if (department) user.department = department;
    if (year) user.year = year;
    if (roomNumber) user.roomNumber = roomNumber;
    if (profileImage) user.profileImage = profileImage;

    await user.save();

    const updatedUser = await User.findById(user._id)
      .select('-password -verificationOTP -otpExpiry -refresh_token')
      .populate('hostel', 'name location')
      .populate('block', 'name');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message,
    });
  }
};
