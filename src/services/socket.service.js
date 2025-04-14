// src/services/socket.service.js
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Chat = require('../models/chat.model');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const logger = require('../config/logger');

let io;

/**
 * Initialize socket.io server
 * @param {Object} server - HTTP server instance
 */
const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST']
    }
  });
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token is missing'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      
      logger.info(`Socket auth successful for user ${socket.userId} with role ${socket.userRole}`);
      next();
    } catch (error) {
      logger.error(`Socket auth error: ${error.message}`);
      next(new Error('Authentication error'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}, Role: ${socket.userRole}`);
    
    // Join user's personal room
    socket.join(`user_${socket.userId}`);
    
    // Join role-based room
    if (socket.userRole) {
      socket.join(`role_${socket.userRole}`);
    }
    
    // Chat events
    setupChatEvents(socket);
    
    // Booking events
    setupBookingEvents(socket);
    
    // Location events
    setupLocationEvents(socket);
    
    // Disconnection handler
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });
  
  logger.info('Socket.io server initialized');
  return io;
};

/**
 * Setup chat-related socket events
 * @param {Object} socket - Socket instance
 */
const setupChatEvents = (socket) => {
  // Join chat room
  socket.on('join_chat', async (chatId) => {
    try {
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        socket.emit('error', 'Chat not found');
        return;
      }
      
      // Check if user is a participant in the chat
      const isParticipant = chat.participants.some(
        participant => participant.toString() === socket.userId.toString()
      );
      
      if (!isParticipant) {
        socket.emit('error', 'Not authorized to join this chat');
        return;
      }
      
      socket.join(`chat_${chatId}`);
      logger.info(`User ${socket.userId} joined chat ${chatId}`);
      
      // Mark messages as read
      if (chat.messages && chat.messages.length > 0) {
        const unreadMessages = chat.messages.filter(msg => 
          msg.sender.toString() !== socket.userId.toString() &&
          !msg.readBy.some(read => read.user.toString() === socket.userId.toString())
        );
        
        // Update read status
        if (unreadMessages.length > 0) {
          unreadMessages.forEach(msg => {
            const readIndex = chat.messages.findIndex(m => m._id.toString() === msg._id.toString());
            if (readIndex !== -1) {
              chat.messages[readIndex].readBy.push({
                user: socket.userId,
                readAt: new Date()
              });
            }
          });
          
          await chat.save();
          socket.emit('messages_read', { chatId });
        }
      }
    } catch (error) {
      logger.error(`Join chat error: ${error.message}`);
      socket.emit('error', 'Failed to join chat');
    }
  });
  
  // Send message
  socket.on('send_message', async (data) => {
    try {
      const { chatId, content, type = 'text', media, location } = data;
      
      if (!chatId || !content) {
        socket.emit('error', 'Missing required data');
        return;
      }
      
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        socket.emit('error', 'Chat not found');
        return;
      }
      
      // Check if user is a participant
      const isParticipant = chat.participants.some(
        participant => participant.toString() === socket.userId.toString()
      );
      
      if (!isParticipant) {
        socket.emit('error', 'Not authorized to send messages in this chat');
        return;
      }
      
      // Create new message
      const newMessage = {
        sender: socket.userId,
        content,
        type,
        media,
        location,
        readBy: [],
        createdAt: new Date()
      };
      
      // Update chat with new message
      chat.messages.push(newMessage);
      chat.lastMessage = {
        content: type === 'text' ? content : `${type} message`,
        sender: socket.userId,
        createdAt: new Date()
      };
      
      await chat.save();
      
      // Emit to all participants
      io.to(`chat_${chatId}`).emit('new_message', {
        chatId,
        message: {
          ...newMessage,
          _id: chat.messages[chat.messages.length - 1]._id
        }
      });
      
      logger.info(`Message sent in chat ${chatId} by user ${socket.userId}`);
    } catch (error) {
      logger.error(`Send message error: ${error.message}`);
      socket.emit('error', 'Failed to send message');
    }
  });
  
  // Mark messages as read
  socket.on('mark_read', async (chatId) => {
    try {
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        socket.emit('error', 'Chat not found');
        return;
      }
      
      // Update read status for all unread messages
      let updatedCount = 0;
      
      if (chat.messages && chat.messages.length > 0) {
        chat.messages.forEach(msg => {
          if (msg.sender.toString() !== socket.userId.toString() && 
              !msg.readBy.some(read => read.user.toString() === socket.userId.toString())) {
            msg.readBy.push({
              user: socket.userId,
              readAt: new Date()
            });
            updatedCount++;
          }
        });
        
        if (updatedCount > 0) {
          await chat.save();
          
          // Notify other participants
          socket.to(`chat_${chatId}`).emit('messages_read', {
            chatId,
            userId: socket.userId,
            count: updatedCount
          });
        }
      }
      
      logger.info(`Marked ${updatedCount} messages as read in chat ${chatId} by user ${socket.userId}`);
    } catch (error) {
      logger.error(`Mark read error: ${error.message}`);
      socket.emit('error', 'Failed to mark messages as read');
    }
  });
};

/**
 * Setup booking-related socket events
 * @param {Object} socket - Socket instance
 */
const setupBookingEvents = (socket) => {
  // Join booking room
  socket.on('join_booking', async (bookingId) => {
    try {
      const booking = await Booking.findById(bookingId);
      
      if (!booking) {
        socket.emit('error', 'Booking not found');
        return;
      }
      
      // Check if user is associated with the booking
      const isAssociated = 
        (socket.userRole === 'user' && booking.user.toString() === socket.userId.toString()) ||
        (socket.userRole === 'professional' && booking.professional && booking.professional.toString() === socket.userId.toString());
      
      if (!isAssociated) {
        socket.emit('error', 'Not authorized to track this booking');
        return;
      }
      
      socket.join(`booking_${bookingId}`);
      logger.info(`User ${socket.userId} joined booking ${bookingId} tracking`);
      
      // Send initial tracking data if available
      if (booking.professional && booking.status === 'in_progress') {
        const professional = await Professional.findById(booking.professional);
        
        if (professional && professional.currentLocation) {
          socket.emit('tracking_update', {
            bookingId,
            status: booking.status,
            location: professional.currentLocation,
            eta: booking.tracking.eta
          });
        }
      }
    } catch (error) {
      logger.error(`Join booking error: ${error.message}`);
      socket.emit('error', 'Failed to join booking tracking');
    }
  });
  
  // Update location (professional only)
  socket.on('update_location', async (data) => {
    try {
      const { bookingId, coordinates, eta } = data;
      
      if (!bookingId || !coordinates) {
        socket.emit('error', 'Missing required data');
        return;
      }
      
      // Verify this is a professional
      if (socket.userRole !== 'professional') {
        socket.emit('error', 'Only professionals can update location');
        return;
      }
      
      const booking = await Booking.findById(bookingId);
      
      if (!booking) {
        socket.emit('error', 'Booking not found');
        return;
      }
      
      // Verify professional is assigned to this booking
      if (!booking.professional || booking.professional.toString() !== socket.userId.toString()) {
        socket.emit('error', 'Not authorized to update this booking');
        return;
      }
      
      // Update professional location
      await Professional.findByIdAndUpdate(socket.userId, {
        'currentLocation.coordinates': coordinates
      });
      
      // Update booking tracking
      booking.tracking = {
        ...booking.tracking,
        lastLocation: {
          type: 'Point',
          coordinates,
          timestamp: new Date()
        },
        eta: eta || booking.tracking.eta
      };
      
      await booking.save();
      
      // Notify user
      io.to(`booking_${bookingId}`).emit('tracking_update', {
        bookingId,
        status: booking.status,
        location: {
          type: 'Point',
          coordinates
        },
        eta: booking.tracking.eta
      });
      
      logger.info(`Updated location for booking ${bookingId} by professional ${socket.userId}`);
    } catch (error) {
      logger.error(`Update location error: ${error.message}`);
      socket.emit('error', 'Failed to update location');
    }
  });
  
  // Request ETA update (user only)
  socket.on('request_eta', async (bookingId) => {
    try {
      if (socket.userRole !== 'user') {
        socket.emit('error', 'Only users can request ETA updates');
        return;
      }
      
      const booking = await Booking.findById(bookingId);
      
      if (!booking) {
        socket.emit('error', 'Booking not found');
        return;
      }
      
      // Verify user is associated with this booking
      if (booking.user.toString() !== socket.userId.toString()) {
        socket.emit('error', 'Not authorized to access this booking');
        return;
      }
      
      if (booking.status !== 'in_progress' || !booking.professional) {
        socket.emit('error', 'Booking is not in progress or no professional assigned');
        return;
      }
      
      // Notify professional to send an ETA update
      io.to(`user_${booking.professional.toString()}`).emit('eta_requested', {
        bookingId,
        userId: socket.userId
      });
      
      logger.info(`ETA requested for booking ${bookingId} by user ${socket.userId}`);
    } catch (error) {
      logger.error(`Request ETA error: ${error.message}`);
      socket.emit('error', 'Failed to request ETA update');
    }
  });
};

/**
 * Setup location-related socket events
 * @param {Object} socket - Socket instance
 */
const setupLocationEvents = (socket) => {
  // Update professional status and location
  socket.on('update_professional_status', async (data) => {
    try {
      const { isAvailable, coordinates } = data;
      
      if (socket.userRole !== 'professional') {
        socket.emit('error', 'Only professionals can update status');
        return;
      }
      
      // Update professional location and availability
      await Professional.findByIdAndUpdate(socket.userId, {
        isAvailable: isAvailable,
        'currentLocation.coordinates': coordinates,
        'currentLocation.timestamp': new Date()
      });
      
      socket.emit('status_updated', { isAvailable, coordinates });
      logger.info(`Professional ${socket.userId} updated status: available=${isAvailable}`);
    } catch (error) {
      logger.error(`Update professional status error: ${error.message}`);
      socket.emit('error', 'Failed to update status');
    }
  });
};

/**
 * Send notification to a specific user
 * @param {string} userId - User ID
 * @param {Object} notification - Notification data
 */
const sendNotificationToUser = (userId, notification) => {
  if (!io) {
    logger.error('Socket.io not initialized');
    return;
  }
  
  io.to(`user_${userId}`).emit('notification', notification);
  logger.info(`Notification sent to user ${userId}`);
};

/**
 * Send notification to all users with a specific role
 * @param {string} role - Role (user, professional, admin)
 * @param {Object} notification - Notification data
 */
const sendNotificationToRole = (role, notification) => {
  if (!io) {
    logger.error('Socket.io not initialized');
    return;
  }
  
  io.to(`role_${role}`).emit('notification', notification);
  logger.info(`Notification sent to all ${role}s`);
};

/**
 * Send booking status update
 * @param {string} bookingId - Booking ID
 * @param {Object} updateData - Booking update data
 */
const sendBookingUpdate = (bookingId, updateData) => {
  if (!io) {
    logger.error('Socket.io not initialized');
    return;
  }
  
  io.to(`booking_${bookingId}`).emit('booking_update', {
    bookingId,
    ...updateData
  });
  logger.info(`Booking update sent for booking ${bookingId}`);
};

module.exports = {
  initializeSocket,
  sendNotificationToUser,
  sendNotificationToRole,
  sendBookingUpdate,
  getIO: () => io
};