import express from 'express';
import {
  createStaff,
  getStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  getStaffWorkload,
} from '../controllers/staff.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';

const router = express.Router();

// Get all staff
router.get('/', auth, roleCheck(['MANAGEMENT', 'ADMIN']), getStaff);

// Get staff by ID
router.get('/:id', auth, roleCheck(['MANAGEMENT', 'ADMIN']), getStaffById);

// Create staff (Admin only)
router.post('/', auth, roleCheck(['ADMIN']), createStaff);

// Update staff (Admin only)
router.patch('/:id', auth, roleCheck(['ADMIN']), updateStaff);

// Delete staff (Admin only)
router.delete('/:id', auth, roleCheck(['ADMIN']), deleteStaff);

// Get staff workload
router.get('/:id/workload', auth, roleCheck(['MANAGEMENT', 'ADMIN']), getStaffWorkload);

export default router;