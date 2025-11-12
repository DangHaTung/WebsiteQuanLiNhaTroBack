// Service quản lý Socket.io cho thông báo real-time
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../../models/user.model.js';

let io = null;

// Map lưu trữ socket connections theo userId
const userSockets = new Map(); // userId -> Set of socketIds

/**
 * Khởi tạo Socket.io server
 * @param {Object} httpServer - HTTP server instance
 */
export function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Middleware xác thực Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        console.log('❌ Socket connection rejected: No token provided');
        return next(new Error('Authentication error: No token provided'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Tìm user
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (!user) {
        console.log('❌ Socket connection rejected: User not found');
        return next(new Error('Authentication error: User not found'));
      }

      // Gắn thông tin user vào socket
      socket.userId = user._id.toString();
      socket.userRole = user.role;
      socket.userEmail = user.email;
      socket.userFullName = user.fullName;

      console.log(`✅ Socket authenticated: ${user.fullName} (${user.role}) - Socket ID: ${socket.id}`);
      next();
    } catch (error) {
      console.log('❌ Socket authentication failed:', error.message);
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Xử lý kết nối
  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.userFullName} (${socket.userRole}) - Socket ID: ${socket.id}`);

    // Lưu socket connection
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    // Join room theo role
    if (socket.userRole === 'ADMIN') {
      socket.join('admin-room');
      console.log(`👑 Admin joined admin-room: ${socket.userFullName}`);
    } else if (socket.userRole === 'TENANT') {
      socket.join('tenant-room');
      socket.join(`user-${socket.userId}`); // Room riêng cho từng tenant
      console.log(`🏠 Tenant joined rooms: ${socket.userFullName}`);
    }

    // Gửi thông báo chào mừng
    socket.emit('connected', {
      message: 'Kết nối thành công',
      userId: socket.userId,
      role: socket.userRole,
      timestamp: new Date(),
    });

    // Xử lý ngắt kết nối
    socket.on('disconnect', () => {
      console.log(`🔌 Client disconnected: ${socket.userFullName} - Socket ID: ${socket.id}`);
      
      // Xóa socket khỏi map
      if (userSockets.has(socket.userId)) {
        userSockets.get(socket.userId).delete(socket.id);
        if (userSockets.get(socket.userId).size === 0) {
          userSockets.delete(socket.userId);
        }
      }
    });

    // Xử lý ping/pong để giữ kết nối
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date() });
    });
  });

  console.log('✅ Socket.io server initialized');
  return io;
}

/**
 * Lấy Socket.io instance
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.io chưa được khởi tạo. Gọi initializeSocketIO() trước.');
  }
  return io;
}

/**
 * Gửi thông báo đến một user cụ thể
 * @param {string} userId - ID của user
 * @param {string} event - Tên event
 * @param {Object} data - Dữ liệu gửi đi
 */
export function emitToUser(userId, event, data) {
  try {
    const io = getIO();
    io.to(`user-${userId}`).emit(event, data);
    console.log(`📤 Sent "${event}" to user ${userId}`);
  } catch (error) {
    console.error('❌ Error emitting to user:', error.message);
  }
}

/**
 * Gửi thông báo đến tất cả Admin
 * @param {string} event - Tên event
 * @param {Object} data - Dữ liệu gửi đi
 */
export function emitToAdmins(event, data) {
  try {
    const io = getIO();
    io.to('admin-room').emit(event, data);
    console.log(`📤 Sent "${event}" to all admins`);
  } catch (error) {
    console.error('❌ Error emitting to admins:', error.message);
  }
}

/**
 * Gửi thông báo đến tất cả Tenant
 * @param {string} event - Tên event
 * @param {Object} data - Dữ liệu gửi đi
 */
export function emitToTenants(event, data) {
  try {
    const io = getIO();
    io.to('tenant-room').emit(event, data);
    console.log(`📤 Sent "${event}" to all tenants`);
  } catch (error) {
    console.error('❌ Error emitting to tenants:', error.message);
  }
}

/**
 * Broadcast thông báo đến tất cả clients
 * @param {string} event - Tên event
 * @param {Object} data - Dữ liệu gửi đi
 */
export function broadcastToAll(event, data) {
  try {
    const io = getIO();
    io.emit(event, data);
    console.log(`📤 Broadcast "${event}" to all clients`);
  } catch (error) {
    console.error('❌ Error broadcasting:', error.message);
  }
}

/**
 * Kiểm tra user có đang online không
 * @param {string} userId - ID của user
 * @returns {boolean}
 */
export function isUserOnline(userId) {
  return userSockets.has(userId) && userSockets.get(userId).size > 0;
}

/**
 * Lấy số lượng user đang online
 * @returns {number}
 */
export function getOnlineUsersCount() {
  return userSockets.size;
}

/**
 * Lấy danh sách user đang online
 * @returns {Array<string>}
 */
export function getOnlineUserIds() {
  return Array.from(userSockets.keys());
}

export default {
  initializeSocketIO,
  getIO,
  emitToUser,
  emitToAdmins,
  emitToTenants,
  broadcastToAll,
  isUserOnline,
  getOnlineUsersCount,
  getOnlineUserIds,
};
