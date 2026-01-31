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
import hostelRoutes from './route/hostel.routes.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5175',
  'http://localhost:5174', // Added the port you are currently on
  process.env.FRONTEND_URL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Cache-Control',
    'Pragma',
  ],
}));

app.options('*', cors());


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
      hostels: '/api/hostels',
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
app.use('/api/hostels', hostelRoutes);
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