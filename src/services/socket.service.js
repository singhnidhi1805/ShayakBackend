// services/socket.service.js - FIXED SERVER VERSION
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const Booking = require('../models/booking.model');
const logger = require('../config/logger');

let io;
const activeConnections = new Map();
const trackingSessions = new Map();

/**
 * FIXED: Initialize socket.io with proper CORS and auth
 */
const initializeSocket = (server) => {
  console.log('🚀 Initializing Enhanced Socket.IO Service...');
  
  io = socketIO(server, {
    cors: {
      origin: "*", // Allow all origins for now
      methods: ["GET", "POST"],
      credentials: false,
      allowedHeaders: ["Authorization", "User-Role"]
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowEIO3: true // Support older versions
  });

  // FIXED: Enhanced authentication middleware
  io.use(async (socket, next) => {
    try {
      console.log('🔐 Authenticating socket connection...');
      
      // Extract token from multiple sources
      let token = socket.handshake.auth?.token ||
                  socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                  socket.handshake.query?.token;

      if (!token) {
        console.log('❌ No authentication token provided');
        return next(new Error('Authentication token is missing'));
      }

      console.log('🔑 Token found, verifying...');

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id || decoded._id || decoded.userId;
      socket.userRole = decoded.role || decoded.userRole || 'user';

      console.log(`👤 User authenticated: ${socket.userId}, Role: ${socket.userRole}`);

      // Get user details based on role
      let userData;
      if (socket.userRole === 'professional') {
        userData = await Professional.findById(socket.userId);
      } else {
        userData = await User.findById(socket.userId);
      }

      if (!userData) {
        console.log('❌ User not found in database');
        return next(new Error('User not found'));
      }

      socket.userData = {
        _id: userData._id,
        name: userData.name || 'Unknown User',
        phone: userData.phone || '',
        role: socket.userRole
      };

      console.log(`✅ Socket authenticated: ${socket.userData.name} (${socket.userRole})`);
      next();

    } catch (error) {
      console.error('❌ Socket authentication error:', error.message);
      next(new Error('Authentication failed: ' + error.message));
    }
  });

  // Connection handler
  io.on('connection', (socket) => {
    console.log(`🔗 User connected: ${socket.userId} (${socket.userRole}) - Socket: ${socket.id}`);

    // Store active connection
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      socket: socket,
      role: socket.userRole,
      userData: socket.userData,
      connectedAt: new Date(),
      lastActivity: new Date()
    });

    // Join user's personal room
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);

    // Send connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      role: socket.userRole,
      connectedAt: new Date(),
      message: 'Successfully connected to tracking service'
    });

    // Setup event handlers
    setupTrackingEvents(socket);
    setupBookingEvents(socket);
    setupLocationEvents(socket);

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      handleDisconnection(socket, reason);
    });

    // Update last activity on any event
    socket.onAny(() => {
      if (activeConnections.has(socket.userId)) {
        activeConnections.get(socket.userId).lastActivity = new Date();
      }
    });
  });

  console.log('✅ Socket.IO Service initialized successfully');
  return io;
};

/**
 * FIXED: Setup tracking events with proper error handling
 */
