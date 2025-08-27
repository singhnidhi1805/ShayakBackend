const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');
const SocketService = require('./socket.service');

class BookingService {
  
  /**
   * Accept a booking and initialize tracking (UPDATED VERSION)
   */
  async acceptBooking(bookingId, professionalId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`👨‍🔧 Professional ${professionalId} accepting booking ${bookingId}`);
      
      // Find booking
      const booking = await Booking.findById(bookingId).session(session);
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
      
      // Check if professional is available
      if (!professional.isAvailable) {
        throw new Error('Professional is not available');
      }
      
      // Get service to verify specialization
      const service = await Service.findById(booking.service);
      if (!professional.specializations.includes(service.category)) {
        throw new Error('Service category does not match professional specialization');
      }
      
      // Update booking
      booking.professional = professionalId;
      booking.status = 'accepted';
      booking.acceptedAt = new Date();
      
      // Initialize tracking data
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      // Calculate initial ETA if professional has location
      let initialETA = null;
      if (professional.currentLocation && professional.currentLocation.coordinates) {
        initialETA = this.calculateETA(
          professional.currentLocation.coordinates,
          booking.location.coordinates
        );
        booking.tracking.initialETA = initialETA;
        booking.tracking.initialDistance = this.calculateDistance(
          professional.currentLocation.coordinates[1],
          professional.currentLocation.coordinates[0],
          booking.location.coordinates[1],
          booking.location.coordinates[0]
        );
      }
      
      booking.tracking.trackingInitialized = new Date();
      await booking.save({ session });
      
      // Update professional availability
      professional.isAvailable = false;
      professional.currentBooking = {
        bookingId: bookingId,
        acceptedAt: new Date()
      };
      await professional.save({ session });
      
      console.log(`✅ Booking ${bookingId} accepted successfully`);
      
      await session.commitTransaction();
      
      // Send real-time notifications after transaction commits
      setTimeout(() => {
        this.notifyBookingAccepted(booking, professional, initialETA);
      }, 100);
      
