
const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const logger = require('../config/logger');

class TrackingController {
  /**
   * Update professional's real-time location during active booking
   */
  async updateProfessionalLocation(req, res) {
    console.log('🚀 [TRACKING] Professional location update request');
    console.log('📍 [TRACKING] Coordinates:', req.body.coordinates);
    console.log('👨‍🔧 [TRACKING] Professional ID:', req.user._id);
    
    try {
      const { bookingId } = req.params;
      const { coordinates, heading, speed, accuracy } = req.body;
      
      // Validate input
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        console.log('❌ [TRACKING] Invalid coordinates format');
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates format. Expected [longitude, latitude]'
        });
      }
      
      const [longitude, latitude] = coordinates;
      
      // Validate coordinate ranges
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        console.log('❌ [TRACKING] Coordinates out of valid range');
        return res.status(400).json({
          success: false,
          message: 'Coordinates out of valid range'
        });
      }
      
      console.log('🔍 [TRACKING] Finding booking:', bookingId);
      
      // Find and validate booking
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone currentLocation')
        .populate('professional', 'name phone');
      
      if (!booking) {
        console.log('❌ [TRACKING] Booking not found');
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Verify professional authorization
      if (!booking.professional || booking.professional._id.toString() !== req.user._id.toString()) {
        console.log('❌ [TRACKING] Unauthorized professional');
        return res.status(403).json({
          success: false,
          message: 'Not authorized for this booking'
        });
      }
      
      // Check booking status
      if (!['accepted', 'in_progress'].includes(booking.status)) {
        console.log('❌ [TRACKING] Invalid booking status:', booking.status);
        return res.status(400).json({
          success: false,
          message: `Cannot update location for booking with status: ${booking.status}`
        });
      }
      
      console.log('📊 [TRACKING] Calculating distance and ETA...');
      
      // Calculate distance and ETA to destination
      const distance = this.calculateDistance(
        latitude, longitude,
        booking.location.coordinates[1], booking.location.coordinates[0]
      );
      
      const eta = this.calculateETA(distance, speed || 30);
      
      console.log('📏 [TRACKING] Distance:', distance.toFixed(2), 'km');
      console.log('⏱️ [TRACKING] ETA:', eta, 'minutes');
      
      // Update professional's current location
      await Professional.findByIdAndUpdate(req.user._id, {
        'currentLocation.type': 'Point',
        'currentLocation.coordinates': [longitude, latitude],
        'currentLocation.timestamp': new Date(),
        'currentLocation.accuracy': accuracy || null,
        'currentLocation.heading': heading || null,
        'currentLocation.speed': speed || null
      });
      
      // Update booking tracking information
      const trackingUpdate = {
        'tracking.lastLocation.type': 'Point',
        'tracking.lastLocation.coordinates': [longitude, latitude],
        'tracking.lastLocation.timestamp': new Date(),
        'tracking.eta': eta,
        'tracking.distance': distance,
        'tracking.lastUpdate': new Date()
      };
      
      if (heading !== undefined) trackingUpdate['tracking.heading'] = heading;
      if (speed !== undefined) trackingUpdate['tracking.speed'] = speed;
      if (accuracy !== undefined) trackingUpdate['tracking.accuracy'] = accuracy;
      
      await Booking.findByIdAndUpdate(bookingId, trackingUpdate);
      
      console.log('✅ [TRACKING] Location updated successfully');
      
      // Prepare real-time update data
      const locationUpdateData = {
        bookingId: bookingId,
        professionalLocation: {
          coordinates: [longitude, latitude],
          timestamp: new Date(),
          heading: heading || null,
          speed: speed || null,
          accuracy: accuracy || null
        },
        eta: eta,
        distance: distance,
        isMoving: speed && speed > 0.5,
        status: booking.status
      };
      
      // Send real-time updates via socket
      console.log('📡 [TRACKING] Broadcasting location update...');
      this.broadcastLocationUpdate(booking, locationUpdateData);
      
      res.json({
        success: true,
        message: 'Location updated successfully',
        data: {
          bookingId: bookingId,
          coordinates: [longitude, latitude],
          eta: eta,
          distance: distance,
          timestamp: new Date()
        }
      });
      
    } catch (error) {
      console.error('❌ [TRACKING] Error updating location:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get current tracking information for a booking
   */
  async getTrackingInfo(req, res) {
    console.log('🔍 [TRACKING] Getting tracking info for booking:', req.params.bookingId);
    
    try {
      const { bookingId } = req.params;
      
      // Validate booking ID
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }
      
      // Find booking with populated data
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone currentLocation')
        .populate('professional', 'name phone currentLocation rating')
        .populate('service', 'name category estimatedDuration');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Check authorization
      const userId = req.user._id.toString();
      const isAuthorized = 
        (booking.user && booking.user._id.toString() === userId) ||
        (booking.professional && booking.professional._id.toString() === userId) ||
        req.userRole === 'admin';
      
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this booking tracking'
        });
      }
      
      // Prepare response data
      let trackingData = {
        bookingId: booking._id,
        status: booking.status,
        scheduledDate: booking.scheduledDate,
        destination: {
          coordinates: booking.location.coordinates,
          address: booking.location.address || 'Service location'
        },
        tracking: booking.tracking || {},
        isTrackingActive: ['accepted', 'in_progress'].includes(booking.status)
      };
      
      // Add professional data for users
      if (req.userRole === 'user' && booking.professional) {
        trackingData.professional = {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone,
          rating: booking.professional.rating || 0,
          currentLocation: booking.professional.currentLocation || null
        };
        
        // Calculate current ETA if professional has location
        if (booking.professional.currentLocation && booking.professional.currentLocation.coordinates) {
          const distance = this.calculateDistance(
            booking.professional.currentLocation.coordinates[1],
            booking.professional.currentLocation.coordinates[0],
            booking.location.coordinates[1],
            booking.location.coordinates[0]
          );
          
          trackingData.realTimeTracking = {
            professionalLocation: {
              coordinates: booking.professional.currentLocation.coordinates,
              timestamp: booking.professional.currentLocation.timestamp || new Date()
            },
            distance: distance,
            eta: this.calculateETA(distance),
            isMoving: booking.tracking?.speed > 0.5 || false
          };
        }
      }
      
      // Add user data for professionals
      if (req.userRole === 'professional' && booking.user) {
        trackingData.customer = {
          _id: booking.user._id,
          name: booking.user.name,
          phone: booking.user.phone
        };
      }
      
      res.json({
        success: true,
        data: trackingData
      });
      
    } catch (error) {
      console.error('❌ [TRACKING] Error getting tracking info:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get tracking information',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Start tracking when professional accepts booking
   */
  async startTracking(req, res) {
    console.log('🚀 [TRACKING] Starting tracking for booking:', req.params.bookingId);
    
    try {
      const { bookingId } = req.params;
      
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone')
        .populate('professional', 'name phone currentLocation');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Verify professional authorization
      if (!booking.professional || booking.professional._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized for this booking'
        });
      }
      
      // Check if booking is in correct status
      if (booking.status !== 'accepted') {
        return res.status(400).json({
          success: false,
          message: `Cannot start tracking for booking with status: ${booking.status}`
        });
      }
      
      // Calculate initial ETA if professional has location
      let initialETA = null;
      let initialDistance = null;
      
      if (booking.professional.currentLocation && booking.professional.currentLocation.coordinates) {
        initialDistance = this.calculateDistance(
          booking.professional.currentLocation.coordinates[1],
          booking.professional.currentLocation.coordinates[0],
          booking.location.coordinates[1],
          booking.location.coordinates[0]
        );
        initialETA = this.calculateETA(initialDistance);
      }
      
      // Update booking with tracking initialization
      const trackingData = {
        'tracking.trackingStarted': new Date(),
        'tracking.isActive': true,
        'tracking.eta': initialETA,
        'tracking.distance': initialDistance
      };
      
      if (booking.professional.currentLocation) {
        trackingData['tracking.lastLocation'] = booking.professional.currentLocation;
      }
      
      await Booking.findByIdAndUpdate(bookingId, trackingData);
      
      console.log('✅ [TRACKING] Tracking started successfully');
      
      // Broadcast tracking start
      const trackingStartData = {
        bookingId: bookingId,
        status: 'tracking_started',
        initialETA: initialETA,
        initialDistance: initialDistance,
        professional: {
          name: booking.professional.name,
          currentLocation: booking.professional.currentLocation
        },
        message: 'Live tracking has started!'
      };
      
      this.broadcastTrackingStart(booking, trackingStartData);
      
      res.json({
        success: true,
        message: 'Tracking started successfully',
        data: {
          bookingId: bookingId,
          trackingStarted: true,
          initialETA: initialETA,
          initialDistance: initialDistance
        }
      });
      
    } catch (error) {
      console.error('❌ [TRACKING] Error starting tracking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start tracking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Stop tracking when service is completed
   */
  async stopTracking(req, res) {
    console.log('🛑 [TRACKING] Stopping tracking for booking:', req.params.bookingId);
    
    try {
      const { bookingId } = req.params;
      
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name')
        .populate('professional', 'name');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Verify professional authorization
      if (!booking.professional || booking.professional._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized for this booking'
        });
      }
      
      // Update booking to stop tracking
      await Booking.findByIdAndUpdate(bookingId, {
        'tracking.trackingEnded': new Date(),
        'tracking.isActive': false,
        'tracking.eta': 0
      });
      
      console.log('✅ [TRACKING] Tracking stopped successfully');
      
      // Broadcast tracking stop
      this.broadcastTrackingStop(booking, {
        bookingId: bookingId,
        status: 'tracking_stopped',
        message: 'Live tracking has ended.'
      });
      
      res.json({
        success: true,
        message: 'Tracking stopped successfully',
        data: {
          bookingId: bookingId,
          trackingEnded: true
        }
      });
      
    } catch (error) {
      console.error('❌ [TRACKING] Error stopping tracking:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to stop tracking',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }
  
  /**
   * Calculate ETA based on distance and average speed
   */
  calculateETA(distance, averageSpeed = 30) {
    if (!distance || distance <= 0) return 0;
    
    // Calculate time in minutes based on distance and average speed (km/h)
    const timeInHours = distance / averageSpeed;
    const timeInMinutes = Math.round(timeInHours * 60);
    
    return Math.max(1, timeInMinutes); // Minimum 1 minute
  }
  
  /**
   * Broadcast location update to relevant clients
   */
  broadcastLocationUpdate(booking, locationData) {
    try {
      // Get socket instance
      const EnhancedSocketService = require('../services/socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io) {
        console.log('⚠️ [TRACKING] Socket.IO not available for broadcasting');
        return;
      }
      
      console.log('📡 [TRACKING] Broadcasting to user:', booking.user.toString());
      
      // Send to user's personal room
      io.to(`user:${booking.user.toString()}`).emit('location_updated', locationData);
      
      // Send to booking tracking room
      io.to(`tracking:${booking._id}`).emit('location_updated', locationData);
      
      // Send to professional's personal room (confirmation)
      if (booking.professional) {
        io.to(`user:${booking.professional._id.toString()}`).emit('location_update_confirmed', {
          bookingId: booking._id,
          timestamp: new Date(),
          eta: locationData.eta,
          distance: locationData.distance
        });
      }
      
      console.log('📤 [TRACKING] Location update broadcasted successfully');
      
    } catch (error) {
      console.error('❌ [TRACKING] Error broadcasting location update:', error);
    }
  }
  
  /**
   * Broadcast tracking start to relevant clients
   */
  broadcastTrackingStart(booking, trackingData) {
    try {
      const EnhancedSocketService = require('../services/socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io) return;
      
      // Send to user
      io.to(`user:${booking.user._id.toString()}`).emit('tracking_started', trackingData);
      
      // Send to professional
      io.to(`user:${booking.professional._id.toString()}`).emit('tracking_started', {
        ...trackingData,
        message: 'You have started live tracking!'
      });
      
      console.log('📤 [TRACKING] Tracking start broadcasted');
      
    } catch (error) {
      console.error('❌ [TRACKING] Error broadcasting tracking start:', error);
    }
  }
  
  /**
   * Broadcast tracking stop to relevant clients
   */
  broadcastTrackingStop(booking, trackingData) {
    try {
      const EnhancedSocketService = require('../services/socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io) return;
      
      // Send to user
      io.to(`user:${booking.user._id.toString()}`).emit('tracking_stopped', trackingData);
      
      // Send to professional
      io.to(`user:${booking.professional._id.toString()}`).emit('tracking_stopped', trackingData);
      
      // Send to tracking room
      io.to(`tracking:${booking._id}`).emit('tracking_stopped', trackingData);
      
      console.log('📤 [TRACKING] Tracking stop broadcasted');
      
    } catch (error) {
      console.error('❌ [TRACKING] Error broadcasting tracking stop:', error);
    }
  }
}

module.exports = new TrackingController();