const setupTrackingEvents = (socket) => {
  // Join booking room
  socket.on('join_booking_room', async (data) => {
    try {
      const { bookingId } = data;
      
      if (!bookingId) {
        socket.emit('tracking_error', { message: 'Booking ID is required' });
        return;
      }

      console.log(`📋 ${socket.userData.name} joining booking room: ${bookingId}`);

      // Verify booking access
      const booking = await Booking.findById(bookingId)
        .populate('user', '_id name phone')
        .populate('professional', '_id name phone');

      if (!booking) {
        socket.emit('tracking_error', { message: 'Booking not found' });
        return;
      }

      // Check authorization
      const isAuthorized = 
        (socket.userRole === 'user' && booking.user._id.toString() === socket.userId) ||
        (socket.userRole === 'professional' && booking.professional && booking.professional._id.toString() === socket.userId);

      if (!isAuthorized) {
        socket.emit('tracking_error', { message: 'Not authorized for this booking' });
        return;
      }

      // Join booking room
      const bookingRoom = `booking:${bookingId}`;
      socket.join(bookingRoom);

      socket.emit('booking_room_joined', { 
        bookingId, 
        room: bookingRoom,
        message: 'Successfully joined booking room'
      });

      console.log(`✅ ${socket.userData.name} joined booking room: ${bookingRoom}`);

    } catch (error) {
      console.error('❌ Error joining booking room:', error);
      socket.emit('tracking_error', { message: 'Failed to join booking room' });
    }
  });

  // Start tracking session
  socket.on('start_tracking_session', async (data) => {
    try {
      const { bookingId } = data;

      if (!bookingId) {
        socket.emit('tracking_error', { message: 'Booking ID is required' });
        return;
      }

      console.log(`🚀 ${socket.userData.name} starting tracking session for booking: ${bookingId}`);

      // Get booking details
      const booking = await Booking.findById(bookingId)
        .populate('user', '_id name phone')
        .populate('professional', '_id name phone currentLocation')
        .populate('service', 'name category estimatedDuration');

      if (!booking) {
        socket.emit('tracking_error', { message: 'Booking not found' });
        return;
      }

      // Join tracking room
      const trackingRoom = `tracking:${bookingId}`;
      socket.join(trackingRoom);

      // Store tracking session
      const sessionKey = `${socket.userId}:${bookingId}`;
      trackingSessions.set(sessionKey, {
        bookingId: bookingId,
        userId: socket.userId,
        userRole: socket.userRole,
        socketId: socket.id,
        startedAt: new Date(),
        room: trackingRoom,
        booking: booking
      });

      // Prepare tracking data based on role
      let trackingData = {
        bookingId: bookingId,
        status: booking.status,
        userRole: socket.userRole,
        trackingStarted: true,
        service: booking.service,
        destination: {
          coordinates: booking.location.coordinates,
          address: booking.location.address || 'Service location'
        }
      };

      if (socket.userRole === 'user' && booking.professional) {
        trackingData.professional = {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone,
          currentLocation: booking.professional.currentLocation
        };

        // Calculate initial ETA if professional has location
        if (booking.professional.currentLocation?.coordinates) {
          const distance = calculateDistance(
            booking.professional.currentLocation.coordinates[1],
            booking.professional.currentLocation.coordinates[0],
            booking.location.coordinates[1],
            booking.location.coordinates[0]
          );
          trackingData.initialETA = calculateETA(distance);
          trackingData.initialDistance = distance;
        }
      }

      socket.emit('tracking_session_started', trackingData);
      console.log(`✅ Tracking session started for booking: ${bookingId}`);

    } catch (error) {
      console.error('❌ Error starting tracking session:', error);
      socket.emit('tracking_error', { message: 'Failed to start tracking session' });
    }
  });

  // Update professional location during tracking
  socket.on('update_tracking_location', async (data) => {
    try {
      if (socket.userRole !== 'professional') {
        socket.emit('tracking_error', { message: 'Only professionals can update location' });
        return;
      }

      const { bookingId, coordinates, heading, speed, accuracy } = data;

      if (!bookingId || !coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        socket.emit('tracking_error', { message: 'Invalid location data' });
        return;
      }

      console.log(`📍 Professional ${socket.userData.name} updating location: ${coordinates}`);

      // Validate coordinates
      const [longitude, latitude] = coordinates;
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        socket.emit('tracking_error', { message: 'Invalid coordinates' });
        return;
      }

      // Find and verify booking
      const booking = await Booking.findById(bookingId);
      if (!booking || !booking.professional || booking.professional.toString() !== socket.userId) {
        socket.emit('tracking_error', { message: 'Not authorized for this booking' });
        return;
      }

      // Update professional location in database
      await Professional.findByIdAndUpdate(socket.userId, {
        'currentLocation.type': 'Point',
        'currentLocation.coordinates': coordinates,
        'currentLocation.timestamp': new Date(),
        'currentLocation.accuracy': accuracy || null,
        'currentLocation.heading': heading || null,
        'currentLocation.speed': speed || null
      });

      // Calculate distance and ETA
      const distance = calculateDistance(
        latitude, longitude,
        booking.location.coordinates[1], booking.location.coordinates[0]
      );
      const eta = calculateETA(distance, speed);

      // Update booking tracking
      await Booking.findByIdAndUpdate(bookingId, {
        'tracking.lastLocation.type': 'Point',
        'tracking.lastLocation.coordinates': coordinates,
        'tracking.lastLocation.timestamp': new Date(),
        'tracking.eta': eta,
        'tracking.distance': distance,
        'tracking.lastUpdate': new Date()
      });

      // Prepare location update for broadcast
      const locationUpdate = {
        bookingId: bookingId,
        professionalLocation: {
          coordinates: coordinates,
          timestamp: new Date(),
          heading: heading || null,
          speed: speed || null,
          accuracy: accuracy || null
        },
        eta: eta,
        distance: distance,
        isMoving: speed > 1.0,
        lastUpdate: new Date()
      };

      // Broadcast to tracking room
      socket.to(`tracking:${bookingId}`).emit('location_updated', locationUpdate);
      
      // Also send to user's personal room
      if (booking.user) {
        io.to(`user:${booking.user._id}`).emit('professional_location_update', locationUpdate);
      }

      // Confirm to professional
      socket.emit('location_update_confirmed', {
        bookingId: bookingId,
        coordinates: coordinates,
        eta: eta,
        distance: distance,
        timestamp: new Date()
      });

      console.log(`✅ Location updated - ETA: ${eta}min, Distance: ${distance.toFixed(2)}km`);

    } catch (error) {
      console.error('❌ Error updating location:', error);
      socket.emit('tracking_error', { message: 'Failed to update location' });
    }
  });

  // End tracking session
  socket.on('end_tracking_session', async (data) => {
    try {
      const { bookingId } = data;
      const sessionKey = `${socket.userId}:${bookingId}`;

      if (trackingSessions.has(sessionKey)) {
        const session = trackingSessions.get(sessionKey);
        
        // Leave tracking room
        socket.leave(session.room);
        
        // Remove session
        trackingSessions.delete(sessionKey);
        
        // Notify room that tracking ended
        socket.to(session.room).emit('tracking_session_ended', {
          bookingId: bookingId,
          endedBy: socket.userId,
          endedAt: new Date()
        });

        console.log(`🛑 Tracking session ended for booking: ${bookingId}`);
      }

      socket.emit('tracking_session_ended', { bookingId });

    } catch (error) {
      console.error('❌ Error ending tracking session:', error);
      socket.emit('tracking_error', { message: 'Failed to end tracking session' });
    }
  });

  // Request ETA update
  socket.on('request_eta_update', async (data) => {
    try {
      const { bookingId } = data;

      const booking = await Booking.findById(bookingId);
      if (!booking || booking.user.toString() !== socket.userId) {
        socket.emit('tracking_error', { message: 'Not authorized' });
        return;
      }

      // Send request to professional
      if (booking.professional) {
        io.to(`user:${booking.professional}`).emit('eta_update_requested', {
          bookingId: bookingId,
          requestedBy: socket.userId,
          customerName: socket.userData.name,
          requestedAt: new Date()
        });

        socket.emit('eta_request_sent', { bookingId });
        console.log(`⏱️ ETA update requested for booking: ${bookingId}`);
      }

    } catch (error) {
      console.error('❌ Error requesting ETA:', error);
      socket.emit('tracking_error', { message: 'Failed to request ETA' });
    }
  });
};

