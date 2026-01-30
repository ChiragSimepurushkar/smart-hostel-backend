// route/analytics.routes.js
import express from 'express';
import { getTrends,getCategoryDistribution, getPerformance, getHeatMap, getStaffLeaderboard, getDashboardStats } from '../controllers/analytics.controller.js';
import { auth } from '../middlewares/auth.js';
import { roleCheck } from '../middlewares/roleCheck.js';

console.log("✅ Analytics routes loaded");

const router = express.Router();
router.use(auth);

router.get('/dashboard', getDashboardStats);
router.get('/trends', roleCheck(['MANAGEMENT', 'ADMIN']), getTrends);
router.get('/performance', roleCheck(['MANAGEMENT', 'ADMIN']), getPerformance);
router.get('/heat-map', roleCheck(['MANAGEMENT', 'ADMIN']), getHeatMap);
router.get('/staff-leaderboard', roleCheck(['MANAGEMENT', 'ADMIN']), getStaffLeaderboard);
router.get('/category-distribution', roleCheck(['MANAGEMENT', 'ADMIN']), getCategoryDistribution);

export default router;