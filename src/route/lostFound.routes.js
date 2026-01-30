import express from 'express';
import {
    reportItem,
    getItems,
    getItemById,
    claimItem,
    updateItemStatus,
} from '../controllers/lostFound.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';

const router = express.Router();

// Report item
router.post('/', auth, reportItem);

// Get items
router.get('/', auth, getItems);

// Get item by ID
router.get('/:id', auth, getItemById);

// Claim item
router.post('/:id/claim', auth, claimItem);

// Update item status (Management only)
router.patch(
    '/:id/status',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    updateItemStatus
);

export default router;