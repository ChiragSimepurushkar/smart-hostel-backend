// src/app.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/errorHandler.js';
import { rateLimiter } from './middlewares/rateLimit.js';

// Import routes
import authRoutes from './route/auth.routes.js';
import issueRoutes from './route/issue.routes.js';
import announcementRoutes from './route/announcement.routes.js';
import lostFoundRoutes from './route/lostFound.routes.js';
import staffRoutes from './route/staff.routes.js';
import analyticsRoutes from './route/analytics.routes.js'
import dashboardRoutes from './route/dashboard.routes.js';
import userRoutes from './route/user.routes.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
app.use('/api/', rateLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'SmartWard API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'MongoDB',
  });
});

// API information
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'SmartWard API v1.0',
    documentation: '/api/docs',
    endpoints: {
      auth: '/api/auth',
      issues: '/api/issues',
      announcements: '/api/announcements',
      lostFound: '/api/lost-found',
      staff: '/api/staff',
      analytics: '/api/analytics',
      dashboard: '/api/dashboard',
      users: '/api/users',
    },
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/lost-found', lostFoundRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use(errorHandler);

export default app;