import express from 'express';
import {
    getUsers,
    updateUser,
    changePassword,
    deactivateUser,
    getUserSettings,
    updateUserSettings,
    getNotificationSettings,
    updateNotificationSettings,
    uploadProfileImage,
    deleteAccount,
} from '../controllers/user.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';
import { uploadToCloudinary } from '../config/cloudinary.js';
import upload from '../services/upload.js';

const router = express.Router();

// Get all users (Management only)
router.get('/', auth, roleCheck(['MANAGEMENT', 'ADMIN']), getUsers);

// Update user (Management only)
router.patch('/:id', auth, roleCheck(['MANAGEMENT', 'ADMIN']), updateUser);

// Change password (own account)
router.post('/change-password', auth, changePassword);

// Deactivate user (Admin only)
router.patch('/:id/deactivate', auth, roleCheck(['ADMIN']), deactivateUser);


// Settings routes
router.get('/settings',auth, getUserSettings);
router.put('/settings',auth, updateUserSettings);

// Notification settings
router.get('/notifications',auth, getNotificationSettings);
router.put('/notifications',auth, updateNotificationSettings);

// Profile image upload
router.post('/upload-profile-image', auth,upload.single('profileImage'), uploadProfileImage);

// Account deletion
router.delete('/account',auth, deleteAccount);
export default router;