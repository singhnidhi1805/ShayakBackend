const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const logger = require('../config/logger');

let io;
const activeConnections = new Map(); // Store active socket connections
const trackingSessions = new Map(); // Store active tracking sessions

/**
 * Initialize enhanced socket.io server with tracking capabilities
 */
const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000
  });
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        logger.warn('Socket connection attempt without token');
        return next(new Error('Authentication token is missing'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id || decoded._id || decoded.userId;
      socket.userRole = decoded.role || decoded.userRole;
      
      logger.info(`Socket authenticated: ${socket.userId} (${socket.userRole})`);
      next();
    } catch (error) {
      logger.error(`Socket auth error: ${error.message}`);
      next(new Error('Authentication failed'));
    }
  });
  
  // Connection handler
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId}, Role: ${socket.userRole}, Socket: ${socket.id}`);
    
    // Store active connection
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      socket: socket,
      role: socket.userRole,
      connectedAt: new Date()
    });
    
    // Join user's personal room
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);
    
    // Setup tracking events
    setupTrackingEvents(socket);
    
    // Setup booking events
    setupBookingEvents(socket);
    
    // Setup location events
    setupLocationEvents(socket);
    
    // Handle reconnection
    socket.on('reconnect_tracking', async (data) => {
      await handleTrackingReconnection(socket, data);
    });
    
    // Disconnection handler
    socket.on('disconnect', (reason) => {
      logger.info(`User disconnected: ${socket.userId}, Reason: ${reason}`);
      
      // Clean up tracking session if active
      const trackingSessionKey = `${socket.userId}:tracking`;
      if (trackingSessions.has(trackingSessionKey)) {
        const session = trackingSessions.get(trackingSessionKey);
        logger.info(`Cleaning up tracking session for booking: ${session.bookingId}`);
        trackingSessions.delete(trackingSessionKey);
      }
      
      // Remove from active connections
      activeConnections.delete(socket.userId);
    });
  });
  
  logger.info('Enhanced Socket.io server initialized with tracking support');
  return io;
};

/**
 * Setup tracking-specific socket events
 */
const setupTrackingEvents = (socket) => {
  // Start tracking session
  socket.on('start_tracking_session', async (data) => {
    try {
      const { bookingId } = data;
      
      logger.info(`Starting tracking session for booking: ${bookingId}, User: ${socket.userId}`);
      
      // Verify booking exists and user has access
      const booking = await Booking.findById(bookingId)
        .populate('user', '_id name')
        .populate('professional', '_id name currentLocation');
      
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
      
      // Join booking-specific tracking room
      const trackingRoom = `tracking:${bookingId}`;
      socket.join(trackingRoom);
      
      // Store tracking session
      const sessionKey = `${socket.userId}:tracking`;
      trackingSessions.set(sessionKey, {
        bookingId: bookingId,
        userId: socket.userId,
        userRole: socket.userRole,
        socketId: socket// services/enhanced-socket.service.js (continued from previous)

.id,
        startedAt: new Date(),
        room: trackingRoom
      });
      
      // Send initial tracking data
      let initialTrackingData = {
        bookingId: bookingId,
        status: booking.status,
        userRole: socket.userRole,
        trackingStarted: true
      };
      
      // Add role-specific data
      if (socket.userRole === 'user' && booking.professional) {
        initialTrackingData.professional = {
          name: booking.professional.name,
          currentLocation: booking.professional.currentLocation
        };
        
        // Calculate initial ETA if professional has location
        if (booking.professional.currentLocation && booking.professional.currentLocation.coordinates) {
          initialTrackingData.eta = calculateETA(
            booking.professional.currentLocation.coordinates,
            booking.location.coordinates
          );
        }
      } else if (socket.userRole === 'professional') {
        initialTrackingData.destination = {
          coordinates: booking.location.coordinates,
          address: booking.location.address || 'Customer location'
        };
      }
      
      socket.emit('tracking_session_started', initialTrackingData);
      logger.info(`Tracking session started for booking: ${bookingId}`);
      
    } catch (error) {
      logger.error(`Error starting tracking session: ${error.message}`);
      socket.emit('tracking_error', { message: 'Failed to start tracking session' });
    }
  });
  
  // Professional location updates during tracking
  socket.on('update_tracking_location', async (data) => {
    try {
      if (socket.userRole !== 'professional') {
        socket.emit('tracking_error', { message: 'Only professionals can update tracking location' });
        return;
      }
      
      const { bookingId, coordinates, heading, speed, accuracy } = data;
      
      if (!bookingId || !coordinates || coordinates.length !== 2) {
        socket.emit('tracking_error', { message: 'Invalid tracking data' });
        return;
      }
      
      logger.info(`Professional ${socket.userId} updating tracking location for booking ${bookingId}`);
      
      // Verify booking and professional assignment
      const booking = await Booking.findById(bookingId);
      
      if (!booking || !booking.professional || booking.professional.toString() !== socket.userId) {
        socket.emit('tracking_error', { message: 'Not authorized for this booking' });
        return;
      }
      
      // Update professional's location in database
      await Professional.findByIdAndUpdate(socket.userId, {
        'currentLocation.coordinates': coordinates,
        'currentLocation.timestamp': new Date(),
        'currentLocation.accuracy': accuracy || null,
        'currentLocation.heading': heading || null,
        'currentLocation.speed': speed || null
      });
      
      // Calculate ETA and distance
      const distance = calculateDistance(
        coordinates[1], coordinates[0],
        booking.location.coordinates[1], booking.location.coordinates[0]
      );
      const eta = calculateETA(coordinates, booking.location.coordinates);
      
      // Update booking tracking
      const trackingUpdate = {
        lastLocation: {
          type: 'Point',
          coordinates: coordinates,
          timestamp: new Date()
        },
        eta: eta,
        distance: distance,
        heading: heading || null,
        speed: speed || null,
        accuracy: accuracy || null
      };
      
      if (!booking.tracking) booking.tracking = {};
      Object.assign(booking.tracking, trackingUpdate);
      await booking.save();
      
      // Broadcast to tracking room
      const trackingRoom = `tracking:${bookingId}`;
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
        isMoving: speed && speed > 0.5
      };
      
      io.to(trackingRoom).emit('location_updated', locationUpdate);
      
      // Also send to user's personal room for reliability
      io.to(`user:${booking.user}`).emit('professional_location_update', locationUpdate);
      
      socket.emit('location_update_confirmed', {
        bookingId: bookingId,
        timestamp: new Date(),
        eta: eta,
        distance: distance
      });
      
    } catch (error) {
      logger.error(`Error updating tracking location: ${error.message}`);
      socket.emit('tracking_error', { message: 'Failed to update location' });
    }
  });
  
  // End tracking session
  socket.on('end_tracking_session', async (data) => {
    try {
      const { bookingId } = data;
      const sessionKey = `${socket.userId}:tracking`;
      
      if (trackingSessions.has(sessionKey)) {
        const session = trackingSessions.get(sessionKey);
        
        // Leave tracking room
        socket.leave(session.room);
        
        // Remove session
        trackingSessions.delete(sessionKey);
        
        // Notify room that tracking ended
        io.to(session.room).emit('tracking_session_ended', {
          bookingId: bookingId,
          endedBy: socket.userId,
          endedAt: new Date()
        });
        
        logger.info(`Tracking session ended for booking: ${bookingId}`);
      }
      
      socket.emit('tracking_session_ended', { bookingId });
      
    } catch (error) {
      logger.error(`Error ending tracking session: ${error.message}`);
      socket.emit('tracking_error', { message: 'Failed to end tracking session' });
    }
  });
  
  // Request ETA update from professional
  socket.on('request_eta_update', async (data) => {
    try {
      if (socket.userRole !== 'user') {
        socket.emit('tracking_error', { message: 'Only customers can request ETA updates' });
        return;
      }
      
      const { bookingId } = data;
      
      const booking = await Booking.findById(bookingId);
      if (!booking || booking.user.toString() !== socket.userId) {
        socket.emit('tracking_error', { message: 'Not authorized for this booking' });
        return;
      }
      
      // Send request to professional
      if (booking.professional) {
        io.to(`user:${booking.professional}`).emit('eta_update_requested', {
          bookingId: bookingId,
          requestedBy: socket.userId,
          requestedAt: new Date()
        });
        
        socket.emit('eta_request_sent', { bookingId });
        logger.info(`ETA update requested for booking: ${bookingId}`);
      }
      
    } catch (error) {
      logger.error(`Error requesting ETA update: ${error.message}`);
      socket.emit('tracking_error', { message: 'Failed to request ETA update' });
    }
  });
};

/**
 * Setup booking-related socket events
 */
const setupBookingEvents = (socket) => {
  // Join booking room for updates
  socket.on('join_booking_updates', async (bookingId) => {
    try {
      const booking = await Booking.findById(bookingId);
      
      if (!booking) {
        socket.emit('booking_error', { message: 'Booking not found' });
        return;
      }
      
      // Check authorization
      const isAuthorized = 
        (socket.userRole === 'user' && booking.user.toString() === socket.userId) ||
        (socket.userRole === 'professional' && booking.professional && booking.professional.toString() === socket.userId) ||
        (socket.userRole === 'admin');
      
      if (!isAuthorized) {
        socket.emit('booking_error', { message: 'Not authorized for this booking' });
        return;
      }
      
      socket.join(`booking:${bookingId}`);
      socket.emit('booking_joined', { bookingId });
      
    } catch (error) {
      logger.error(`Error joining booking updates: ${error.message}`);
      socket.emit('booking_error', { message: 'Failed to join booking updates' });
    }
  });
  
  // Professional accepting booking
  socket.on('booking_accepted', async (data) => {
    try {
      const { bookingId } = data;
      
      // Notify user about acceptance
      const booking = await Booking.findById(bookingId).populate('professional', 'name phone');
      
      if (booking) {
        io.to(`user:${booking.user}`).emit('booking_status_update', {
          bookingId: bookingId,
          status: 'accepted',
          professional: {
            name: booking.professional.name,
            phone: booking.professional.phone
          },
          message: 'Your booking has been accepted! Professional is getting ready.'
        });
        
        // Start tracking automatically when booking is accepted
        io.to(`booking:${bookingId}`).emit('tracking_ready', {
          bookingId: bookingId,
          message: 'Tracking is now available for this booking'
        });
      }
      
    } catch (error) {
      logger.error(`Error handling booking acceptance: ${error.message}`);
    }
  });
};

/**
 * Setup location-related events
 */
const setupLocationEvents = (socket) => {
  // Professional availability update
  socket.on('update_availability', async (data) => {
    try {
      if (socket.userRole !== 'professional') {
        socket.emit('location_error', { message: 'Only professionals can update availability' });
        return;
      }
      
      const { isAvailable, coordinates } = data;
      
      await Professional.findByIdAndUpdate(socket.userId, {
        isAvailable: isAvailable,
        'currentLocation.coordinates': coordinates || undefined,
        'currentLocation.timestamp': new Date()
      });
      
      socket.emit('availability_updated', { isAvailable, coordinates });
      
    } catch (error) {
      logger.error(`Error updating availability: ${error.message}`);
      socket.emit('location_error', { message: 'Failed to update availability' });
    }
  });
};

/**
 * Handle tracking reconnection
 */
const handleTrackingReconnection = async (socket, data) => {
  try {
    const { bookingId } = data;
    
    logger.info(`Handling tracking reconnection for booking: ${bookingId}, User: ${socket.userId}`);
    
    // Verify booking and get current state
    const booking = await Booking.findById(bookingId)
      .populate('professional', 'name currentLocation');
    
    if (!booking) {
      socket.emit('tracking_error', { message: 'Booking not found' });
      return;
    }
    
    // Rejoin tracking room
    const trackingRoom = `tracking:${bookingId}`;
    socket.join(trackingRoom);
    
    // Send current tracking state
    let trackingState = {
      bookingId: bookingId,
      status: booking.status,
      reconnected: true
    };
    
    if (booking.professional && booking.professional.currentLocation) {
      trackingState.currentLocation = booking.professional.currentLocation;
      trackingState.eta = booking.tracking?.eta || null;
      trackingState.distance = booking.tracking?.distance || null;
    }
    
    socket.emit('tracking_reconnected', trackingState);
    
  } catch (error) {
    logger.error(`Error handling tracking reconnection: ${error.message}`);
    socket.emit('tracking_error', { message: 'Failed to reconnect tracking' });
  }
};

/**
 * Calculate distance between two points
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
 * Calculate ETA based on distance and average speed
 */
const calculateETA = (startCoords, endCoords, averageSpeed = 30) => {
  const [startLng, startLat] = startCoords;
  const [endLng, endLat] = endCoords;
  
  const distance = calculateDistance(startLat, startLng, endLat, endLng);
  const timeInMinutes = Math.round((distance / averageSpeed) * 60);
  
  return Math.max(1, timeInMinutes);
};

/**
 * Public methods for external use
 */
const sendTrackingUpdate = (userId, data) => {
  if (io && activeConnections.has(userId)) {
    io.to(`user:${userId}`).emit('tracking_update', data);
    logger.info(`Tracking update sent to user: ${userId}`);
  }
};

const sendBookingUpdate = (bookingId, data) => {
  if (io) {
    io.to(`booking:${bookingId}`).emit('booking_update', data);
    io.to(`tracking:${bookingId}`).emit('booking_update', data);
    logger.info(`Booking update sent for booking: ${bookingId}`);
  }
};

const sendLocationUpdate = (professionalId, locationData) => {
  if (io) {
    io.to(`user:${professionalId}`).emit('location_update', locationData);
  }
};

const getActiveConnections = () => {
  return Array.from(activeConnections.entries()).map(([userId, connection]) => ({
    userId,
    role: connection.role,
    connectedAt: connection.connectedAt
  }));
};

const getActiveTrackingSessions = () => {
  return Array.from(trackingSessions.values());
};

module.exports = {
  initializeSocket,
  sendTrackingUpdate,
  sendBookingUpdate,
  sendLocationUpdate,
  getActiveConnections,
  getActiveTrackingSessions,
  getIO: () => io
};