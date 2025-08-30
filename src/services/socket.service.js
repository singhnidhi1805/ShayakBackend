
const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const logger = require('../config/logger');

let io;
const activeConnections = new Map(); // Store active socket connections
const trackingSessions = new Map(); // Store active tracking sessions
const bookingRooms = new Map(); // Store booking room memberships

/**
 * Initialize enhanced socket.io server with real-time tracking
 */
const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    allowRequest: (req, callback) => {
      // Allow all requests for now, but you can add IP filtering here
      callback(null, true);
    }
  });
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || 
                   socket.handshake.headers.authorization?.replace('Bearer ', '') ||
                   socket.handshake.query.token;
      
      if (!token) {
        logger.warn(`Socket connection attempt without token from ${socket.handshake.address}`);
        return next(new Error('Authentication token is missing'));
      }
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id || decoded._id || decoded.userId;
      socket.userRole = decoded.role || decoded.userRole || 'user';
      
      // Get user details
      let userData;
      if (socket.userRole === 'professional') {
        userData = await Professional.findById(socket.userId);
      } else {
        userData = await User.findById(socket.userId);
      }
      
      if (!userData) {
        return next(new Error('User not found'));
      }
      
      socket.userData = {
        _id: userData._id,
        name: userData.name || 'Unknown User',
        phone: userData.phone || '',
        role: socket.userRole
      };
      
      logger.info(`Socket authenticated: ${socket.userId} (${socket.userRole}) - ${socket.userData.name}`);
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
      userData: socket.userData,
      connectedAt: new Date(),
      lastActivity: new Date()
    });
    
    // Join user's personal room and role room
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);
    
    // Send connection confirmation
    socket.emit('connected', {
      userId: socket.userId,
      role: socket.userRole,
      connectedAt: new Date()
    });
    
    // Setup event handlers
    setupTrackingEvents(socket);
    setupBookingEvents(socket);
    setupLocationEvents(socket);
    setupChatEvents(socket);
    
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
  
  logger.info('Enhanced Socket.io server initialized with real-time tracking support');
  return io;
};

/**
 * Setup tracking-specific socket events
 */
