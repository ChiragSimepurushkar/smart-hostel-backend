// socket/index.js

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import UserModel from '../models/user.model.js';

let io;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175"
      ],
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Authorization"]
    },
    pingTimeout: 60000,
  });

  // Authentication middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.SECRET_KEY_ACCESS_TOKEN);
      
      // Get user
      const user = await UserModel.findById(decoded.userId || decoded.id)
        .select('_id fullName email role hostel block');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user to socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.hostelId = user.hostel?.toString();
      socket.blockId = user.block?.toString();
      socket.userFullName = user.fullName;

      next();
    } catch (error) {
      console.error('Socket auth error:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`✅ Socket connected: ${socket.userId} (${socket.userFullName})`);

    // ===== JOIN ROOMS =====
    
    // 1. Personal room
    socket.join(`user:${socket.userId}`);
    console.log(`   → Joined personal room: user:${socket.userId}`);

    // 2. Role-based room
    if (socket.userRole === 'MANAGEMENT' || socket.userRole === 'ADMIN') {
      socket.join('management-room');
      console.log(`   → Joined management-room`);
    } else {
      socket.join('student-room');
    }

    // 3. Hostel room
    if (socket.hostelId) {
      socket.join(`hostel:${socket.hostelId}`);
      console.log(`   → Joined hostel:${socket.hostelId}`);
    }

    // 4. Block room
    if (socket.blockId) {
      socket.join(`block:${socket.blockId}`);
      console.log(`   → Joined block:${socket.blockId}`);
    }

    // ===== SOCKET EVENTS =====

    // Join specific issue room (for real-time comments)
    socket.on('join_issue', (issueId) => {
      socket.join(`issue:${issueId}`);
      console.log(`   → ${socket.userFullName} joined issue:${issueId}`);
    });

    // Leave issue room
    socket.on('leave_issue', (issueId) => {
      socket.leave(`issue:${issueId}`);
      console.log(`   → ${socket.userFullName} left issue:${issueId}`);
    });

    // User is typing (for comments)
    socket.on('typing', ({ issueId }) => {
      socket.to(`issue:${issueId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.userFullName
      });
    });

    // User stopped typing
    socket.on('stop_typing', ({ issueId }) => {
      socket.to(`issue:${issueId}`).emit('user_stop_typing', {
        userId: socket.userId
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.userId} (${socket.userFullName})`);
    });

    // Send online user count to management
    if (socket.userRole === 'MANAGEMENT') {
      const connectedUsers = io.sockets.sockets.size;
      socket.emit('online_count', { count: connectedUsers });
    }
  });

  console.log('🔌 Socket.IO initialized');
  
  return io;
};

export const getIO = () => {
  if (!io) {
    // throw new Error('Socket.io not initialized');
    return null;
  }
  return io;
};

// Helper functions for emitting events

export const emitToUser = (userId, event, data) => {
  io.to(`user:${userId}`).emit(event, data);
};

export const emitToManagement = (event, data) => {
  io.to('management-room').emit(event, data);
};

export const emitToHostel = (hostelId, event, data) => {
  io.to(`hostel:${hostelId}`).emit(event, data);
};

export const emitToBlock = (blockId, event, data) => {
  io.to(`block:${blockId}`).emit(event, data);
};

export const emitToIssue = (issueId, event, data) => {
  io.to(`issue:${issueId}`).emit(event, data);
};