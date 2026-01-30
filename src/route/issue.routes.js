import express from 'express';
import {
    createIssue,
    getIssues,
    getIssueById,
    assignIssue,
    updateStatus,
    addComment,
    deleteIssue,
    mergeIssue,
    bulkUpdate,
    getStaffRecommendations,
    assignWithRecommendation,
    getDuplicates,
    linkAsDuplicate
} from '../controllers/issue.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';
import { upload, handleUploadError } from '../middlewares/upload.js';
import { validate } from '../middlewares/validation.js';

const router = express.Router();

// Create issue (with file upload)
router.post(
    '/',
    auth,
    upload.array('media', 5),
    handleUploadError,
    validate('createIssue'),
    createIssue
);

// Get issues
router.get('/', auth, getIssues);

// Get issue by ID
router.get('/:id', auth, getIssueById);

// Assign issue (Management only)
router.post(
    '/:id/assign',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    validate('assignIssue'),
    assignIssue
);

// Update status (Management only)
router.patch(
    '/:id/status',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    validate('updateStatus'),
    updateStatus
);

// Add comment
router.post('/:id/comments', auth, addComment);

// Delete issue (Management only)
router.delete(
    '/:id',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    deleteIssue
);

// Merge duplicate issue (Management only)
router.post(
    '/:id/merge',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    mergeIssue
);


// Get AI staff recommendations
router.get('/:id/recommendations',
  auth,
  roleCheck(['MANAGEMENT', 'ADMIN']),
  getStaffRecommendations
);

// Assign using AI recommendation
router.post('/:id/assign-recommended',
  auth,
  roleCheck(['MANAGEMENT', 'ADMIN']),
  assignWithRecommendation
);

// Bulk update (Management only)
router.patch(
    '/bulk-update',
    auth,
    roleCheck(['MANAGEMENT', 'ADMIN']),
    bulkUpdate
);


// routes/issue.routes.js - ADD THESE TO YOUR EXISTING FILE
router.post('/:id/link-duplicate', auth, roleCheck(['MANAGEMENT', 'ADMIN']), linkAsDuplicate);
router.get('/:id/duplicates', auth, getDuplicates);


export default router;