const setupTrackingEvents = (socket) => {
  // Start tracking session for a booking
  socket.on('start_tracking_session', async (data) => {
    try {
      const { bookingId } = data;
      
      if (!bookingId) {
        socket.emit('tracking_error', { message: 'Booking ID is required' });
        return;
      }
      
      logger.info(`Starting tracking session for booking: ${bookingId}, User: ${socket.userId}`);
      
      // Verify booking exists and user has access
      const booking = await Booking.findById(bookingId)
        .populate('user', '_id name phone currentLocation')
        .populate('professional', '_id name phone currentLocation rating')
        .populate('service', 'name category estimatedDuration');
      
      if (!booking) {
        socket.emit('tracking_error', { message: 'Booking not found' });
        return;
      }
      
      // Check authorization
      const isAuthorized = 
        (socket.userRole === 'user' && booking.user._id.toString() === socket.userId) ||
        (socket.userRole === 'professional' && booking.professional && booking.professional._id.toString() === socket.userId) ||
        (socket.userRole === 'admin');
      
      if (!isAuthorized) {
        socket.emit('tracking_error', { message: 'Not authorized for this booking' });
        return;
      }
      
      // Join booking-specific tracking room
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
      
      // Prepare initial tracking data
      let initialTrackingData = {
        bookingId: bookingId,
        status: booking.status,
        userRole: socket.userRole,
        trackingStarted: true,
        service: {
          name: booking.service.name,
          category: booking.service.category,
          estimatedDuration: booking.service.estimatedDuration
        },
        destination: {
          coordinates: booking.location.coordinates,
          address: booking.location.address || 'Service location'
        }
      };
      
      // Add role-specific data
      if (socket.userRole === 'user' && booking.professional) {
        initialTrackingData.professional = {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone,
          rating: booking.professional.rating || 0,
          currentLocation: booking.professional.currentLocation
        };
        
        // Calculate current ETA if professional has location
        if (booking.professional.currentLocation?.coordinates) {
          const distance = calculateDistance(
            booking.professional.currentLocation.coordinates[1],
            booking.professional.currentLocation.coordinates[0],
            booking.location.coordinates[1],
            booking.location.coordinates[0]
          );
          initialTrackingData.currentETA = calculateETA(distance);
          initialTrackingData.currentDistance = distance;
        }
      } else if (socket.userRole === 'professional') {
        initialTrackingData.customer = {
          _id: booking.user._id,
          name: booking.user.name,
          phone: booking.user.phone
        };
        
        initialTrackingData.destination = {
          coordinates: booking.location.coordinates,
          address: booking.location.address || 'Customer location'
        };
      }
      
      // Add existing tracking data
      if (booking.tracking) {
        initialTrackingData.trackingHistory = {
          initialETA: booking.tracking.initialETA,
          currentETA: booking.tracking.eta,
          distance: booking.tracking.distance,
          startedAt: booking.tracking.startedAt,
          arrivedAt: booking.tracking.arrivedAt,
          lastLocation: booking.tracking.lastLocation
        };
      }
      
      socket.emit('tracking_session_started', initialTrackingData);
      logger.info(`Tracking session started for booking: ${bookingId}`);
      
    } catch (error) {
      logger.error(`Error starting tracking session: ${error.message}`);
      socket.emit('tracking_error', { message: 'Failed to start tracking session' });
    }
  });
  
  // Professional location updates during active tracking
  socket.on('update_tracking_location', async (data) => {
    try {
      if (socket.userRole !== 'professional') {
        socket.emit('tracking_error', { message: 'Only professionals can update tracking location' });
        return;
      }
      
      const { bookingId, coordinates, heading, speed, accuracy } = data;
      
      if (!bookingId || !coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        socket.emit('tracking_error', { message: 'Invalid tracking data' });
        return;
      }
      
      logger.info(`Professional ${socket.userId} updating location for booking ${bookingId}: ${coordinates}`);
      
      // Find booking and verify authorization
      const booking = await Booking.findById(bookingId).populate('user', 'name');
      
      if (!booking || !booking.professional || booking.professional.toString() !== socket.userId) {
        socket.emit('tracking_error', { message: 'Not authorized for this booking' });
        return;
      }
      
      // Validate booking status
      if (!['accepted', 'in_progress'].includes(booking.status)) {
        socket.emit('tracking_error', { message: `Cannot update location for booking with status: ${booking.status}` });
        return;
      }
      
      const [longitude, latitude] = coordinates;
      
      // Validate coordinate ranges
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        socket.emit('tracking_error', { message: 'Coordinates out of valid range' });
        return;
      }
      
      // Update professional's location in database
      await Professional.findByIdAndUpdate(socket.userId, {
        'currentLocation.type': 'Point',
        'currentLocation.coordinates': coordinates,
        'currentLocation.timestamp': new Date(),
        'currentLocation.accuracy': accuracy || null,
        'currentLocation.heading': heading || null,
        'currentLocation.speed': speed || null
      });
      
      // Calculate ETA and distance to booking location
      const distance = calculateDistance(
        latitude, longitude,
        booking.location.coordinates[1], booking.location.coordinates[0]
      );
      const eta = calculateETA(distance, speed);
      
      // Update booking tracking information
      const trackingUpdate = {
        'tracking.lastLocation.type': 'Point',
        'tracking.lastLocation.coordinates': coordinates,
        'tracking.lastLocation.timestamp': new Date(),
        'tracking.eta': eta,
        'tracking.distance': distance,
        'tracking.lastUpdate': new Date()
      };
      
      if (heading !== undefined) trackingUpdate['tracking.heading'] = heading;
      if (speed !== undefined) trackingUpdate['tracking.speed'] = speed;
      if (accuracy !== undefined) trackingUpdate['tracking.accuracy'] = accuracy;
      
      await Booking.findByIdAndUpdate(bookingId, trackingUpdate);
      
      // Prepare location update data for broadcast
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
        isMoving: speed > 1.0, // Moving if speed > 1 km/h
        lastUpdate: new Date()
      };
      
      // Broadcast to tracking room
      const trackingRoom = `tracking:${bookingId}`;
      socket.to(trackingRoom).emit('location_updated', locationUpdate);
      
      // Also send to user's personal room for reliability
      if (booking.user) {
        io.to(`user:${booking.user._id}`).emit('professional_location_update', locationUpdate);
      }
      
      // Confirm to professional
      socket.emit('location_update_confirmed', {
        bookingId: bookingId,
        timestamp: new Date(),
        eta: eta,
        distance: distance,
        coordinates: coordinates
      });
      
      logger.info(`Location updated for booking ${bookingId}: ETA ${eta}min, Distance ${distance.toFixed(2)}km`);
      
    } catch (error) {
      logger.error(`Error updating tracking location: ${error.message}`);
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
          requestedAt: new Date(),
          customerName: socket.userData.name
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
  socket.on('join_booking_room', async (data) => {
    try {
      const { bookingId } = data;
      
      if (!bookingId) {
        socket.emit('booking_error', { message: 'Booking ID is required' });
        return;
      }
      
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
      
      const bookingRoom = `booking:${bookingId}`;
      socket.join(bookingRoom);
      
      // Store room membership
      if (!bookingRooms.has(bookingId)) {
        bookingRooms.set(bookingId, new Set());
      }
      bookingRooms.get(bookingId).add(socket.userId);
      
      socket.emit('booking_room_joined', { bookingId, room: bookingRoom });
      
      logger.info(`User ${socket.userId} joined booking room: ${bookingRoom}`);
      
    } catch (error) {
      logger.error(`Error joining booking room: ${error.message}`);
      socket.emit('booking_error', { message: 'Failed to join booking room' });
    }
  });
  
  // Leave booking room
  socket.on('leave_booking_room', (data) => {
    try {
      const { bookingId } = data;
      
      if (bookingId) {
        const bookingRoom = `booking:${bookingId}`;
        socket.leave(bookingRoom);
        
        // Remove from room membership
        if (bookingRooms.has(bookingId)) {
          bookingRooms.get(bookingId).delete(socket.userId);
          if (bookingRooms.get(bookingId).size === 0) {
            bookingRooms.delete(bookingId);
          }
        }
        
        socket.emit('booking_room_left', { bookingId });
        logger.info(`User ${socket.userId} left booking room: ${bookingRoom}`);
      }
      
    } catch (error) {
      logger.error(`Error leaving booking room: ${error.message}`);
    }
  });
  
  // Booking status updates
  socket.on('booking_status_update', async (data) => {
    try {
      const { bookingId, status, message } = data;
      
      const booking = await Booking.findById(bookingId);
      if (!booking) return;
      
      // Verify authorization
      const isAuthorized = 
        (socket.userRole === 'professional' && booking.professional && booking.professional.toString() === socket.userId) ||
        (socket.userRole === 'admin');
      
      if (!isAuthorized) return;
      
      // Broadcast status update
      const statusUpdate = {
        bookingId: bookingId,
        status: status,
        message: message || `Booking status updated to ${status}`,
        timestamp: new Date(),
        updatedBy: socket.userData.name
      };
      
      io.to(`booking:${bookingId}`).emit('booking_status_updated', statusUpdate);
      
      logger.info(`Booking status updated: ${bookingId} -> ${status}`);
      
    } catch (error) {
      logger.error(`Error updating booking status: ${error.message}`);
    }
  });
};

/**
 * Setup location-related events
 */
const setupLocationEvents = (socket) => {
  // Professional availability update with location
  socket.on('update_availability', async (data) => {
    try {
      if (socket.userRole !== 'professional') {
        socket.emit('location_error', { message: 'Only professionals can update availability' });
        return;
      }
      
      const { isAvailable, coordinates } = data;
      
      const updateData = {
        isAvailable: isAvailable
      };
      
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
      
      logger.info(`Professional ${socket.userId} availability updated: ${isAvailable}`);
      
    } catch (error) {
      logger.error(`Error updating availability: ${error.message}`);
      socket.emit('location_error', { message: 'Failed to update availability' });
    }
  });
  
  // Heartbeat location update for active professionals
  socket.on('heartbeat_location', async (data) => {
    try {
      if (socket.userRole !== 'professional') return;
      
      const { coordinates, accuracy, heading, speed } = data;
      
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) return;
      
      // Update professional location
      await Professional.findByIdAndUpdate(socket.userId, {
        'currentLocation.coordinates': coordinates,
        'currentLocation.timestamp': new Date(),
        'currentLocation.accuracy': accuracy || null,
        'currentLocation.heading': heading || null,
        'currentLocation.speed': speed || null
      });
      
      // Update active connection
      if (activeConnections.has(socket.userId)) {
        activeConnections.get(socket.userId).lastLocation = {
          coordinates,
          timestamp: new Date()
        };
      }
      
    } catch (error) {
      logger.error(`Error updating heartbeat location: ${error.message}`);
    }
  });
};

