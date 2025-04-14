// src/services/booking.service.js
const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const NotificationService = require('./notification.service');
const SocketService = require('./socket.service');
const GeospatialService = require('./geospatial.service');
const logger = require('../config/logger');

class BookingService {
  /**
   * Create a new booking
   * @param {Object} bookingData - Booking data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created booking
   */
  async createBooking(bookingData, userId) {
    try {
      const { serviceId, location, scheduledDate } = bookingData;
      
      logger.info(`Creating booking for service ${serviceId}, user ${userId}`);
      
      // Basic validation
      if (!serviceId || !location?.coordinates || !scheduledDate) {
        throw new Error('Missing required fields');
      }
      
      // Get service
      const service = await Service.findById(serviceId);
      if (!service) {
        throw new Error('Service not found');
      }
      
      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Calculate total amount
      let totalAmount = 0;
      if (service.pricing.type === 'fixed') {
        totalAmount = service.pricing.amount;
      } else if (service.pricing.type === 'range') {
        totalAmount = service.pricing.minAmount;
      } else if (service.pricing.type === 'hourly') {
        // Assume minimum 1 hour for now
        totalAmount = service.pricing.amount;
      }
      
      // Create booking
      const booking = new Booking({
        user: userId,
        service: serviceId,
        location: {
          type: 'Point',
          coordinates: location.coordinates
        },
        scheduledDate: new Date(scheduledDate),
        status: 'pending',
        totalAmount,
        verificationCode
      });
      
      // Save booking
      await booking.save();
      
      // Find professionals asynchronously (don't wait)
      this.findMatchingProfessionals(booking).catch(err => {
        logger.error('Error finding matching professionals:', err);
      });
      
      return booking;
    } catch (error) {
      logger.error('Booking creation error:', error);
      throw error;
    }
  }
  