/**
 * Setup booking events
 */
const setupBookingEvents = (socket) => {
  socket.on('booking_status_update', async (data) => {
    try {
      const { bookingId, status, message } = data;

      const booking = await Booking.findById(bookingId);
      if (!booking) return;

      // Verify authorization (only professional can update status)
      if (socket.userRole !== 'professional' || !booking.professional || booking.professional.toString() !== socket.userId) {
        return;
      }

      const statusUpdate = {
        bookingId: bookingId,
        status: status,
        message: message || `Booking status updated to ${status}`,
        timestamp: new Date(),
        updatedBy: socket.userData.name
      };

      // Broadcast to booking room
      io.to(`booking:${bookingId}`).emit('booking_status_updated', statusUpdate);
      
      // Also send to tracking room
      io.to(`tracking:${bookingId}`).emit('booking_status_updated', statusUpdate);

      console.log(`📋 Booking status updated: ${bookingId} -> ${status}`);

    } catch (error) {
      console.error('❌ Error updating booking status:', error);
    }
  });
};

/**
 * Setup location events
 */
const setupLocationEvents = (socket) => {
  socket.on('update_availability', async (data) => {
    try {
      if (socket.userRole !== 'professional') return;

      const { isAvailable, coordinates } = data;
      const updateData = { isAvailable };

      if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
        updateData['currentLocation.type'] = 'Point';
        updateData['currentLocation.coordinates'] = coordinates;
        updateData['currentLocation.timestamp'] = new Date();
      }

      await Professional.findByIdAndUpdate(socket.userId, updateData);

      socket.emit('availability_updated', {
        isAvailable,
        coordinates,
        timestamp: new Date()
      });

      console.log(`👨‍🔧 Professional ${socket.userData.name} availability: ${isAvailable}`);

    } catch (error) {
      console.error('❌ Error updating availability:', error);
    }
  });
};