/**
 * Setup chat-related events
 */
const setupChatEvents = (socket) => {
  // Join chat room for booking
  socket.on('join_chat', async (data) => {
    try {
      const { bookingId } = data;
      
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('chat_error', { message: 'Booking not found' });
        return;
      }
      
      // Check authorization
      const isAuthorized = 
        (socket.userRole === 'user' && booking.user.toString() === socket.userId) ||
        (socket.userRole === 'professional' && booking.professional && booking.professional.toString() === socket.userId);
      
      if (!isAuthorized) {
        socket.emit('chat_error', { message: 'Not authorized for this chat' });
        return;
      }
      
      const chatRoom = `chat:${bookingId}`;
      socket.join(chatRoom);
      
      socket.emit('chat_joined', { bookingId, room: chatRoom });
      
    } catch (error) {
      logger.error(`Error joining chat: ${error.message}`);
      socket.emit('chat_error', { message: 'Failed to join chat' });
    }
  });
  
  // Send chat message
  socket.on('send_message', async (data) => {
    try {
      const { bookingId, message, type = 'text' } = data;
      
      if (!bookingId || !message) {
        socket.emit('chat_error', { message: 'Missing required fields' });
        return;
      }
      
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        socket.emit('chat_error', { message: 'Booking not found' });
        return;
      }
      
      // Verify authorization
      const isAuthorized = 
        (socket.userRole === 'user' && booking.user.toString() === socket.userId) ||
        (socket.userRole === 'professional' && booking.professional && booking.professional.toString() === socket.userId);
      
      if (!isAuthorized) {
        socket.emit('chat_error', { message: 'Not authorized to send messages' });
        return;
      }
      
      const messageData = {
        bookingId: bookingId,
        senderId: socket.userId,
        senderName: socket.userData.name,
        senderRole: socket.userRole,
        message: message,
        type: type,
        timestamp: new Date()
      };
      
      // Broadcast to chat room
      io.to(`chat:${bookingId}`).emit('new_message', messageData);
      
      logger.info(`Message sent in booking ${bookingId} by ${socket.userData.name}`);
      
    } catch (error) {
      logger.error(`Error sending message: ${error.message}`);
      socket.emit('chat_error', { message: 'Failed to send message' });
    }
  });
};

