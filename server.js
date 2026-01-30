// server.js
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import connectDB from './src/config/db.js';
import { initializeSocket } from './src/socket/index.js';

// Routes
import authRoutes from './src/route/auth.routes.js';
import issueRoutes from './src/route/issue.routes.js';
// Add other routes here (announcements, staff, etc.)

import app from './src/app.js';

const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    message: 'SmartWard Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Global Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ===== SERVER STARTUP LOGIC =====
async function startServer() {
  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Initialize Socket.io (using the httpServer)
    const io = initializeSocket(httpServer);
    
    // Make io instance accessible globally in controllers via req.app.get('io')
    app.set('io', io);

    // 3. Start the Server
    httpServer.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║                                        ║
║      🏠 SmartWard Backend API          ║
║                                        ║
║   Server running on port ${PORT}          ║
║   Environment: ${process.env.NODE_ENV || 'development'}     ║
║   Database: MongoDB Connected          ║
║   Real-time: Socket.IO Ready           ║
║                                        ║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ===== PROCESS HANDLERS (Graceful Shutdown) =====

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  httpServer.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown on SIGTERM (e.g., from Heroku/Docker)
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received. Shutting down gracefully...');
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer();