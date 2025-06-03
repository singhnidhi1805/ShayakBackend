const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');
// const NotificationService = require('./notification.service'); // Comment out if causing issues
// const logger = require('../config/logger'); // Comment out if causing issues

class BookingService {
  
  /**
   * Create a new booking
   * @param {Object} bookingData - Booking data
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Created booking
   */
  async createBooking(bookingData, userId) {
    console.log('📝 [SERVICE-1] BookingService.createBooking called');
    console.log('📊 [SERVICE-1] Data:', JSON.stringify(bookingData, null, 2));
    console.log('👤 [SERVICE-1] User ID:', userId);
    
    try {
      const { serviceId, location, scheduledDate, isEmergency = false } = bookingData;
      
      console.log('🔍 [SERVICE-2] Extracting data...');
      console.log('   - Service ID:', serviceId);
      console.log('   - Location:', location);
      console.log('   - Scheduled Date:', scheduledDate);
      console.log('   - Emergency:', isEmergency);
      
      // Basic validation
      console.log('🔍 [SERVICE-3] Service validation...');
      if (!serviceId || !location?.coordinates || !scheduledDate) {
        throw new Error('Missing required fields in service');
      }
      
      // Get service
      console.log('🔍 [SERVICE-4] Finding service in database...');
      const service = await Service.findById(serviceId);
      if (!service) {
        console.log('❌ [SERVICE-4] Service not found');
        throw new Error('Service not found');
      }
      console.log('✅ [SERVICE-4] Service found:', service.name, '(', service.category, ')');
      
      // Generate verification code
      console.log('🔍 [SERVICE-5] Generating verification code...');
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('✅ [SERVICE-5] Verification code generated:', verificationCode);
      
      // Calculate total amount
      console.log('🔍 [SERVICE-6] Calculating amount...');
      let totalAmount = 0;
      if (service.pricing.type === 'fixed') {
        totalAmount = service.pricing.amount;
      } else if (service.pricing.type === 'range') {
        totalAmount = service.pricing.minAmount;
      } else if (service.pricing.type === 'hourly') {
        totalAmount = service.pricing.amount;
      } else {
        totalAmount = 500; // Default fallback
      }
      console.log('💰 [SERVICE-6] Total amount calculated:', totalAmount);
      
      // Create booking
      console.log('🔍 [SERVICE-7] Creating booking document...');
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
        verificationCode,
        isEmergency
      });
      console.log('✅ [SERVICE-7] Booking document created');
      
      // Save booking
      console.log('🔍 [SERVICE-8] Saving booking to database...');
      const savedBooking = await booking.save();
      console.log('✅ [SERVICE-8] Booking saved with ID:', savedBooking._id);
      
      // Find professionals (NON-BLOCKING)
      console.log('🔍 [SERVICE-9] Starting professional search (async)...');
      
      // Use setTimeout instead of setImmediate for better debugging
      setTimeout(() => {
        console.log('🔍 [ASYNC] Starting professional search...');
        this.findMatchingProfessionals(savedBooking, service.category)
          .then(professionals => {
            console.log('✅ [ASYNC] Professional search completed:', professionals.length, 'found');
          })
          .catch(err => {
            console.error('❌ [ASYNC] Professional search failed:', err.message);
          });
      }, 100);
      