/**
 * Handle disconnection
 */
const handleDisconnection = (socket, reason) => {
  console.log(`🔌 User disconnected: ${socket.userData.name} (${reason})`);

  try {
    // Clean up tracking sessions
    const userSessions = Array.from(trackingSessions.entries())
      .filter(([key, session]) => session.userId === socket.userId);

    userSessions.forEach(([sessionKey, session]) => {
      socket.to(session.room).emit('participant_disconnected', {
        bookingId: session.bookingId,
        userId: socket.userId,
        userName: socket.userData.name,
        userRole: socket.userRole,
        disconnectedAt: new Date()
      });

      trackingSessions.delete(sessionKey);
    });

    // Remove from active connections
    activeConnections.delete(socket.userId);

// services/socket.service.js - COMPLETE FIXED VERSION (Continuation)

    console.log(`✅ Cleanup completed for ${socket.userData.name}`);

  } catch (error) {
    console.error(`❌ Error during disconnection cleanup: ${error.message}`);
  }
};

/**
 * Calculate distance between two points using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c * 100) / 100;
};

/**
 * Calculate ETA based on distance and speed
 */
const calculateETA = (distance, averageSpeed = 30) => {
  if (!distance || distance <= 0) return 0;
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = Math.round(timeInHours * 60);
  return Math.max(1, timeInMinutes);
};

/**
 * Get IO instance for external use
 */
const getIO = () => {
  return io;
};

/**
 * Send tracking update to specific user
 */
