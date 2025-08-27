// controllers/tracking.controller.js
const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const SocketService = require('../services/socket.service');

class TrackingController {
  /**
   * Update professional's real-time location during active booking
   */
  async updateProfessionalLocation(req, res) {
    try {
      const { bookingId } = req.params;
      const { coordinates, heading, speed, accuracy } = req.body;
      
      console.log('📍 [TRACKING] Updating professional location for booking:', bookingId);
      
      // Validate coordinates
      if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates format. Expected [longitude, latitude]'
        });
      }
      
      const [longitude, latitude] = coordinates;
      
      // Validate coordinate values
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinate values'
        });
      }
      
      // Find booking and verify professional assignment
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone')
        .populate('service', 'name category');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Verify professional is assigned to this booking
      if (!booking.professional || !booking.professional.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to update location for this booking'
        });
      }
      
      // Only allow location updates for active bookings
      if (!['accepted', 'in_progress'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Cannot update location for booking with status: ${booking.status}`
        });
      }
      
      // Calculate ETA and distance
      const eta = this.calculateETA(coordinates, booking.location.coordinates);
      const distance = this.calculateDistance(
        latitude, longitude,
        booking.location.coordinates[1], booking.location.coordinates[0]
      );
      
      // Update professional's current location
      await Professional.findByIdAndUpdate(req.user._id, {
        'currentLocation.coordinates': coordinates,
        'currentLocation.timestamp': new Date(),
        'currentLocation.accuracy': accuracy || null,
        'currentLocation.heading': heading || null,
        'currentLocation.speed': speed || null
      });
      
      // Update booking tracking info
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
      
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      Object.assign(booking.tracking, trackingUpdate);
      await booking.save();
      
      // Prepare tracking data for real-time update
      const trackingData = {
        bookingId: booking._id,
        professionalLocation: {
          coordinates: coordinates,
          timestamp: new Date(),
          heading: heading || null,
          speed: speed || null,
          accuracy: accuracy || null
        },
        eta: eta,
        distance: distance,
        status: booking.status,
        professional: {
          _id: req.user._id,
          name: req.user.name || 'Professional'
        }
      };
      
      // Send real-time update to user
      console.log('📡 [TRACKING] Sending real-time update to user:', booking.user);
      SocketService.sendTrackingUpdate(booking.user.toString(), trackingData);
      
      // Also send to booking room if user is listening
      SocketService.sendBookingUpdate(bookingId, {
        tracking: trackingUpdate,
        professionalLocation: {
          coordinates,
          timestamp: new Date()
        }
      });
      
      res.json({
        success: true,
        message: 'Location updated successfully',
        data: {
          bookingId: booking._id,
          eta: eta,
          distance: distance,
          coordinates: coordinates,
          timestamp: new Date()
        }
      });
      
    } catch (error) {
      console.error('❌ [TRACKING] Error updating professional location:', error);
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
    try {
      const { bookingId } = req.params;
      
      console.log('🔍 [TRACKING] Getting tracking info for booking:', bookingId);
      console.log('👤 [TRACKING] User role:', req.userRole);
      console.log('👤 [TRACKING] User ID:', req.user._id);
      
      // Find booking with populated data
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone currentLocation')
        .populate('professional', 'name phone currentLocation')
        .populate('service', 'name category estimatedDuration');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Check authorization
      const isAuthorized = 
        (req.userRole === 'user' && booking.user._id.toString() === req.user._id.toString()) ||
        (req.userRole === 'professional' && booking.professional && booking.professional._id.toString() === req.user._id.toString()) ||
        (req.userRole === 'admin');
      
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view tracking information'
        });
      }
      
      // Build response based on booking status and user role
      let trackingResponse = {
        bookingId: booking._id,
        status: booking.status,
        scheduledDate: booking.scheduledDate,
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
      
      // Add professional info for user
      if (req.userRole === 'user' && booking.professional) {
        trackingResponse.professional = {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone,
          currentLocation: booking.professional.currentLocation
        };
        
        // Calculate current ETA and distance if professional has location
        if (booking.professional.currentLocation && booking.professional.currentLocation.coordinates) {
          const [profLng, profLat] = booking.professional.currentLocation.coordinates;
          const [destLng, destLat] = booking.location.coordinates;
          
          const distance = this.calculateDistance(profLat, profLng, destLat, destLng);
          const eta = this.calculateETA([profLng, profLat], [destLng, destLat]);
          
          trackingResponse.realTimeTracking = {
            professionalLocation: {
              coordinates: [profLng, profLat],
              timestamp: booking.professional.currentLocation.timestamp,
              accuracy: booking.professional.currentLocation.accuracy
            },
            distance: distance,
            eta: eta,
            isMoving: this.isProfessionalMoving(booking.professional.currentLocation)
          };
        }
      }
      
      // Add user info for professional
      if (req.userRole === 'professional') {
        trackingResponse.customer = {
          _id: booking.user._id,
          name: booking.user.name,
          phone: booking.user.phone
        };
        
        trackingResponse.navigation = {
          destination: {
            coordinates: booking.location.coordinates,
            address: booking.location.address || 'Customer location'
          }
        };
      }
      
      // Add tracking history
      if (booking.tracking) {
        trackingResponse.tracking = {
          startedAt: booking.tracking.startedAt,
          arrivedAt: booking.tracking.arrivedAt,
          eta: booking.tracking.eta,
          lastUpdateAt: booking.tracking.lastLocation?.timestamp
        };
      }
      
      console.log('✅ [TRACKING] Tracking info retrieved successfully');
      
      res.json({
        success: true,
        data: trackingResponse
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
    try {
      const { bookingId } = req.params;
      
      console.log('🚀 [TRACKING] Starting tracking for booking:', bookingId);
      
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone')
        .populate('service', 'name category');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Verify professional is assigned
      if (!booking.professional || !booking.professional.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized for this booking'
        });
      }
      
      if (booking.status !== 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Booking must be accepted to start tracking'
        });
      }
      
      // Initialize tracking
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      booking.tracking.trackingStarted = new Date();
      await booking.save();
      
      // Get professional's current location
      const professional = await Professional.findById(req.user._id);
      let initialLocation = null;
      let initialETA = null;
      
      if (professional.currentLocation && professional.currentLocation.coordinates) {
        initialLocation = professional.currentLocation.coordinates;
        initialETA = this.calculateETA(initialLocation, booking.location.coordinates);
      }
      
      // Notify user that tracking has started
      const trackingStartData = {
        bookingId: booking._id,
        status: 'tracking_started',
        professional: {
          _id: req.user._id,
          name: req.user.name || 'Professional',
          currentLocation: initialLocation
        },
        eta: initialETA,
        message: 'Professional is on the way!'
      };
      
      SocketService.sendTrackingUpdate(booking.user._id.toString(), trackingStartData);
      
      res.json({
        success: true,
        message: 'Tracking started successfully',
        data: {
          bookingId: booking._id,
          trackingStarted: true,
          initialETA: initialETA
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
    try {
      const { bookingId } = req.params;
      
      console.log('🛑 [TRACKING] Stopping tracking for booking:', bookingId);
      
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone');
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Verify professional is assigned
      if (!booking.professional || !booking.professional.equals(req.user._id)) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized for this booking'
        });
      }
      
      // Update tracking end time
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      booking.tracking.trackingEnded = new Date();
      await booking.save();
      
      // Notify user that tracking has ended
      const trackingEndData = {
        bookingId: booking._id,
        status: 'tracking_ended',
        message: 'Service completed. Tracking ended.'
      };
      
      SocketService.sendTrackingUpdate(booking.user._id.toString(), trackingEndData);
      
      res.json({
        success: true,
        message: 'Tracking stopped successfully',
        data: {
          bookingId: booking._id,
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
    const R = 6371; // Earth's radius in kilometers
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
  calculateETA(startCoords, endCoords, averageSpeed = 30) {
    const [startLng, startLat] = startCoords;
    const [endLng, endLat] = endCoords;
    
    const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
    
    // Calculate time in minutes based on distance and average speed (km/h)
    const timeInHours = distance / averageSpeed;
    const timeInMinutes = Math.round(timeInHours * 60);
    
    return Math.max(1, timeInMinutes); // Minimum 1 minute
  }
  
  /**
   * Check if professional is moving based on location updates
   */
  isProfessionalMoving(currentLocation) {
    if (!currentLocation || !currentLocation.timestamp) {
      return false;
    }
    
    // Consider moving if location was updated in last 2 minutes and has speed data
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const isRecentUpdate = new Date(currentLocation.timestamp) > twoMinutesAgo;
    const hasSpeed = currentLocation.speed && currentLocation.speed > 0.5; // Moving faster than 0.5 m/s
    
    return isRecentUpdate && (hasSpeed || true); // For now, assume moving if recent update
  }
}

module.exports = new TrackingController();