// services/socket.service.js - COMPLETE FIXED VERSION WITH LOCATION TRACKING
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
    setupLocationEvents(socket); // ✅ CRITICAL: This was missing!

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
      const { bookingId, userType } = data;
      
      if (!bookingId) {
        socket.emit('tracking_error', { message: 'Booking ID is required' });
        return;
      }

      console.log(`📋 ${socket.userData.name} joining booking room: ${bookingId} as ${userType}`);

      // Verify booking access
      const booking = await Booking.findById(bookingId)
        .populate('user', '_id name phone')
        .populate('professional', '_id name phone currentLocation');

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
        userType,
        message: 'Successfully joined booking room'
      });

      console.log(`✅ ${socket.userData.name} joined booking room: ${bookingRoom}`);

      // If customer just joined, send last known location
      if (userType === 'customer' && booking.tracking && booking.tracking.lastLocation) {
        const locationData = {
          bookingId: bookingId,
          coordinates: booking.tracking.lastLocation.coordinates,
          timestamp: booking.tracking.lastLocation.timestamp,
          accuracy: booking.tracking.lastLocation.accuracy || 10,
          heading: booking.tracking.lastLocation.heading || 0,
          speed: booking.tracking.lastLocation.speed || 0,
          eta: booking.tracking.eta || null,
          distance: booking.tracking.distance || null,
        };

        socket.emit('professionalLocationUpdate', locationData);
        console.log('📍 Sent last known location to customer');
      }

    } catch (error) {
      console.error('❌ Error joining booking room:', error);
      socket.emit('tracking_error', { message: 'Failed to join booking room' });
    }
  });

  // Leave booking room
  socket.on('leave_booking_room', (data) => {
    try {
      const { bookingId } = data;
      socket.leave(`booking:${bookingId}`);
      console.log(`🚪 ${socket.userData.name} left booking room: ${bookingId}`);
    } catch (error) {
      console.error('❌ Error leaving booking room:', error);
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

  // End tracking session
  socket.on('end_tracking_session', (data) => {
    try {
      const { bookingId } = data;
      const sessionKey = `${socket.userId}:${bookingId}`;
      
      if (trackingSessions.has(sessionKey)) {
        trackingSessions.delete(sessionKey);
        socket.leave(`tracking:${bookingId}`);
        socket.emit('tracking_session_ended', { bookingId, endedAt: new Date() });
        console.log(`🛑 Tracking session ended for booking: ${bookingId}`);
      }
    } catch (error) {
      console.error('❌ Error ending tracking session:', error);
    }
  });
};

/**
 * ✅ CRITICAL: Setup location tracking events - THIS WAS MISSING!
 */
const setupLocationEvents = (socket) => {
  console.log('📍 Setting up location events for:', socket.userData.name);

  // ===== PRIMARY EVENT: professionalLocationUpdate =====
  socket.on('professionalLocationUpdate', async (data) => {
    try {
      console.log('📍 [PRIMARY] Professional location update received from:', socket.userData.name);
      console.log('📊 Location data:', JSON.stringify(data, null, 2));

      const { bookingId, coordinates, accuracy, heading, speed, timestamp } = data;

      // Validate required fields
      if (!bookingId) {
        console.error('❌ Missing bookingId');
        socket.emit('location_error', { message: 'Booking ID is required' });
        return;
      }

      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        console.error('❌ Invalid coordinates:', coordinates);
        socket.emit('location_error', { message: 'Invalid coordinates format' });
        return;
      }

      const [lng, lat] = coordinates;

      // Validate coordinate ranges
      if (typeof lng !== 'number' || typeof lat !== 'number' ||
          lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        console.error('❌ Coordinates out of range:', { lng, lat });
        socket.emit('location_error', { message: 'Coordinates out of valid range' });
        return;
      }

      console.log('✅ Location validation passed:', { lng, lat });

      // Get booking details
      const booking = await Booking.findById(bookingId)
        .populate('professional', '_id name')
        .populate('user', '_id name');

      if (!booking) {
        console.error('❌ Booking not found:', bookingId);
        socket.emit('location_error', { message: 'Booking not found' });
        return;
      }

      // Verify this is from the assigned professional
      if (!booking.professional || booking.professional._id.toString() !== socket.userId) {
        console.error('❌ Unauthorized location update from:', socket.userId);
        socket.emit('location_error', { message: 'Unauthorized: Not the assigned professional' });
        return;
      }

      console.log('✅ Authorization passed for professional:', booking.professional.name);

      // Calculate distance and ETA
      const distance = calculateDistance(
        lat, lng,
        booking.location.coordinates[1],
        booking.location.coordinates[0]
      );

      const currentSpeed = speed && speed > 1 ? speed : 30; // km/h
      const eta = Math.round((distance / currentSpeed) * 60); // minutes

      console.log('📏 Calculated distance:', distance.toFixed(2), 'km');
      console.log('⏱️ Calculated ETA:', eta, 'minutes');

      // Prepare location update payload
      const locationUpdate = {
        bookingId: bookingId,
        coordinates: coordinates,
        timestamp: timestamp || new Date().toISOString(),
        heading: heading || 0,
        speed: speed || 0,
        accuracy: Math.round(accuracy || 10),
        eta: eta,
        distance: distance,
        isMoving: speed > 1.0,
        professionalName: booking.professional.name
      };

      // Update booking tracking data in database
      try {
        await Booking.findByIdAndUpdate(bookingId, {
          'tracking.lastLocation': {
            type: 'Point',
            coordinates: coordinates,
            timestamp: new Date(timestamp || Date.now()),
            accuracy: accuracy || 10,
            heading: heading || 0,
            speed: speed || 0
          },
          'tracking.eta': eta,
          'tracking.distance': distance,
          'tracking.lastUpdate': new Date()
        });
        console.log('💾 Location saved to database');
      } catch (dbError) {
        console.error('⚠️ Database update failed (non-critical):', dbError.message);
      }

      // Broadcast to booking room (reaches all participants)
      const roomName = `booking:${bookingId}`;
      const socketsInRoom = await io.in(roomName).fetchSockets();
      console.log(`📤 Broadcasting to ${socketsInRoom.length} clients in room: ${roomName}`);

      io.to(roomName).emit('professionalLocationUpdate', locationUpdate);

      // Also send directly to customer's personal room (redundancy for reliability)
      if (booking.user) {
        io.to(`user:${booking.user._id}`).emit('professionalLocationUpdate', locationUpdate);
        console.log(`✅ Location sent to customer: ${booking.user.name} (${booking.user._id})`);
      }

      // Send acknowledgment back to professional
      socket.emit('location_ack', {
        success: true,
        bookingId: bookingId,
        timestamp: new Date().toISOString(),
        eta: eta,
        distance: distance
      });

      console.log('✅ Location update broadcast completed successfully');

    } catch (error) {
      console.error('❌ Error handling professionalLocationUpdate:', error);
      console.error('Stack trace:', error.stack);
      socket.emit('location_error', { 
        message: 'Failed to process location update',
        error: error.message 
      });
    }
  });

  // ===== ALTERNATIVE EVENT NAME: update_tracking_location =====
  socket.on('update_tracking_location', async (data) => {
    console.log('📍 [ALTERNATIVE] update_tracking_location received, forwarding to primary handler');
    // Forward to the primary handler
    socket.emit('professionalLocationUpdate', data);
  });

  // ===== CUSTOMER REQUEST FOR LOCATION =====
  socket.on('request_location_update', async (data) => {
    try {
      const { bookingId } = data;
      console.log(`📍 Customer ${socket.userData.name} requesting location for booking: ${bookingId}`);

      if (!bookingId) {
        socket.emit('location_error', { message: 'Booking ID is required' });
        return;
      }

      const booking = await Booking.findById(bookingId)
        .populate('professional', '_id name')
        .populate('user', '_id');

      if (!booking) {
        console.error('❌ Booking not found');
        socket.emit('location_error', { message: 'Booking not found' });
        return;
      }

      // Verify customer is authorized
      if (socket.userRole !== 'user' || booking.user._id.toString() !== socket.userId) {
        console.error('❌ Unauthorized location request');
        socket.emit('location_error', { message: 'Not authorized for this booking' });
        return;
      }

      // Send last known location if available
      if (booking.tracking && booking.tracking.lastLocation && booking.tracking.lastLocation.coordinates) {
        const locationUpdate = {
          bookingId: bookingId,
          coordinates: booking.tracking.lastLocation.coordinates,
          timestamp: booking.tracking.lastLocation.timestamp || new Date().toISOString(),
          accuracy: booking.tracking.lastLocation.accuracy || 10,
          heading: booking.tracking.lastLocation.heading || 0,
          speed: booking.tracking.lastLocation.speed || 0,
          eta: booking.tracking.eta || null,
          distance: booking.tracking.distance || null,
        };

        socket.emit('professionalLocationUpdate', locationUpdate);
        console.log('✅ Sent last known location to customer');
      } else {
        console.warn('⚠️ No location data available for booking');
        socket.emit('location_info', { 
          message: 'Waiting for professional location updates',
          bookingId: bookingId 
        });
      }

    } catch (error) {
      console.error('❌ Error handling location request:', error);
      socket.emit('location_error', { message: 'Failed to retrieve location' });
    }
  });

  // ===== LOCATION HISTORY REQUEST =====
  socket.on('request_location_history', async (data) => {
    try {
      const { bookingId, limit = 50 } = data;
      
      // In a production app, you'd fetch this from a location history collection
      // For now, we'll just acknowledge the request
      console.log(`📜 Location history requested for booking: ${bookingId}`);
      
      socket.emit('location_history_response', {
        bookingId: bookingId,
        message: 'Location history feature coming soon',
        locations: []
      });

    } catch (error) {
      console.error('❌ Error fetching location history:', error);
    }
  });
};

/**
 * Setup booking-related events
 */
const setupBookingEvents = (socket) => {
  // Professional accepts booking
  socket.on('booking_accepted', async (data) => {
    try {
      const { bookingId } = data;
      console.log(`✅ Professional ${socket.userData.name} accepted booking: ${bookingId}`);
      
      io.to(`booking:${bookingId}`).emit('booking_status_update', {
        bookingId,
        status: 'accepted',
        acceptedBy: socket.userData,
        acceptedAt: new Date()
      });
    } catch (error) {
      console.error('❌ Error handling booking acceptance:', error);
    }
  });

  // Professional arrived
  socket.on('professional_arrived', async (data) => {
    try {
      const { bookingId } = data;
      console.log(`🎯 Professional ${socket.userData.name} arrived at booking: ${bookingId}`);
      
      const arrivalData = {
        bookingId,
        arrivedAt: new Date().toISOString(),
        eta: 0,
        message: 'Professional has arrived at your location'
      };

      io.to(`booking:${bookingId}`).emit('professionalArrived', arrivalData);
      io.to(`tracking:${bookingId}`).emit('professionalArrived', arrivalData);
      
      console.log('✅ Arrival notification sent');
    } catch (error) {
      console.error('❌ Error handling arrival:', error);
    }
  });

  // Service started
  socket.on('service_started', async (data) => {
    try {
      const { bookingId } = data;
      console.log(`▶️ Service started for booking: ${bookingId}`);
      
      const serviceData = {
        bookingId,
        startedAt: new Date().toISOString(),
        status: 'in_progress',
        message: 'Service has started'
      };

      io.to(`booking:${bookingId}`).emit('serviceStarted', serviceData);
      io.to(`tracking:${bookingId}`).emit('serviceStarted', serviceData);
      
      console.log('✅ Service start notification sent');
    } catch (error) {
      console.error('❌ Error handling service start:', error);
    }
  });

  // Service completed
  socket.on('service_completed', async (data) => {
    try {
      const { bookingId } = data;
      console.log(`✅ Service completed for booking: ${bookingId}`);
      
      const completionData = {
        bookingId,
        completedAt: new Date().toISOString(),
        status: 'completed',
        message: 'Service has been completed successfully'
      };

      io.to(`booking:${bookingId}`).emit('serviceCompleted', completionData);
      io.to(`tracking:${bookingId}`).emit('serviceCompleted', completionData);
      
      console.log('✅ Completion notification sent');
    } catch (error) {
      console.error('❌ Error handling completion:', error);
    }
  });

  // ETA update request
  socket.on('request_eta_update', async (data) => {
    try {
      const { bookingId } = data;
      console.log(`⏱️ ETA update requested for booking: ${bookingId}`);
      
      // Request professional to send updated location
      io.to(`booking:${bookingId}`).emit('eta_update_requested', { bookingId });
      
    } catch (error) {
      console.error('❌ Error requesting ETA update:', error);
    }
  });
};

/**
 * Handle socket disconnection
 */
const handleDisconnection = async (socket, reason) => {
  try {
    console.log(`🔌 User disconnected: ${socket.userData?.name || socket.userId} (${socket.userRole})`);
    console.log(`Reason: ${reason}`);

    // Clean up tracking sessions for this user
    const userSessions = Array.from(trackingSessions.entries())
      .filter(([key]) => key.startsWith(`${socket.userId}:`));

    for (const [sessionKey, session] of userSessions) {
      console.log(`🛑 Ending tracking session: ${session.bookingId}`);
      trackingSessions.delete(sessionKey);
      
      // Notify others in the room
      io.to(`booking:${session.bookingId}`).emit('participant_disconnected', {
        userId: socket.userId,
        userRole: socket.userRole,
        bookingId: session.bookingId,
        disconnectedAt: new Date()
      });
    }

    // Remove from active connections
    activeConnections.delete(socket.userId);

    console.log(`✅ Cleanup completed for ${socket.userData?.name || socket.userId}`);

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
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocket first.');
  }
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