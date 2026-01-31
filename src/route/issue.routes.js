// backend/src/routes/issue.routes.js - COMPLETE FIXED VERSION
import express from 'express';
import {
    createIssue,
    getIssues,
    getIssueById,
    updateIssue,
    assignIssue,
    updateStatus,
    addComment,
    toggleReaction,
    deleteIssue,
    mergeIssue,
    bulkUpdate,
    getStaffRecommendations,
    assignWithRecommendation,
    getDuplicates,
    linkAsDuplicate,
    getComments,
    getReactions
} from '../controllers/issue.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';
import { upload, handleUploadError } from '../middlewares/upload.js';
import { validate } from '../middlewares/validation.js';

const router = express.Router();

// ===== CREATE & LIST =====
// Create issue (with file upload)
router.post(
    '/',
    auth,
    upload.array('media', 5),
    handleUploadError,
    validate('createIssue'),
    createIssue
);

// Get all issues
router.get('/', auth, getIssues);

// ===== BULK OPERATIONS =====
// Bulk update (Management only) - MUST BE BEFORE /:id routes
router.patch(
    '/bulk-update',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    bulkUpdate
);

// ===== SINGLE ISSUE OPERATIONS =====
// Get issue by ID
router.get('/:id', auth, getIssueById);

// Update issue
router.put(
    '/:id',
    auth,
    updateIssue
);

// Delete issue (Management only)
router.delete(
    '/:id',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    deleteIssue
);

// ===== ASSIGNMENT =====
// Assign issue (Management only)
router.post(
    '/:id/assign',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    validate('assignIssue'),
    assignIssue
);

// Get AI staff recommendations
router.get(
    '/:id/recommendations',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    getStaffRecommendations
);

// Assign using AI recommendation
router.post(
    '/:id/assign-recommended',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    assignWithRecommendation
);

// ===== STATUS =====
// Update status (Management only)
router.patch(
    '/:id/status',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    validate('updateStatus'),
    updateStatus
);

// ===== COMMENTS =====
// Add comment
router.post('/:id/comments', auth, addComment);

// Get comments (optional - if you have a separate endpoint)
router.get('/:id/comments', auth, getComments);

// ===== REACTIONS (MISSING - THIS IS THE FIX!) =====
// Toggle reaction on issue
router.post('/:id/reactions', auth, toggleReaction);

// Get reactions (optional - if you have a separate endpoint)
router.get('/:id/reactions', auth, getReactions);

// ===== DUPLICATES =====
// Link issue as duplicate (Management only)
router.post(
    '/:id/link-duplicate',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    linkAsDuplicate
);

// Get duplicates of an issue
router.get('/:id/duplicates', auth, getDuplicates);

// Merge duplicate issue (Management only)
router.post(
    '/:id/merge',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    mergeIssue
);

export default router;