/**
 * Handle socket disconnection
 */
const handleDisconnection = (socket, reason) => {
  logger.info(`User disconnected: ${socket.userId}, Reason: ${reason}`);
  
  try {
    // Clean up tracking sessions
    const userSessions = Array.from(trackingSessions.entries())
      .filter(([key, session]) => session.userId === socket.userId);
    
    userSessions.forEach(([sessionKey, session]) => {
      logger.info(`Cleaning up tracking session: ${session.bookingId}`);
      
      // Notify others in tracking room
      socket.to(session.room).emit('participant_disconnected', {
        bookingId: session.bookingId,
        userId: socket.userId,
        userName: socket.userData.name,
        userRole: socket.userRole,
        disconnectedAt: new Date()
      });
      
      trackingSessions.delete(sessionKey);
    });
    
    // Clean up booking room memberships
    bookingRooms.forEach((members, bookingId) => {
      if (members.has(socket.userId)) {
        members.delete(socket.userId);
        if (members.size === 0) {
          bookingRooms.delete(bookingId);
        }
      }
    });
    
    // Remove from active connections
    activeConnections.delete(socket.userId);
    
    // Update professional availability if they disconnect unexpectedly
    if (socket.userRole === 'professional') {
      setTimeout(async () => {
        try {
          await Professional.findByIdAndUpdate(socket.userId, {
            'currentLocation.lastSeen': new Date()
          });
        } catch (error) {
          logger.error(`Error updating professional last seen: ${error.message}`);
        }
      }, 1000);
    }
    
  } catch (error) {
    logger.error(`Error during disconnection cleanup: ${error.message}`);
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
 * Calculate ETA based on distance and average speed
 */
const calculateETA = (distance, averageSpeed = 30) => {
  if (!distance || distance <= 0) return 0;
  
  const timeInHours = distance / averageSpeed;
  const timeInMinutes = Math.round(timeInHours * 60);
  
  return Math.max(1, timeInMinutes);
};

/**
 * Get active connections info
 */
const getActiveConnections = () => {
  return Array.from(activeConnections.entries()).map(([userId, connection]) => ({
    userId,
    role: connection.role,
    userData: connection.userData,
    connectedAt: connection.connectedAt,
    lastActivity: connection.lastActivity
  }));
};

/**
 * Get active tracking sessions info
 */
const getActiveTrackingSessions = () => {
  return Array.from(trackingSessions.values()).map(session => ({
    bookingId: session.bookingId,
    userId: session.userId,
    userRole: session.userRole,
    startedAt: session.startedAt
  }));
};

/**
 * Send tracking update to specific user
 */
const sendTrackingUpdate = (userId, data) => {
  try {
    if (io && activeConnections.has(userId)) {
      io.to(`user:${userId}`).emit('tracking_update', data);
      logger.info(`Tracking update sent to user: ${userId}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error sending tracking update: ${error.message}`);
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
      logger.info(`Booking update sent for booking: ${bookingId}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error sending booking update: ${error.message}`);
    return false;
  }
};

/**
 * Send location update to relevant parties
 */
const sendLocationUpdate = (professionalId, locationData) => {
  try {
    if (io) {
      // Send to professional
      io.to(`user:${professionalId}`).emit('location_update', locationData);
      
      // Find active bookings for this professional and notify customers
      Booking.find({
        professional: professionalId,
        status: { $in: ['accepted', 'in_progress'] }
      }).then(bookings => {
        bookings.forEach(booking => {
          io.to(`user:${booking.user}`).emit('professional_location_update', {
            ...locationData,
            bookingId: booking._id
          });
        });
      });
      
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`Error sending location update: ${error.message}`);
    return false;
  }
};

/**
 * Broadcast emergency alert to nearby professionals
 */
const broadcastEmergencyAlert = (location, serviceCategory, bookingData) => {
  try {
    if (!io) return false;
    
    // Send to all online professionals in the category
    io.to('role:professional').emit('emergency_booking_alert', {
      location: location,
      serviceCategory: serviceCategory,
      bookingData: bookingData,
      alertTime: new Date()
    });
    
    logger.info(`Emergency alert broadcasted for ${serviceCategory} at ${location}`);
    return true;
    
  } catch (error) {
    logger.error(`Error broadcasting emergency alert: ${error.message}`);
    return false;
  }
};

module.exports = {
  initializeSocket,
  sendTrackingUpdate,
  sendBookingUpdate,
  sendLocationUpdate,
  broadcastEmergencyAlert,
  getActiveConnections,
  getActiveTrackingSessions,
  getIO: () => io
};