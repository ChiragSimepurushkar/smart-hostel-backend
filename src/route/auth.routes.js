import express from 'express';
import {
  register,
  verifyEmail,
  resendOTP,
  login,
  verifyResetOTP,
  logout,
  forgotPassword,
  resetPassword,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
} from '../controllers/auth.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validation.js';

const router = express.Router();

// Public routes
router.post('/register', validate('register'), register);
router.post('/verify-email', verifyEmail);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', validate('login'), login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);

// Protected routes
router.post('/logout', auth, logout);
router.get('/profile', auth, getProfile);
router.put('/profile', auth, updateProfile);
router.post('/change-password', auth, changePassword);

export default router;