import express from 'express';
import {
  getManagementDashboard,
  getStudentDashboard,
} from '../controllers/dashboard.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';

const router = express.Router();

// Get management dashboard
router.get(
  '/management',
  auth,
  roleCheck(['MANAGEMENT', 'ADMIN']),
  getManagementDashboard
);

// Get student dashboard
router.get('/student', auth, getStudentDashboard);

export default router;