// backend/src/routes/hostel.routes.js
import express from 'express';
import { getAllHostels, getHostelBlocks, getHostelById } from '../controllers/hostel.controller.js';
import { auth } from '../middlewares/auth.js';

const router = express.Router();

// Public routes (or protected based on your needs)
router.get('/', auth, getAllHostels);
router.get('/:id', auth, getHostelById);
router.get('/:hostelId/blocks', auth, getHostelBlocks);

export default router;