
const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');
const User = require('../models/user.model');
const logger = require('../config/logger');

class BookingService {
  
  /**
   * Create booking with proper location handling
   */
  async createBooking(bookingData, userId) {
    console.log('📝 [BOOKING-SERVICE] Creating booking with data:', JSON.stringify(bookingData, null, 2));
    console.log('👤 [BOOKING-SERVICE] User ID:', userId);
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const { serviceId, location, scheduledDate, isEmergency, notes } = bookingData;
      
      // Validate location data
      if (!location || !location.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        throw new Error('Invalid location coordinates. Expected [longitude, latitude]');
      }
      
      const [longitude, latitude] = location.coordinates;
      
      // Validate coordinate ranges
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        throw new Error('Coordinates out of valid range');
      }
      
      console.log('📍 [BOOKING-SERVICE] Location coordinates:', [longitude, latitude]);
      
      // Get service details
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new Error('Service not found');
      }
      
      console.log('🔧 [BOOKING-SERVICE] Service found:', service.name, service.category);
      
      // Get user details with current location
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Update user's current location if provided
      if (location.coordinates) {
        await User.findByIdAndUpdate(userId, {
          'currentLocation.type': 'Point',
          'currentLocation.coordinates': location.coordinates,
          'currentLocation.lastUpdated': new Date()
        }, { session });
        
        console.log('📍 [BOOKING-SERVICE] Updated user location');
      }
      
      // Generate unique verification code
      const verificationCode = this.generateVerificationCode();
      
      // Calculate total amount
      let totalAmount = service.pricing?.basePrice || service.price || 0;
      if (isEmergency) {
        totalAmount += 200; // Emergency fee
      }
      
      console.log('💰 [BOOKING-SERVICE] Total amount:', totalAmount);
      
      // Create booking
      const booking = new Booking({
        user: userId,
        service: serviceId,
        scheduledDate: isEmergency ? new Date() : new Date(scheduledDate),
        location: {
          type: 'Point',
          coordinates: location.coordinates,
          address: location.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        },
        totalAmount: totalAmount,
        verificationCode: verificationCode,
        isEmergency: isEmergency || false,
        status: 'pending',
        notes: notes || '',
        tracking: {
          isActive: false,
          created: new Date()
        }
      });
      
      await booking.save({ session });
      
      console.log('✅ [BOOKING-SERVICE] Booking created with ID:', booking._id);
      
      // Find nearby professionals for this service category
      const nearbyProfessionals = await this.findNearbyProfessionals(
        location.coordinates, 
        service.category, 
        isEmergency ? 50 : 25 // Larger radius for emergency
      );
      
      console.log(`👨‍🔧 [BOOKING-SERVICE] Found ${nearbyProfessionals.length} nearby professionals`);
      
      await session.commitTransaction();
      
      // Send notifications to nearby professionals (async)
      setTimeout(() => {
        this.notifyNearbyProfessionals(booking, nearbyProfessionals);
      }, 100);
      
      return booking;
      
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ [BOOKING-SERVICE] Error creating booking:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Professional accepts booking with location verification
   */
  async acceptBooking(bookingId, professionalId) {
    console.log(`👨‍🔧 [BOOKING-SERVICE] Professional ${professionalId} accepting booking ${bookingId}`);
    
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find booking
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone currentLocation')
        .populate('service', 'name category pricing')
        .session(session);
      
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking is still pending
      if (booking.status !== 'pending') {
        throw new Error(`Booking is already ${booking.status}`);
      }
      
      // Find professional
      const professional = await Professional.findById(professionalId).session(session);
      if (!professional) {
        throw new Error('Professional not found');
      }
      
      // Verify professional specialization
      if (!professional.specializations.includes(booking.service.category)) {
        throw new Error('Service category does not match professional specialization');
      }
      
      // Check professional availability
      if (!professional.isAvailable) {
        throw new Error('Professional is not currently available');
      }
      
      console.log('📍 [BOOKING-SERVICE] Calculating initial ETA...');
      
      // Calculate initial ETA and distance
      let initialETA = null;
      let initialDistance = null;
      
      if (professional.currentLocation && professional.currentLocation.coordinates) {
        initialDistance = this.calculateDistance(
          professional.currentLocation.coordinates[1], // Professional lat
          professional.currentLocation.coordinates[0], // Professional lng
          booking.location.coordinates[1], // Booking lat
          booking.location.coordinates[0]  // Booking lng
        );
        
        initialETA = this.calculateETA(initialDistance);
        
        console.log('📏 [BOOKING-SERVICE] Initial distance:', initialDistance.toFixed(2), 'km');
        console.log('⏱️ [BOOKING-SERVICE] Initial ETA:', initialETA, 'minutes');
      } else {
        console.log('⚠️ [BOOKING-SERVICE] Professional location not available for ETA calculation');
      }
      
      // Update booking
      booking.professional = professionalId;
      booking.status = 'accepted';
      booking.acceptedAt = new Date();
      
      // Initialize tracking data
      if (!booking.tracking) booking.tracking = {};
      booking.tracking.trackingInitialized = new Date();
      booking.tracking.initialETA = initialETA;
      booking.tracking.initialDistance = initialDistance;
      booking.tracking.isActive = true;
      
      // Set professional's initial location in tracking
      if (professional.currentLocation) {
        booking.tracking.lastLocation = {
          type: 'Point',
          coordinates: professional.currentLocation.coordinates,
          timestamp: new Date()
        };
        booking.tracking.eta = initialETA;
        booking.tracking.distance = initialDistance;
      }
      
      await booking.save({ session });
      
      // Update professional availability
      professional.isAvailable = false;
      professional.currentBooking = {
        bookingId: bookingId,
        acceptedAt: new Date()
      };
      await professional.save({ session });
      
      console.log('✅ [BOOKING-SERVICE] Booking accepted successfully');
      
      await session.commitTransaction();
      
      // Send real-time notifications
      setTimeout(() => {
        this.notifyBookingAccepted(booking, professional, initialETA, initialDistance);
      }, 100);
      
      return booking;
      
    } catch (error) {
      await session.abortTransaction();
      console.error('❌ [BOOKING-SERVICE] Error accepting booking:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Start service and enable live tracking
   */
  async startService(bookingId, professionalId) {
    console.log(`🚀 [BOOKING-SERVICE] Starting service for booking ${bookingId}`);
    
    try {
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone')
        .populate('professional', 'name phone currentLocation');
      
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'accepted') {
        throw new Error(`Booking is ${booking.status}, cannot start service`);
      }
      
      // Verify professional authorization
      if (!booking.professional || booking.professional._id.toString() !== professionalId.toString()) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Update booking status and tracking
      booking.status = 'in_progress';
      if (!booking.tracking) booking.tracking = {};
      
      booking.tracking.startedAt = new Date();
      booking.tracking.liveTrackingEnabled = true;
      booking.tracking.isActive = true;
      
      // Set current professional location for live tracking
      if (booking.professional.currentLocation) {
        booking.tracking.lastLocation = {
          type: 'Point',
          coordinates: booking.professional.currentLocation.coordinates,
          timestamp: new Date()
        };
        
        // Recalculate ETA with current location
        const currentDistance = this.calculateDistance(
          booking.professional.currentLocation.coordinates[1],
          booking.professional.currentLocation.coordinates[0],
          booking.location.coordinates[1],
          booking.location.coordinates[0]
        );
        
        booking.tracking.eta = this.calculateETA(currentDistance);
        booking.tracking.distance = currentDistance;
      }
      
      await booking.save();
      
      console.log('✅ [BOOKING-SERVICE] Service started with live tracking enabled');
      
      // Notify about service start and tracking activation
      setTimeout(() => {
        this.notifyServiceStarted(booking);
      }, 100);
      
      return booking;
      
    } catch (error) {
      console.error('❌ [BOOKING-SERVICE] Error starting service:', error);
      throw error;
    }
  }
  
  /**
   * Professional arrived at location
   */
  async professionalArrived(bookingId, professionalId) {
    console.log(`[BOOKING-SERVICE] Professional arrived at booking ${bookingId}`);
    
    try {
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone')
        .populate('professional', 'name phone currentLocation');
      
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'in_progress') {
        throw new Error(`Booking is ${booking.status}, not in progress`);
      }
      
      if (!booking.professional || booking.professional._id.toString() !== professionalId.toString()) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Update tracking info
      if (!booking.tracking) booking.tracking = {};
      
      booking.tracking.arrivedAt = new Date();
      booking.tracking.eta = 0; // Professional has arrived
      
      // Record arrival location
      if (booking.professional.currentLocation) {
        booking.tracking.arrivalLocation = {
          type: 'Point',
          coordinates: booking.professional.currentLocation.coordinates,
          timestamp: new Date()
        };
      }
      
      await booking.save();
      
      console.log(`Professional arrived for booking ${bookingId}`);
      
      // Notify about arrival
      setTimeout(() => {
        this.notifyProfessionalArrived(booking);
      }, 100);
      
      return booking;
      
    } catch (error) {
      console.error('[BOOKING-SERVICE] Error marking professional arrived:', error);
      throw error;
    }
  }
  
  /**
   * Complete service with verification
   */
  async completeService(bookingId, professionalId, verificationCode) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`[BOOKING-SERVICE] Completing booking ${bookingId} with code ${verificationCode}`);
      
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'in_progress') {
        throw new Error(`Booking is ${booking.status}, not in progress`);
      }
      
      if (!booking.professional || booking.professional._id.toString() !== professionalId.toString()) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      if (booking.verificationCode !== verificationCode) {
        throw new Error('Invalid verification code');
      }
      
      // Update booking
      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.paymentStatus = 'paid';
      
      // Stop tracking
      if (booking.tracking) {
        booking.tracking.liveTrackingEnabled = false;
        booking.tracking.trackingEndedAt = new Date();
        booking.tracking.isActive = false;
      }
      
      await booking.save({ session });
      
      // Update professional availability
      await Professional.findByIdAndUpdate(
        professionalId,
        { 
          isAvailable: true,
          $unset: { currentBooking: 1 }
        },
        { session }
      );
      
      console.log(`Booking ${bookingId} completed successfully`);
      
      await session.commitTransaction();
      
      // Notify about completion
      setTimeout(() => {
        this.notifyServiceCompleted(booking);
      }, 100);
      
      return booking;
      
    } catch (error) {
      await session.abortTransaction();
      console.error('[BOOKING-SERVICE] Error completing booking:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Find nearby professionals
   */
  async findNearbyProfessionals(coordinates, serviceCategory, radiusKm = 25) {
    try {
      console.log(`[BOOKING-SERVICE] Finding professionals near ${coordinates} for ${serviceCategory}`);
      
      const [longitude, latitude] = coordinates;
      
      const professionals = await Professional.find({
        specializations: serviceCategory,
        isAvailable: true,
        status: 'verified',
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: radiusKm * 1000 // Convert km to meters
          }
        }
      }).limit(10);
      
      console.log(`Found ${professionals.length} nearby professionals`);
      
      return professionals;
      
    } catch (error) {
      console.error('[BOOKING-SERVICE] Error finding nearby professionals:', error);
      return [];
    }
  }
  
  /**
   * Generate verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
  
  /**
   * Calculate distance between two points
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
    
    return Math.round(distance * 100) / 100;
  }
  
  /**
   * Calculate ETA based on distance
   */
  calculateETA(distance, averageSpeed = 30) {
    if (!distance || distance <= 0) return 0;
    
    const timeInHours = distance / averageSpeed;
    const timeInMinutes = Math.round(timeInHours * 60);
    
    return Math.max(1, timeInMinutes);
  }
  
  /**
   * Notify nearby professionals about new booking
   */
  notifyNearbyProfessionals(booking, professionals) {
    try {
      const EnhancedSocketService = require('./socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io || professionals.length === 0) return;
      
      const notificationData = {
        bookingId: booking._id,
        service: booking.service,
        location: booking.location,
        scheduledDate: booking.scheduledDate,
        totalAmount: booking.totalAmount,
        isEmergency: booking.isEmergency,
        distance: null // Will be calculated per professional
      };
      
      professionals.forEach(professional => {
        // Calculate distance for this professional
        if (professional.currentLocation?.coordinates) {
          const distance = this.calculateDistance(
            professional.currentLocation.coordinates[1],
            professional.currentLocation.coordinates[0],
            booking.location.coordinates[1],
            booking.location.coordinates[0]
          );
          
          const professionalNotification = {
            ...notificationData,
            distance: distance,
            eta: this.calculateETA(distance)
          };
          
          io.to(`user:${professional._id}`).emit('new_booking_available', professionalNotification);
        }
      });
      
      console.log(`[BOOKING-SERVICE] Notified ${professionals.length} professionals about new booking`);
      
    } catch (error) {
      console.error('[BOOKING-SERVICE] Error notifying professionals:', error);
    }
  }
  
  /**
   * Notify about booking acceptance
   */
  notifyBookingAccepted(booking, professional, initialETA, initialDistance) {
    try {
      const EnhancedSocketService = require('./socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io) return;
      
      const acceptanceData = {
        bookingId: booking._id,
        status: 'accepted',
        professional: {
          _id: professional._id,
          name: professional.name,
          phone: professional.phone,
          rating: professional.rating || 0,
          currentLocation: professional.currentLocation
        },
        trackingInitialized: true,
        initialETA: initialETA,
        initialDistance: initialDistance,
        message: 'Your booking has been accepted! The professional is getting ready.'
      };
      
      // Send to user
      io.to(`user:${booking.user}`).emit('booking_accepted', acceptanceData);
      
      // Send to booking room
      io.to(`booking:${booking._id}`).emit('booking_update', {
        status: 'accepted',
        professional: acceptanceData.professional,
        tracking: {
          initialized: true,
          eta: initialETA,
          distance: initialDistance
        }
      });
      
      console.log(`[BOOKING-SERVICE] Booking acceptance notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('[BOOKING-SERVICE] Error sending acceptance notifications:', error);
    }
  }
  
  /**
   * Notify about service start
   */
  notifyServiceStarted(booking) {
    try {
      const EnhancedSocketService = require('./socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io) return;
      
      const serviceStartData = {
        bookingId: booking._id,
        status: 'in_progress',
        liveTrackingEnabled: true,
        trackingStarted: booking.tracking.startedAt,
        currentLocation: booking.tracking.lastLocation,
        eta: booking.tracking.eta,
        message: 'Service has started! Live tracking is now active.'
      };
      
      // Send to user
      io.to(`user:${booking.user}`).emit('service_started', serviceStartData);
      
      // Send to professional
      io.to(`user:${booking.professional}`).emit('service_started', {
        ...serviceStartData,
        message: 'Service started! Your location will be shared with the customer.'
      });
      
      // Send to tracking room
      io.to(`tracking:${booking._id}`).emit('service_started', serviceStartData);
      
      console.log(`[BOOKING-SERVICE] Service start notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('[BOOKING-SERVICE] Error sending service start notifications:', error);
    }
  }
  
  /**
   * Notify about professional arrival
   */
  notifyProfessionalArrived(booking) {
    try {
      const EnhancedSocketService = require('./socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io) return;
      
      const arrivalData = {
        bookingId: booking._id,
        status: 'professional_arrived',
        arrivedAt: booking.tracking.arrivedAt,
        eta: 0,
        message: 'The professional has arrived at your location!'
      };
      
      // Send to user
      io.to(`user:${booking.user}`).emit('professional_arrived', arrivalData);
      
      // Send to tracking room
      io.to(`tracking:${booking._id}`).emit('professional_arrived', arrivalData);
      
      console.log(`[BOOKING-SERVICE] Professional arrival notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('[BOOKING-SERVICE] Error sending arrival notifications:', error);
    }
  }
  
  /**
   * Notify about service completion
   */
  notifyServiceCompleted(booking) {
    try {
      const EnhancedSocketService = require('./socket.service');
      const io = EnhancedSocketService.getIO();
      
      if (!io) return;
      
      const completionData = {
        bookingId: booking._id,
        status: 'completed',
        completedAt: booking.completedAt,
        trackingEnded: true,
        message: 'Service completed successfully! Thank you for choosing our service.'
      };
      
      // Send to both user and professional
      io.to(`user:${booking.user}`).emit('service_completed', completionData);
      io.to(`user:${booking.professional}`).emit('service_completed', {
        ...completionData,
        message: 'Service completed successfully! You are now available for new bookings.'
      });
      
      // Send to tracking room and end session
      io.to(`tracking:${booking._id}`).emit('service_completed', completionData);
      io.to(`tracking:${booking._id}`).emit('tracking_session_ended', {
        bookingId: booking._id,
        reason: 'service_completed'
      });
      
      console.log(`[BOOKING-SERVICE] Service completion notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('[BOOKING-SERVICE] Error sending completion notifications:', error);
    }
  }
}

module.exports = new BookingService();