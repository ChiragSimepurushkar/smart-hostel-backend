import express from 'express';
import {
    createAnnouncement,
    getAnnouncements,
    getAnnouncementById,
    updateAnnouncement,
    deleteAnnouncement,
} from '../controllers/announcement.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';

const router = express.Router();

// Get announcements
router.get('/', auth, getAnnouncements);

// Get announcement by ID
router.get('/:id', auth, getAnnouncementById);

// Create announcement (Management only)
router.post(
    '/',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    createAnnouncement
);

// Update announcement (Management only)
router.patch(
    '/:id',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    updateAnnouncement
);

// Delete announcement (Management only)
router.delete(
    '/:id',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    deleteAnnouncement
);

export default router;