  /**
   * Find matching professionals for a booking
   * @param {Object} booking - Booking object
   * @returns {Promise<Array>} Matching professionals
   */
  async findMatchingProfessionals(booking) {
    try {
      logger.info(`Finding professionals for booking ${booking._id}`);
      
      // Populate service details
      await booking.populate('service');
      
      // Find professionals with matching specialization near the booking location
      const professionals = await Professional.find({
        specializations: booking.service.category,
        status: 'verified',
        isAvailable: true,
        'currentLocation.coordinates': { $exists: true, $ne: [0, 0] },
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: booking.location.coordinates
            },
            $maxDistance: 15000 // 15km radius
          }
        }
      }).limit(5);
      
      if (professionals.length === 0) {
        logger.warn(`No matching professionals found for booking ${booking._id}`);
        return [];
      }
      
      // Notify professionals about new booking
      professionals.forEach(professional => {
        NotificationService.createNotification({
          recipient: professional._id,
          type: 'booking_request',
          title: 'New Booking Request',
          message: `New ${booking.service.name} service request near your location`,
          data: { bookingId: booking._id }
        }).catch(err => {
          logger.error(`Error sending notification to professional ${professional._id}:`, err);
        });
      });
      
      return professionals;
    } catch (error) {
      logger.error(`Error finding matching professionals for booking ${booking._id}:`, error);
      throw error;
    }
  }
  
  /**
   * Accept a booking (professional)
   * @param {string} bookingId - Booking ID
   * @param {string} professionalId - Professional ID
   * @returns {Promise<Object>} Updated booking
   */
  async acceptBooking(bookingId, professionalId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find booking
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking is already accepted
      if (booking.status !== 'pending') {
        throw new Error(`Booking is already ${booking.status}`);
      }
      
      // Find professional
      const professional = await Professional.findById(professionalId).session(session);
      if (!professional) {
        throw new Error('Professional not found');
      }
      
      // Check if professional is available
      if (!professional.isAvailable) {
        throw new Error('Professional is not available');
      }
      
      // Verify professional specialization matches service category
      await booking.populate('service');
      if (!professional.specializations.includes(booking.service.category)) {
        throw new Error('Service category does not match professional specialization');
      }
      
      // Update booking
      booking.professional = professionalId;
      booking.status = 'accepted';
      await booking.save({ session });
      
      // Update professional availability
      professional.isAvailable = false;
      await professional.save({ session });
      
      // Send notification to user
      const user = await User.findById(booking.user);
      await NotificationService.createNotification({
        recipient: booking.user,
        type: 'booking_confirmation',
        title: 'Booking Accepted',
        message: `Your booking has been accepted by ${professional.name}`,
        data: { bookingId: booking._id }
      });
      
      // Send socket notification
      SocketService.sendBookingUpdate(booking._id, {
        status: 'accepted',
        professional: {
          id: professional._id,
          name: professional.name,
          phone: professional.phone
        }
      });
      
      await session.commitTransaction();
      return booking;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error accepting booking ${bookingId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Start a service
   * @param {string} bookingId - Booking ID
   * @param {string} professionalId - Professional ID
   * @returns {Promise<Object>} Updated booking
   */
  async startService(bookingId, professionalId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find booking
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking is accepted
      if (booking.status !== 'accepted') {
        throw new Error(`Booking is ${booking.status}, not accepted`);
      }
      
      // Check if professional is assigned to this booking
      if (booking.professional.toString() !== professionalId) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Find professional to get their current location
      const professional = await Professional.findById(professionalId).session(session);
      if (!professional) {
        throw new Error('Professional not found');
      }
      
      // Get current location from professional
      const currentLocation = professional.currentLocation;
      
      // Update booking status and tracking info
      booking.status = 'in_progress';
      booking.tracking = {
        startedAt: new Date(),
        lastLocation: currentLocation,
        timestamp: new Date()
      };
      
      // Calculate ETA
      if (currentLocation && currentLocation.coordinates) {
        const eta = GeospatialService.estimateETA(
          currentLocation.coordinates,
          booking.location.coordinates
        );
        booking.tracking.eta = eta;
      }
      
      await booking.save({ session });
      
      // Send notification to user
      await NotificationService.createNotification({
        recipient: booking.user,
        type: 'service_started',
        title: 'Service Started',
        message: `Your service has been started by the professional`,
        data: { bookingId: booking._id }
      });
      
      // Send socket notification
      SocketService.sendBookingUpdate(booking._id, {
        status: 'in_progress',
        tracking: booking.tracking
      });
      
      await session.commitTransaction();
      return booking;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error starting service for booking ${bookingId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Complete a service
   * @param {string} bookingId - Booking ID
   * @param {string} professionalId - Professional ID
   * @param {string} verificationCode - Verification code
   * @returns {Promise<Object>} Updated booking
   */
  async completeService(bookingId, professionalId, verificationCode) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find booking
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking is in progress
      if (booking.status !== 'in_progress') {
        throw new Error(`Booking is ${booking.status}, not in_progress`);
      }
      
      // Check if professional is assigned to this booking
      if (booking.professional.toString() !== professionalId) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Verify the verification code
      if (booking.verificationCode !== verificationCode) {
        throw new Error('Invalid verification code');
      }
      
      // Update booking
      booking.status = 'completed';
      booking.completedAt = new Date();
      booking.paymentStatus = 'paid'; // Assuming payment is automatic
      await booking.save({ session });
      
      // Update professional's availability
      await Professional.findByIdAndUpdate(
        professionalId,
        { isAvailable: true },
        { session }
      );
      
      // Send notifications
      await NotificationService.createNotification({
        recipient: booking.user,
        type: 'service_completed',
        title: 'Service Completed',
        message: 'Your service has been completed',
        data: { bookingId: booking._id }
      });
      
      // Send socket notification
      SocketService.sendBookingUpdate(booking._id, {
        status: 'completed',
        completedAt: booking.completedAt
      });
      
      await session.commitTransaction();
      return booking;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error completing service for booking ${bookingId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Cancel a booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {string} userRole - User role
   * @param {string} reason - Cancellation reason
   * @returns {Promise<Object>} Updated booking
   */
  async cancelBooking(bookingId, userId, userRole, reason) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find booking
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking can be cancelled (only pending or accepted)
      if (!['pending', 'accepted'].includes(booking.status)) {
        throw new Error(`Cannot cancel booking with status ${booking.status}`);
      }
      
      // Check permissions
      if (userRole === 'user') {
        // User can only cancel their own bookings
        if (booking.user.toString() !== userId) {
          throw new Error('Not authorized to cancel this booking');
        }
      } else if (userRole === 'professional') {
        // Professional can only cancel assigned bookings
        if (!booking.professional || booking.professional.toString() !== userId) {
          throw new Error('Not authorized to cancel this booking');
        }
      }
      
      // Update booking
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancelledBy = userId;
      booking.cancellationReason = reason;
      await booking.save({ session });
      
      // If professional was assigned, update their availability
      if (booking.professional) {
        await Professional.findByIdAndUpdate(
          booking.professional,
          { isAvailable: true },
          { session }
        );
      }
      
      // Send notifications
      if (userRole === 'user') {
        // Notify professional if assigned
        if (booking.professional) {
          await NotificationService.createNotification({
            recipient: booking.professional,
            type: 'booking_cancellation',
            title: 'Booking Cancelled',
            message: `Booking was cancelled by the customer: ${reason || 'No reason provided'}`,
            data: { bookingId: booking._id }
          });
        }
      } else if (userRole === 'professional') {
        // Notify user
        await NotificationService.createNotification({
          recipient: booking.user,
          type: 'booking_cancellation',
          title: 'Booking Cancelled',
          message: `Your booking was cancelled by the professional: ${reason || 'No reason provided'}`,
          data: { bookingId: booking._id }
        });
      }
      
      // Send socket notification
      SocketService.sendBookingUpdate(booking._id, {
        status: 'cancelled',
        cancelledAt: booking.cancelledAt,
        cancelledBy: userRole,
        reason
      });
      
      await session.commitTransaction();
      return booking;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error cancelling booking ${bookingId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Reschedule a booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {Date} newDate - New scheduled date
   * @param {string} reason - Rescheduling reason
   * @returns {Promise<Object>} Updated booking
   */
  async rescheduleBooking(bookingId, userId, newDate, reason) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find booking
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking can be rescheduled (only pending or accepted)
      if (!['pending', 'accepted'].includes(booking.status)) {
        throw new Error(`Cannot reschedule booking with status ${booking.status}`);
      }
      
      // Check permissions (only user can reschedule)
      if (booking.user.toString() !== userId) {
        throw new Error('Not authorized to reschedule this booking');
      }
      
      // Store old date
      const oldDate = booking.scheduledDate;
      
      // Update booking
      booking.scheduledDate = new Date(newDate);
      booking.reschedulingHistory.push({
        oldDate,
        newDate: booking.scheduledDate,
        rescheduledBy: userId,
        rescheduledAt: new Date(),
        reason
      });
      
      await booking.save({ session });
      
      // Notify professional if assigned
      if (booking.professional) {
        await NotificationService.createNotification({
          recipient: booking.professional,
          type: 'booking_rescheduled',
          title: 'Booking Rescheduled',
          message: `Booking has been rescheduled to ${new Date(newDate).toLocaleString()}`,
          data: { bookingId: booking._id }
        });
      }
      
      // Send socket notification
      SocketService.sendBookingUpdate(booking._id, {
        scheduledDate: booking.scheduledDate,
        rescheduled: true,
        reason
      });
      
      await session.commitTransaction();
      return booking;
    } catch (error) {
      await session.abortTransaction();
      logger.error(`Error rescheduling booking ${bookingId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Update ETA for a booking
   * @param {string} bookingId - Booking ID
   * @param {string} professionalId - Professional ID
   * @param {number} etaMinutes - ETA in minutes
   * @param {Array} coordinates - Current coordinates [longitude, latitude]
   * @returns {Promise<Object>} Updated booking
   */
  async updateETA(bookingId, professionalId, etaMinutes, coordinates = null) {
    try {
      // Find booking
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking is in progress or accepted
      if (!['in_progress', 'accepted'].includes(booking.status)) {
        throw new Error(`Cannot update ETA for booking with status ${booking.status}`);
      }
      
      // Check if professional is assigned to this booking
      if (booking.professional.toString() !== professionalId) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Update tracking info
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      booking.tracking.eta = etaMinutes;
      booking.tracking.timestamp = new Date();
      
      // Update location if provided
      if (coordinates) {
        booking.tracking.lastLocation = {
          type: 'Point',
          coordinates,
          timestamp: new Date()
        };
        
        // Also update professional's location
        await Professional.findByIdAndUpdate(professionalId, {
          'currentLocation.coordinates': coordinates,
          'currentLocation.timestamp': new Date()
        });
      }
      
      await booking.save();
      
      // Send notification to user
      await NotificationService.createNotification({
        recipient: booking.user,
        type: 'eta_update',
        title: 'ETA Updated',
        message: `Professional will arrive in ${etaMinutes} minutes`,
        data: { bookingId: booking._id }
      });
      
      // Send socket notification
      SocketService.sendBookingUpdate(booking._id, {
        tracking: booking.tracking
      });
      
      return booking;
    } catch (error) {
      logger.error(`Error updating ETA for booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Professional arrived at location
   * @param {string} bookingId - Booking ID
   * @param {string} professionalId - Professional ID
   * @returns {Promise<Object>} Updated booking
   */
  async professionalArrived(bookingId, professionalId) {
    try {
      // Find booking
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking is in progress
      if (booking.status !== 'in_progress') {
        throw new Error(`Booking is ${booking.status}, not in_progress`);
      }
      
      // Check if professional is assigned to this booking
      if (booking.professional.toString() !== professionalId) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Update tracking info
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      booking.tracking.arrivedAt = new Date();
      booking.tracking.eta = 0;
      await booking.save();
      
      // Send notification to user
      await NotificationService.createNotification({
        recipient: booking.user,
        type: 'professional_arrived',
        title: 'Professional Arrived',
        message: 'The professional has arrived at your location',
        data: { bookingId: booking._id }
      });
      
      // Send socket notification
      SocketService.sendBookingUpdate(booking._id, {
        professionalArrived: true,
        arrivedAt: booking.tracking.arrivedAt
      });
      
      return booking;
    } catch (error) {
      logger.error(`Error marking professional arrived for booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Rate a booking
   * @param {string} bookingId - Booking ID
   * @param {string} userId - User ID
   * @param {number} rating - Rating score (1-5)
   * @param {string} review - Review text
   * @returns {Promise<Object>} Updated booking
   */
  async rateBooking(bookingId, userId, rating, review) {
    try {
      // Find booking
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      // Check if booking is completed
      if (booking.status !== 'completed') {
        throw new Error('Only completed bookings can be rated');
      }
      
      // Check permissions
      if (booking.user.toString() !== userId) {
        throw new Error('Not authorized to rate this booking');
      }
      
      // Check if already rated
      if (booking.rating && booking.rating.score) {
        throw new Error('Booking already rated');
      }
      
      // Validate rating
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5');
      }
      
      // Update booking with rating
      booking.rating = {
        score: rating,
        review: review || '',
        createdAt: new Date()
      };
      
      await booking.save();
      
      // Update professional's average rating
      if (booking.professional) {
        const professional = await Professional.findById(booking.professional);
        
        if (professional) {
          // Get all rated bookings for this professional
          const ratedBookings = await Booking.find({
            professional: booking.professional,
            'rating.score': { $exists: true, $ne: null }
          });
          
          // Calculate average rating
          const totalRatings = ratedBookings.length;
          const sumRatings = ratedBookings.reduce((sum, b) => sum + b.rating.score, 0);
          const averageRating = totalRatings > 0 ? sumRatings / totalRatings : 0;
          
          // Update professional
          professional.rating = {
            average: parseFloat(averageRating.toFixed(1)),
            count: totalRatings
          };
          
          await professional.save();
          
          // Notify professional
          await NotificationService.createNotification({
            recipient: booking.professional,
            type: 'new_rating',
            title: 'New Rating',
            message: `You received a ${rating}-star rating`,
            data: { bookingId: booking._id, rating }
          });
        }
      }
      
      return booking;
    } catch (error) {
      logger.error(`Error rating booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Create emergency booking
   * @param {Object} bookingData - Booking data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created booking
   */
  async createEmergencyBooking(bookingData, userId) {
    try {
      // Create a normal booking first
      const booking = await this.createBooking(bookingData, userId);
      
      // Mark as emergency
      booking.isEmergency = true;
      booking.priority = 'high';
      await booking.save();
      
      // Find professionals within smaller radius (5km) for faster response
      const professionals = await Professional.find({
        specializations: bookingData.service,
        status: 'verified',
        isAvailable: true,
        'currentLocation.coordinates': { $exists: true, $ne: [0, 0] },
        currentLocation: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: booking.location.coordinates
            },
            $maxDistance: 5000 // 5km radius for emergency
          }
        }
      }).limit(5);
      
      // Send emergency notifications with higher priority
      professionals.forEach(professional => {
        NotificationService.createNotification({
          recipient: professional._id,
          type: 'emergency_booking',
          title: 'EMERGENCY SERVICE REQUEST',
          message: 'Emergency service request near your location',
          data: { 
            bookingId: booking._id,
            isEmergency: true,
            priority: 'high'
          }
        }).catch(err => {
          logger.error(`Error sending emergency notification to professional ${professional._id}:`, err);
        });
      });
      
      return booking;
    } catch (error) {
      logger.error('Emergency booking creation error:', error);
      throw error;
    }
  }
}

module.exports = new BookingService();