      console.log('✅ [SERVICE-9] Returning booking (before async professional search)');
      return savedBooking;
      
    } catch (error) {
      console.error('❌ [SERVICE-ERROR] Error in createBooking:', error.message);
      console.error('📚 [SERVICE-ERROR] Stack:', error.stack);
      throw error;
    }
  }
  
  /**
   * Find matching professionals for a booking (async, non-blocking)
   * @param {Object} booking - Booking object
   * @param {string} serviceCategory - Service category
   * @returns {Promise<Array>} Matching professionals
   */
  async findMatchingProfessionals(booking, serviceCategory) {
    console.log('🔍 [PROF-1] findMatchingProfessionals called');
    console.log('📊 [PROF-1] Booking ID:', booking._id);
    console.log('📊 [PROF-1] Service category:', serviceCategory);
    
    try {
      // Add timeout to this function too
      const searchTimeout = setTimeout(() => {
        console.log('⚠️ [PROF-TIMEOUT] Professional search taking too long...');
      }, 5000);
      
      console.log('🔍 [PROF-2] Searching for professionals...');
      
      // Simplified query first
      const allProfessionals = await Professional.find({
        specializations: { $in: [serviceCategory] }
      }).limit(10);
      
      console.log('📊 [PROF-2] Found', allProfessionals.length, 'professionals with', serviceCategory, 'specialization');
      
      allProfessionals.forEach((prof, index) => {
        console.log(`   [${index + 1}] ${prof.name}:`);
        console.log(`       - Status: ${prof.status}`);
        console.log(`       - Available: ${prof.isAvailable}`);
        console.log(`       - Location: [${prof.currentLocation.coordinates.join(', ')}]`);
      });
      
      // Now apply filters
      console.log('🔍 [PROF-3] Applying filters...');
      const filteredProfessionals = allProfessionals.filter(prof => {
        const isVerified = prof.status === 'verified';
        const isAvailable = prof.isAvailable === true;
        const hasValidLocation = prof.currentLocation.coordinates && 
                                prof.currentLocation.coordinates[0] !== 0 && 
                                prof.currentLocation.coordinates[1] !== 0;
        
        console.log(`   - ${prof.name}: verified=${isVerified}, available=${isAvailable}, validLocation=${hasValidLocation}`);
        
        return isVerified && isAvailable && hasValidLocation;
      });
      
      console.log('✅ [PROF-3] Filtered professionals:', filteredProfessionals.length);
      
      clearTimeout(searchTimeout);
      
      // Simple notification log
      if (filteredProfessionals.length > 0) {
        console.log('📱 [PROF-4] Would notify professionals:', filteredProfessionals.map(p => p.name).join(', '));
      } else {
        console.log('❌ [PROF-4] No professionals to notify');
      }
      
      console.log('✅ [PROF-5] Professional search completed');
      return filteredProfessionals;
      
    } catch (error) {
      console.error('❌ [PROF-ERROR] Error in findMatchingProfessionals:', error.message);
      console.error('📚 [PROF-ERROR] Stack:', error.stack);
      return [];
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
      await booking.save({ session });
      
      // Update professional availability
      professional.isAvailable = false;
      await professional.save({ session });
      
      console.log(`✅ Booking ${bookingId} accepted successfully`);
      
      // TODO: Send notifications here
      // await NotificationService.createNotification({...});
      
      await session.commitTransaction();
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
 * Start a service (FIXED VERSION)
 * @param {string} bookingId - Booking ID
 * @param {string} professionalId - Professional ID
 * @returns {Promise<Object>} Updated booking
 */
async startService(bookingId, professionalId) {
  try {
    console.log(`🚀 Starting service for booking ${bookingId}`);
    console.log(`👨‍🔧 Professional ID from request: ${professionalId}`);
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    console.log(`📊 Booking status: ${booking.status}`);
    console.log(`👨‍🔧 Booking professional: ${booking.professional}`);
    console.log(`👨‍🔧 Professional type: ${typeof booking.professional}`);
    console.log(`👨‍🔧 Request professional: ${professionalId}`);
    console.log(`👨‍🔧 Request professional type: ${typeof professionalId}`);
    
    if (booking.status !== 'accepted') {
      throw new Error(`Booking is ${booking.status}, not accepted`);
    }
    
    // Check if professional is assigned
    if (!booking.professional) {
      throw new Error('No professional assigned to this booking');
    }
    
    // FIXED: More robust professional ID comparison
    const bookingProfessionalId = booking.professional.toString();
    const requestProfessionalId = professionalId.toString();
    
    console.log(`🔍 Comparing IDs:`);
    console.log(`   - Booking professional (string): "${bookingProfessionalId}"`);
    console.log(`   - Request professional (string): "${requestProfessionalId}"`);
    console.log(`   - Are they equal? ${bookingProfessionalId === requestProfessionalId}`);
    
    if (bookingProfessionalId !== requestProfessionalId) {
      console.log(`❌ Professional mismatch:`);
      console.log(`   - Expected: ${bookingProfessionalId}`);
      console.log(`   - Got: ${requestProfessionalId}`);
      throw new Error('Professional is not assigned to this booking');
    }
    
    console.log(`✅ Professional verification passed`);
    
    // Update booking status and tracking
    booking.status = 'in_progress';
    if (!booking.tracking) {
      booking.tracking = {};
    }
    booking.tracking.startedAt = new Date();
    
    console.log(`💾 Saving booking with new status: ${booking.status}`);
    await booking.save();
    
    console.log(`✅ Service started for booking ${bookingId}`);
    return booking;
  } catch (error) {
    console.error(`❌ Error starting service for booking ${bookingId}:`, error);
    throw error;
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
      await booking.save({ session });
      
      // Update professional availability
      await Professional.findByIdAndUpdate(
        professionalId,
        { isAvailable: true },
        { session }
      );
      
      console.log(`✅ Booking ${bookingId} completed successfully`);
      
      await session.commitTransaction();
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
      console.log(`❌ Cancelling booking ${bookingId} by ${userRole}`);
      
      const booking = await Booking.findById(bookingId).session(session);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (!['pending', 'accepted'].includes(booking.status)) {
        throw new Error(`Cannot cancel booking with status ${booking.status}`);
      }
      
      // Check permissions
      if (userRole === 'user' && booking.user.toString() !== userId) {
        throw new Error('Not authorized to cancel this booking');
      }
      if (userRole === 'professional' && (!booking.professional || !booking.professional.equals(userId))) {
        throw new Error('Not authorized to cancel this booking');
      }
      
      // Update booking
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancelledBy = userId;
      booking.cancellationReason = reason;
      await booking.save({ session });
      
      // If professional was assigned, make them available again
      if (booking.professional) {
        await Professional.findByIdAndUpdate(
          booking.professional,
          { isAvailable: true },
          { session }
        );
      }
      
      console.log(`✅ Booking ${bookingId} cancelled successfully`);
      
      await session.commitTransaction();
      return booking;
    } catch (error) {
      await session.abortTransaction();
      console.error(`❌ Error cancelling booking ${bookingId}:`, error);
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
    try {
      console.log(`📅 Rescheduling booking ${bookingId} to ${newDate}`);
      
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (!['pending', 'accepted'].includes(booking.status)) {
        throw new Error(`Cannot reschedule booking with status ${booking.status}`);
      }
      
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
        rescheduledAt: new Date()
      });
      
      await booking.save();
      
      console.log(`✅ Booking ${bookingId} rescheduled successfully`);
      return booking;
    } catch (error) {
      console.error(`❌ Error rescheduling booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update ETA for a booking
   * @param {string} bookingId - Booking ID
   * @param {string} professionalId - Professional ID
   * @param {number} etaMinutes - ETA in minutes
   * @param {Array} coordinates - Current coordinates
   * @returns {Promise<Object>} Updated booking
   */
  async updateETA(bookingId, professionalId, etaMinutes, coordinates = null) {
    try {
      console.log(`⏰ Updating ETA for booking ${bookingId}: ${etaMinutes} minutes`);
      
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (!['in_progress', 'accepted'].includes(booking.status)) {
        throw new Error(`Cannot update ETA for booking with status ${booking.status}`);
      }
      
      if (!booking.professional.equals(professionalId)) {
        throw new Error('Professional is not assigned to this booking');
      }
      
      // Update tracking info
      if (!booking.tracking) {
        booking.tracking = {};
      }
      
      booking.tracking.eta = etaMinutes;
      
      if (coordinates) {
        booking.tracking.lastLocation = {
          type: 'Point',
          coordinates,
          timestamp: new Date()
        };
      }
      
      await booking.save();
      
      console.log(`✅ ETA updated for booking ${bookingId}`);
      return booking;
    } catch (error) {
      console.error(`❌ Error updating ETA for booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
 * Professional arrived at location (FIXED VERSION)
 * @param {string} bookingId - Booking ID
 * @param {string} professionalId - Professional ID
 * @returns {Promise<Object>} Updated booking
 */
async professionalArrived(bookingId, professionalId) {
  try {
    console.log(`📍 Professional arrived at booking ${bookingId}`);
    console.log(`👨‍🔧 Professional ID: ${professionalId}`);
    
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    console.log(`📊 Booking status: ${booking.status}`);
    console.log(`👨‍🔧 Booking professional: ${booking.professional}`);
    
    if (booking.status !== 'in_progress') {
      throw new Error(`Booking is ${booking.status}, not in_progress`);
    }
    
    // Check if professional is assigned
    if (!booking.professional) {
      throw new Error('No professional assigned to this booking');
    }
    
    // FIXED: Use mongoose equals method instead of string comparison
    if (!booking.professional.equals(professionalId)) {
      console.log(`❌ Professional mismatch:`);
      console.log(`   - Expected: ${booking.professional}`);
      console.log(`   - Got: ${professionalId}`);
      throw new Error('Professional is not assigned to this booking');
    }
    
    console.log(`✅ Professional verification passed`);
    
    // Update tracking info
    if (!booking.tracking) {
      booking.tracking = {};
    }
    
    booking.tracking.arrivedAt = new Date();
    booking.tracking.eta = 0;
    await booking.save();
    
    console.log(`✅ Professional arrived for booking ${bookingId}`);
    return booking;
  } catch (error) {
    console.error(`❌ Error marking professional arrived for booking ${bookingId}:`, error);
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
      console.log(`⭐ Rating booking ${bookingId}: ${rating} stars`);
      
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'completed') {
        throw new Error('Only completed bookings can be rated');
      }
      
      if (booking.user.toString() !== userId) {
        throw new Error('Not authorized to rate this booking');
      }
      
      if (booking.rating && booking.rating.score) {
        throw new Error('Booking already rated');
      }
      
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
        await this.updateProfessionalRating(booking.professional);
      }
      
      console.log(`✅ Booking ${bookingId} rated successfully`);
      return booking;
    } catch (error) {
      console.error(`❌ Error rating booking ${bookingId}:`, error);
      throw error;
    }
  }
  
  /**
   * Update professional's average rating
   * @param {string} professionalId - Professional ID
   */
  async updateProfessionalRating(professionalId) {
    try {
      const professional = await Professional.findById(professionalId);
      if (!professional) return;
      
      // Get all rated bookings for this professional
      const ratedBookings = await Booking.find({
        professional: professionalId,
        'rating.score': { $exists: true, $ne: null }
      });
      
      if (ratedBookings.length === 0) return;
      
      // Calculate average rating
      const totalRatings = ratedBookings.length;
      const sumRatings = ratedBookings.reduce((sum, b) => sum + b.rating.score, 0);
      const averageRating = sumRatings / totalRatings;
      
      // Update professional
      if (!professional.rating) {
        professional.rating = {};
      }
      professional.rating.average = parseFloat(averageRating.toFixed(1));
      professional.rating.count = totalRatings;
      
      await professional.save();
      
      console.log(`📊 Updated professional ${professionalId} rating: ${averageRating.toFixed(1)} (${totalRatings} reviews)`);
    } catch (error) {
      console.error(`❌ Error updating professional rating:`, error);
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
      console.log(`🚨 Creating emergency booking for user ${userId}`);
      
      // Create a normal booking first
      const booking = await this.createBooking({
        ...bookingData,
        isEmergency: true
      }, userId);
      
      console.log(`✅ Emergency booking created: ${booking._id}`);
      return booking;
    } catch (error) {
      console.error('❌ Emergency booking creation error:', error);
      throw error;
    }
  }
}

module.exports = new BookingService();