const sendTrackingUpdate = (userId, data) => {
  try {
    if (io && activeConnections.has(userId)) {
      io.to(`user:${userId}`).emit('tracking_update', data);
      console.log(`📤 Tracking update sent to user: ${userId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error sending tracking update: ${error.message}`);
    return false;
  }
};

/**
 * Send booking update to booking room
 */
const sendBookingUpdate = (bookingId, data) => {
  try {
    if (io) {
      io.to(`booking:${bookingId}`).emit('booking_update', data);
      io.to(`tracking:${bookingId}`).emit('booking_update', data);
      console.log(`📤 Booking update sent for booking: ${bookingId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`❌ Error sending booking update: ${error.message}`);
    return false;
  }
};

/**
 * Get active connections (for monitoring)
 */
const getActiveConnections = () => {
  return Array.from(activeConnections.entries()).map(([userId, connection]) => ({
    userId,
    role: connection.role,
    userData: connection.userData,
    connectedAt: connection.connectedAt,
    lastActivity: connection.lastActivity,
    socketId: connection.socketId
  }));
};

/**
 * Get active tracking sessions (for monitoring)
 */
const getActiveTrackingSessions = () => {
  return Array.from(trackingSessions.values()).map(session => ({
    bookingId: session.bookingId,
    userId: session.userId,
    userRole: session.userRole,
    startedAt: session.startedAt,
    room: session.room
  }));
};

/**
 * Broadcast emergency alert to nearby professionals
 */
const broadcastEmergencyAlert = (location, serviceCategory, bookingData) => {
  try {
    if (!io) return false;
    
    io.to('role:professional').emit('emergency_booking_alert', {
      location: location,
      serviceCategory: serviceCategory,
      bookingData: bookingData,
      alertTime: new Date(),
      priority: 'high',
      message: 'Emergency booking available nearby'
    });
    
    console.log(`🚨 Emergency alert broadcasted for ${serviceCategory}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error broadcasting emergency alert: ${error.message}`);
    return false;
  }
};

/**
 * Send professional arrival notification
 */
const notifyProfessionalArrival = (bookingId, professionalData) => {
  try {
    if (!io) return false;
    
    // Send to booking and tracking rooms
    io.to(`booking:${bookingId}`).emit('professional_arrived', {
      bookingId: bookingId,
      professional: professionalData,
      arrivedAt: new Date(),
      message: 'Professional has arrived at your location'
    });
    
    io.to(`tracking:${bookingId}`).emit('professional_arrived', {
      bookingId: bookingId,
      professional: professionalData,
      arrivedAt: new Date(),
      message: 'Professional has arrived at your location'
    });
    
    console.log(`📍 Professional arrival notification sent for booking: ${bookingId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error sending arrival notification: ${error.message}`);
    return false;
  }
};

/**
 * Send service completion notification
 */
const notifyServiceCompletion = (bookingId, completionData) => {
  try {
    if (!io) return false;
    
    // Send to booking and tracking rooms
    io.to(`booking:${bookingId}`).emit('service_completed', {
      bookingId: bookingId,
      completionData: completionData,
      completedAt: new Date(),
      message: 'Service has been completed successfully'
    });
    
    io.to(`tracking:${bookingId}`).emit('service_completed', {
      bookingId: bookingId,
      completionData: completionData,
      completedAt: new Date(),
      message: 'Service has been completed successfully'
    });
    
    console.log(`✅ Service completion notification sent for booking: ${bookingId}`);
    return true;
    
  } catch (error) {
    console.error(`❌ Error sending completion notification: ${error.message}`);
    return false;
  }
};

/**
 * Health check function
 */
const getHealthStatus = () => {
  return {
    status: 'healthy',
    timestamp: new Date(),
    activeConnections: activeConnections.size,
    activeTrackingSessions: trackingSessions.size,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime()
  };
};

/**
 * Cleanup function for graceful shutdown
 */
const cleanup = () => {
  console.log('🧹 Cleaning up socket service...');
  
  try {
    // Notify all connected clients about shutdown
    if (io) {
      io.emit('server_shutdown', {
        message: 'Server is shutting down',
        timestamp: new Date()
      });
      
      // Close all connections
      io.close();
    }
    
    // Clear data structures
    activeConnections.clear();
    trackingSessions.clear();
    
    console.log('✅ Socket service cleanup completed');
    
  } catch (error) {
    console.error(`❌ Error during cleanup: ${error.message}`);
  }
};

// Export all functions
module.exports = {
  initializeSocket,
  getIO,
  sendTrackingUpdate,
  sendBookingUpdate,
  getActiveConnections,
  getActiveTrackingSessions,
  broadcastEmergencyAlert,
  notifyProfessionalArrival,
  notifyServiceCompletion,
  getHealthStatus,
  cleanup,
  
  // Utility functions
  calculateDistance,
  calculateETA
};

// Handle process termination
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  cleanup();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, but log the error
});