      return booking;
      
    } catch (error) {
      await session.abortTransaction();
      console.error(`❌ Error accepting booking ${bookingId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Start service and enable live tracking (ENHANCED VERSION)
   */
  async startService(bookingId, professionalId) {
    try {
      console.log(`🚀 Starting service for booking ${bookingId}`);
      
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone')
        .populate('professional', 'name phone currentLocation');
      
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'accepted') {
        throw new Error(`Booking is ${booking.status}, not accepted`);
      }
      
      // Verify professional authorization
      const bookingProfessionalId = booking.professional._id.toString();
      const requestProfessionalId = professionalId.toString();
      
      if (bookingProfessionalId !== requestProfessionalId) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Update booking status and tracking
      booking.status = 'in_progress';
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      booking.tracking.startedAt = new Date();
      booking.tracking.liveTrackingEnabled = true;
      
      // Get current professional location for tracking initialization
      if (booking.professional.currentLocation) {
        booking.tracking.lastLocation = {
          type: 'Point',
          coordinates: booking.professional.currentLocation.coordinates,
          timestamp: new Date()
        };
        
        // Calculate current ETA
        const currentETA = this.calculateETA(
          booking.professional.currentLocation.coordinates,
          booking.location.coordinates
        );
        booking.tracking.eta = currentETA;
      }
      
      await booking.save();
      
      console.log(`✅ Service started for booking ${bookingId} with live tracking enabled`);
      
      // Notify both user and professional about service start and tracking
      setTimeout(() => {
        this.notifyServiceStarted(booking);
      }, 100);
      
      return booking;
      
    } catch (error) {
      console.error(`❌ Error starting service for booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Complete service and stop tracking
   */
  async completeService(bookingId, professionalId, verificationCode) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      console.log(`✅ Completing booking ${bookingId} with code ${verificationCode}`);
      
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'in_progress') {
        throw new Error(`Booking is ${booking.status}, not in_progress`);
      }
      
      if (!booking.professional.equals(professionalId)) {
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
      }
      
      await booking.save({ session });
      
      // Update professional availability and clear current booking
      await Professional.findByIdAndUpdate(
        professionalId,
        { 
          isAvailable: true,
          $unset: { currentBooking: 1 }
        },
        { session }
      );
      
      console.log(`✅ Booking ${bookingId} completed successfully`);
      
      await session.commitTransaction();
      
      // Notify about completion and tracking end
      setTimeout(() => {
        this.notifyServiceCompleted(booking);
      }, 100);
      
      return booking;
      
    } catch (error) {
      await session.abortTransaction();
      console.error(`❌ Error completing booking ${bookingId}:`, error);
      throw error;
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Professional arrived at location
   */
  async professionalArrived(bookingId, professionalId) {
    try {
      console.log(`📍 Professional arrived at booking ${bookingId}`);
      
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name phone');
      
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'in_progress') {
        throw new Error(`Booking is ${booking.status}, not in_progress`);
      }
      
      if (!booking.professional.equals(professionalId)) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Update tracking info
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      booking.tracking.arrivedAt = new Date();
      booking.tracking.eta = 0; // Professional has arrived
      
      // Get current professional location for arrival confirmation
      const professional = await Professional.findById(professionalId);
      if (professional.currentLocation) {
        booking.tracking.arrivalLocation = {
          type: 'Point',
          coordinates: professional.currentLocation.coordinates,
          timestamp: new Date()
        };
      }
      
      await booking.save();
      
      console.log(`✅ Professional arrived for booking ${bookingId}`);
      
      // Notify about arrival
      setTimeout(() => {
        this.notifyProfessionalArrived(booking);
      }, 100);
      
      return booking;
      
    } catch (error) {
      console.error(`❌ Error marking professional arrived for booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Notify about booking acceptance and tracking initialization
   */
  notifyBookingAccepted(booking, professional, initialETA) {
    try {
      const acceptanceData = {
        bookingId: booking._id,
        status: 'accepted',
        professional: {
          _id: professional._id,
          name: professional.name,
          phone: professional.phone,
          currentLocation: professional.currentLocation
        },
        trackingInitialized: true,
        initialETA: initialETA,
        message: 'Your booking has been accepted! The professional is getting ready.'
      };
      
      // Send to user
      SocketService.sendTrackingUpdate(booking.user.toString(), acceptanceData);
      
      // Send to booking room
      SocketService.sendBookingUpdate(booking._id, {
        status: 'accepted',
        trackingAvailable: true,
        professional: {
          name: professional.name,
          currentLocation: professional.currentLocation
        }
      });
      
      // Trigger automatic booking acceptance event
      const io = SocketService.getIO();
      if (io) {
        io.emit('booking_accepted', { bookingId: booking._id });
      }
      
      console.log(`📤 Booking acceptance notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('Error sending booking acceptance notifications:', error);
    }
  }
  
  /**
   * Notify about service start and live tracking
   */
  notifyServiceStarted(booking) {
    try {
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
      SocketService.sendTrackingUpdate(booking.user.toString(), serviceStartData);
      
      // Send to professional
      SocketService.sendTrackingUpdate(booking.professional.toString(), {
        ...serviceStartData,
        message: 'Service started! Your location will be shared with the customer.'
      });
      
      // Send to tracking room
      const io = SocketService.getIO();
      if (io) {
        io.to(`tracking:${booking._id}`).emit('service_started', serviceStartData);
      }
      
      console.log(`📤 Service start notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('Error sending service start notifications:', error);
    }
  }
  
  /**
   * Notify about professional arrival
   */
  notifyProfessionalArrived(booking) {
    try {
      const arrivalData = {
        bookingId: booking._id,
        status: 'professional_arrived',
        arrivedAt: booking.tracking.arrivedAt,
        eta: 0,
        message: 'The professional has arrived at your location!'
      };
      
      // Send to user
      SocketService.sendTrackingUpdate(booking.user.toString(), arrivalData);
      
      // Send to tracking room
      const io = SocketService.getIO();
      if (io) {
        io.to(`tracking:${booking._id}`).emit('professional_arrived', arrivalData);
      }
      
      console.log(`📤 Professional arrival notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('Error sending arrival notifications:', error);
    }
  }
  
  /**
   * Notify about service completion and tracking end
   */
  notifyServiceCompleted(booking) {
    try {
      const completionData = {
        bookingId: booking._id,
        status: 'completed',
        completedAt: booking.completedAt,
        trackingEnded: true,
        message: 'Service completed successfully! Thank you for choosing our service.'
      };
      
      // Send to both user and professional
      SocketService.sendTrackingUpdate(booking.user.toString(), completionData);
      SocketService.sendTrackingUpdate(booking.professional.toString(), {
        ...completionData,
        message: 'Service completed successfully! You are now available for new bookings.'
      });
      
      // Send to tracking room and end tracking session
      const io = SocketService.getIO();
      if (io) {
        io.to(`tracking:${booking._id}`).emit('service_completed', completionData);
        io.to(`tracking:${booking._id}`).emit('tracking_session_ended', {
          bookingId: booking._id,
          reason: 'service_completed'
        });
      }
      
      console.log(`📤 Service completion notifications sent for ${booking._id}`);
      
    } catch (error) {
      console.error('Error sending completion notifications:', error);
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
}

module.exports = new BookingService();