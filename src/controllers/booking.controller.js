const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Professional = require('../models/professional.model');
const BookingService = require('../services/BookingService'); // Use exact filename
// const logger = require('../config/logger'); // Comment out if not available

class BookingController {
  /**
   * Create a new booking
   */
async createBooking(req, res) {
    console.log('🚀 [BOOKING-API] Creating booking request received');
    console.log('📊 [BOOKING-API] Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 [BOOKING-API] User ID:', req.user?._id);
    console.log('🌍 [BOOKING-API] User IP:', req.ip);
    
    try {
      const { serviceId, location, scheduledDate, isEmergency, notes } = req.body;

      // Enhanced validation
      if (!serviceId || !location?.coordinates || !scheduledDate) {
        console.log('❌ [BOOKING-API] Missing required fields');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: serviceId, location.coordinates, scheduledDate',
          received: {
            serviceId: !!serviceId,
            location: !!location,
            coordinates: !!location?.coordinates,
            scheduledDate: !!scheduledDate
          }
        });
      }

      // Validate coordinates format and range
      if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        console.log('❌ [BOOKING-API] Invalid coordinates format');
        return res.status(400).json({
          success: false,
          message: 'Invalid location coordinates format. Expected [longitude, latitude] array'
        });
      }

      const [longitude, latitude] = location.coordinates;
      
      // Validate coordinate ranges
      if (typeof longitude !== 'number' || typeof latitude !== 'number') {
        return res.status(400).json({
          success: false,
          message: 'Coordinates must be numbers'
        });
      }
      
      if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
        console.log('❌ [BOOKING-API] Coordinates out of valid range');
        return res.status(400).json({
          success: false,
          message: 'Coordinates out of valid range. Longitude: -180 to 180, Latitude: -90 to 90'
        });
      }

      console.log('✅ [BOOKING-API] Location validation passed:', { longitude, latitude });

      // Validate scheduledDate for non-emergency bookings
      if (!isEmergency) {
        const scheduledTime = new Date(scheduledDate);
        const now = new Date();
        
        if (scheduledTime <= now) {
          return res.status(400).json({
            success: false,
            message: 'Scheduled date must be in the future'
          });
        }
        
        // Check if scheduled time is within service hours (e.g., 6 AM to 10 PM)
        const hour = scheduledTime.getHours();
        if (hour < 6 || hour > 22) {
          return res.status(400).json({
            success: false,
            message: 'Service can only be scheduled between 6:00 AM and 10:00 PM'
          });
        }
      }

      // Check if service exists
      console.log('🔍 [BOOKING-API] Finding service:', serviceId);
      const service = await Service.findById(serviceId);
      if (!service) {
        console.log('❌ [BOOKING-API] Service not found');
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      console.log('✅ [BOOKING-API] Service found:', service.name, `(${service.category})`);

      // Create booking through enhanced service
      console.log('🔧 [BOOKING-API] Creating booking through service...');
      
      const bookingData = {
        serviceId,
        location: {
          coordinates: [longitude, latitude],
          address: location.address || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        },
        scheduledDate,
        isEmergency: isEmergency || false,
        notes: notes || ''
      };
      
      const booking = await EnhancedBookingService.createBooking(bookingData, req.user._id);
      
      console.log('✅ [BOOKING-API] Booking created successfully:', booking._id);

      // Prepare response with populated service data
      const response = {
        success: true,
        message: isEmergency ? 'Emergency booking created successfully' : 'Booking created successfully',
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            scheduledDate: booking.scheduledDate,
            totalAmount: booking.totalAmount,
            verificationCode: booking.verificationCode,
            isEmergency: booking.isEmergency,
            location: booking.location,
            service: {
              _id: service._id,
              name: service.name,
              category: service.category,
              pricing: service.pricing
            },
            tracking: {
              isActive: false,
              created: booking.tracking?.created || booking.createdAt
            }
          }
        }
      };

      res.status(201).json(response);
      console.log('📤 [BOOKING-API] Response sent successfully');
      
    } catch (error) {
      console.error('❌ [BOOKING-API] Booking creation failed:', error.message);
      console.error('📚 [BOOKING-API] Full error stack:', error.stack);
      
      // Determine error type and appropriate response
      let statusCode = 500;
      let message = 'Failed to create booking';
      
      if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('Invalid') || error.message.includes('required')) {
        statusCode = 400;
        message = error.message;
      } else if (error.message.includes('not available') || error.message.includes('conflict')) {
        statusCode = 409;
        message = error.message;
      }
      
      if (!res.headersSent) {
        res.status(statusCode).json({
          success: false,
          message: message,
          error: process.env.NODE_ENV === 'development' ? error.message : undefined,
          timestamp: new Date().toISOString()
        });
      }
    }
  }
  /**
   * Professional accepts booking
   */
  async acceptBooking(req, res) {
    console.log('👨‍🔧 [BOOKING-API] Professional accepting booking');
    console.log('📋 [BOOKING-API] Booking ID:', req.params.bookingId);
    console.log('👤 [BOOKING-API] Professional ID:', req.user._id);
    
    try {
      const { bookingId } = req.params;
      
      if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid booking ID is required'
        });
      }

      console.log('🔧 [BOOKING-API] Processing booking acceptance...');

      const booking = await EnhancedBookingService.acceptBooking(bookingId, req.user._id);

      console.log('✅ [BOOKING-API] Booking accepted successfully');

      // Get updated booking with populated data for response
      const populatedBooking = await Booking.findById(bookingId)
        .populate('service', 'name category estimatedDuration')
        .populate('user', 'name phone')
        .populate('professional', 'name phone rating');

      const response = {
        success: true,
        message: 'Booking accepted successfully',
        data: {
          booking: {
            _id: populatedBooking._id,
            status: populatedBooking.status,
            scheduledDate: populatedBooking.scheduledDate,
            acceptedAt: populatedBooking.acceptedAt,
            service: populatedBooking.service,
            customer: {
              name: populatedBooking.user.name,
              phone: populatedBooking.user.phone
            },
            location: populatedBooking.location,
            totalAmount: populatedBooking.totalAmount,
            tracking: {
              initialized: true,
              eta: populatedBooking.tracking?.initialETA || null,
              distance: populatedBooking.tracking?.initialDistance || null
            }
          }
        }
      };

      res.json(response);
      
    } catch (error) {
      console.error('❌ [BOOKING-API] Accept booking error:', error);
      
      let statusCode = 500;
      let message = 'Failed to accept booking';
      
      if (error.message.includes('not found')) {
        statusCode = 404;
        message = 'Booking not found';
      } else if (error.message.includes('already') || error.message.includes('not available')) {
        statusCode = 409;
        message = error.message;
      } else if (error.message.includes('not authorized') || error.message.includes('specialization')) {
        statusCode = 403;
        message = error.message;
      }
      
      res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get active booking
   */
  /**
 * Get active booking - OPTIMIZED VERSION with timeout handling
 */
async getActiveBooking(req, res) {
    console.log('🔍 [BOOKING-API] Getting active booking for user:', req.user._id);
    console.log('👤 [BOOKING-API] User role:', req.userRole);
    
    try {
      // Build query based on user role
      let query = {};
      
      if (req.userRole === 'user') {
        query = {
          user: req.user._id,
          status: { $in: ['pending', 'accepted', 'in_progress'] }
        };
      } else if (req.userRole === 'professional') {
        query = {
          professional: req.user._id,
          status: { $in: ['accepted', 'in_progress'] }
        };
      }

      console.log('🔍 [BOOKING-API] Query:', JSON.stringify(query));

      // Find booking with timeout protection
      const findBookingPromise = Booking.findOne(query)
        .populate('service', 'name category pricing estimatedDuration')
        .populate('professional', 'name phone rating currentLocation')
        .populate('user', 'name phone')
        .lean();
      
      const findTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 5000);
      });
      
      const booking = await Promise.race([findBookingPromise, findTimeout]);

      if (!booking) {
        console.log('❌ [BOOKING-API] No active booking found');
        return res.status(404).json({
          success: false,
          message: 'No active booking found'
        });
      }

      console.log('✅ [BOOKING-API] Active booking found:', booking._id);

      // Format response based on user role
      let response = {
        _id: booking._id,
        service: booking.service,
        scheduledDate: booking.scheduledDate,
        status: booking.status,
        totalAmount: booking.totalAmount,
        location: booking.location,
        tracking: booking.tracking || {},
        isEmergency: booking.isEmergency || false,
        createdAt: booking.createdAt
      };

      // Add role-specific data
      if (req.userRole === 'user' && booking.professional) {
        response.professional = {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone,
          rating: booking.professional.rating || 0,
          currentLocation: booking.professional.currentLocation
        };
        
        // Calculate real-time ETA if professional has location
        if (booking.professional.currentLocation?.coordinates && booking.location?.coordinates) {
          const distance = this.calculateDistance(
            booking.professional.currentLocation.coordinates[1],
            booking.professional.currentLocation.coordinates[0],
            booking.location.coordinates[1],
            booking.location.coordinates[0]
          );
          
          response.realTimeTracking = {
            distance: distance,
            eta: this.calculateETA(distance),
            lastUpdate: booking.professional.currentLocation.timestamp || booking.tracking?.lastUpdate
          };
        }
      } else if (req.userRole === 'professional' && booking.user) {
        response.customer = {
          _id: booking.user._id,
          name: booking.user.name,
          phone: booking.user.phone
        };
        
        // Share verification code with professional during service
        if (booking.status === 'in_progress') {
          response.verificationCode = booking.verificationCode;
        }
      }

      res.json({
        success: true,
        data: { booking: response }
      });
      
    } catch (error) {
      console.error('[BOOKING-API] Get active booking error:', error);
      
      let errorMessage = 'Failed to get active booking';
      let statusCode = 500;
      
      if (error.message.includes('timeout')) {
        errorMessage = 'Database query timeout - please try again';
        statusCode = 504;
      } else if (error.message.includes('connection')) {
        errorMessage = 'Database connection issue - please try again';
        statusCode = 503;
      }
      
      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  }

/**
 * Get available bookings for professionals to accept
 */
 async getAvailableBookings(req, res) {
    console.log('[BOOKING-API] Getting available bookings for professional:', req.user._id);
    
    try {
      const { specialization, radius = 50 } = req.query;
      
      // Get professional details
      const professional = await Professional.findById(req.user._id).lean();
      if (!professional) {
        return res.status(404).json({
          success: false,
          message: 'Professional not found'
        });
      }

      console.log('[BOOKING-API] Professional specializations:', professional.specializations);

      // Build query for available bookings
      let query = {
        status: 'pending',
        professional: { $exists: false }
      };

      // Filter by specializations
      const specializationsToMatch = specialization 
        ? [specialization] 
        : professional.specializations || [];

      if (specializationsToMatch.length > 0) {
        const matchingServices = await Service.find({
          category: { $in: specializationsToMatch }
        }).select('_id').lean();
        
        if (matchingServices.length > 0) {
          query.service = { $in: matchingServices.map(s => s._id) };
        } else {
          return res.json({
            success: true,
            bookings: [],
            message: 'No services match your specializations'
          });
        }
      }

      console.log('[BOOKING-API] Query:', JSON.stringify(query));

      // Find available bookings
      let availableBookings = await Booking.find(query)
        .populate('service', 'name category pricing estimatedDuration')
        .populate('user', 'name phone')
        .sort({ isEmergency: -1, createdAt: 1 })
        .lean();

      console.log(`[BOOKING-API] Found ${availableBookings.length} potential bookings`);

      // Filter by location if professional has location
      if (professional.currentLocation?.coordinates && radius) {
        const [profLng, profLat] = professional.currentLocation.coordinates;
        
        availableBookings = availableBookings.filter(booking => {
          if (!booking.location?.coordinates) return true;
          
          const [bookingLng, bookingLat] = booking.location.coordinates;
          const distance = this.calculateDistance(profLat, profLng, bookingLat, bookingLng);
          
          // Add distance to booking for client
          booking.distanceFromYou = distance;
          booking.estimatedETA = this.calculateETA(distance);
          
          return distance <= radius;
        });
        
        // Sort by distance for better UX
        availableBookings.sort((a, b) => (a.distanceFromYou || 0) - (b.distanceFromYou || 0));
      }

      console.log(`[BOOKING-API] Final count after location filter: ${availableBookings.length}`);

      // Format bookings for response
      const formattedBookings = availableBookings.map(booking => ({
        _id: booking._id,
        service: booking.service,
        customer: {
          name: booking.user.name,
          phone: booking.user.phone
        },
        scheduledDate: booking.scheduledDate,
        location: booking.location,
        status: booking.status,
        totalAmount: booking.totalAmount,
        isEmergency: booking.isEmergency,
        distanceFromYou: booking.distanceFromYou,
        estimatedETA: booking.estimatedETA,
        createdAt: booking.createdAt
      }));

      res.json({
        success: true,
        bookings: formattedBookings,
        totalCount: formattedBookings.length,
        professionalLocation: professional.currentLocation
      });

    } catch (error) {
      console.error('[BOOKING-API] Get available bookings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available bookings'
      });
    }
  }


/**
 * Calculate distance between two points using Haversine formula
 */
 calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 100) / 100;
  }


  /**
   * Utility method to calculate ETA
   */
  calculateETA(distance, averageSpeed = 30) {
    if (!distance || distance <= 0) return 0;
    const timeInMinutes = Math.round((distance / averageSpeed) * 60);
    return Math.max(1, timeInMinutes);
  }


/**
 * Get booking details by ID
 */
async getBookingById(req, res) {
    console.log('[BOOKING-API] Getting booking details for ID:', req.params.bookingId);
    
    try {
      const { bookingId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      const booking = await Booking.findById(bookingId)
        .populate('service', 'name category pricing estimatedDuration description')
        .populate('professional', 'name phone rating currentLocation')
        .populate('user', 'name phone')
        .lean();
      
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
          message: 'Not authorized to view this booking'
        });
      }

      // Format response
      let response = {
        _id: booking._id,
        service: booking.service,
        scheduledDate: booking.scheduledDate,
        status: booking.status,
        totalAmount: booking.totalAmount,
        location: booking.location,
        tracking: booking.tracking || {},
        isEmergency: booking.isEmergency || false,
        createdAt: booking.createdAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
        rating: booking.rating
      };

      // Add role-specific data
      if ((req.userRole === 'user' || req.userRole === 'admin') && booking.professional) {
        response.professional = {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone,
          rating: booking.professional.rating || 0,
          currentLocation: booking.professional.currentLocation
        };
      }
      
      if (req.userRole === 'professional' && booking.user) {
        response.customer = {
          _id: booking.user._id,
          name: booking.user.name,
          phone: booking.user.phone
        };
        
        if (booking.status === 'in_progress') {
          response.verificationCode = booking.verificationCode;
        }
      }

      res.json({
        success: true,
        data: { booking: response }
      });
      
    } catch (error) {
      console.error('[BOOKING-API] Get booking by ID error:', error);
      
      let statusCode = 500;
      let message = 'Failed to get booking details';
      
      if (error.message.includes('timeout')) {
        statusCode = 504;
        message = 'Database query timeout - please try again';
      }
      
      res.status(statusCode).json({
        success: false,
        message: message,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get booking history
   */
  async getBookingHistory(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      
      // Build query based on user role
      let query = {};
      
      if (req.userRole === 'user') {
        query.user = req.user._id;
      } else if (req.userRole === 'professional') {
        query.professional = req.user._id;
      }

      // Add status filter if provided
      if (status && ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        query.status = status;
      }

      // Count total documents for pagination
      const total = await Booking.countDocuments(query);

      // Get bookings with pagination
      const bookings = await Booking.find(query)
        .populate('service', 'name category pricing')
        .populate('professional', 'name phone')
        .populate('user', 'name phone')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));

      // Format bookings data
      const formattedBookings = bookings.map(booking => {
        const formattedBooking = {
          _id: booking._id,
          service: booking.service,
          scheduledDate: booking.scheduledDate,
          status: booking.status,
          totalAmount: booking.totalAmount,
          createdAt: booking.createdAt,
          completedAt: booking.completedAt,
          cancelledAt: booking.cancelledAt,
          rating: booking.rating,
          isEmergency: booking.isEmergency
        };

        if (req.userRole === 'user') {
          formattedBooking.professional = booking.professional ? {
            _id: booking.professional._id,
            name: booking.professional.name,
            phone: booking.professional.phone
          } : null;
        } else if (req.userRole === 'professional') {
          formattedBooking.user = {
            _id: booking.user._id,
            name: booking.user.name,
            phone: booking.user.phone
          };
        }

        return formattedBooking;
      });

      return res.json({
        success: true,
        bookings: formattedBookings,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('❌ Get booking history failed:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get booking history' 
      });
    }
  }

  /**
   * Complete a booking with verification code
   */
   async completeBooking(req, res) {
    console.log('✅ [BOOKING-API] Completing booking:', req.params.bookingId);
    
    try {
      const { bookingId } = req.params;
      const { verificationCode } = req.body;

      if (!verificationCode) {
        return res.status(400).json({ 
          success: false, 
          message: 'Verification code is required' 
        });
      }

      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      const booking = await EnhancedBookingService.completeService(bookingId, req.user._id, verificationCode);

      console.log('✅ [BOOKING-API] Booking completed successfully');

      res.json({
        success: true,
        message: 'Booking completed successfully',
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            completedAt: booking.completedAt,
            paymentStatus: booking.paymentStatus
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [BOOKING-API] Complete booking error:', error);
      
      let statusCode = 500;
      if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('Invalid verification code')) {
        statusCode = 400;
      } else if (error.message.includes('not assigned')) {
        statusCode = 403;
      }
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to complete booking'
      });
    }
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;

      const booking = await BookingService.cancelBooking(bookingId, req.user._id, req.userRole, reason);

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          cancelledAt: booking.cancelledAt
        }
      });
    } catch (error) {
      console.error('❌ Cancel booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        message: error.message || 'Failed to cancel booking' 
      });
    }
  }

  /**
   * Reschedule a booking
   */
  async rescheduleBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { scheduledDate, reason } = req.body;

      if (!scheduledDate) {
        return res.status(400).json({ 
          success: false, 
          message: 'New scheduled date is required' 
        });
      }

      const booking = await BookingService.rescheduleBooking(bookingId, req.user._id, scheduledDate, reason);

      res.json({
        success: true,
        message: 'Booking rescheduled successfully',
        booking: {
          _id: booking._id,
          scheduledDate: booking.scheduledDate,
          reschedulingHistory: booking.reschedulingHistory
        }
      });
    } catch (error) {
      console.error('❌ Reschedule booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        message: error.message || 'Failed to reschedule booking' 
      });
    }
  }

  /**
   * Update ETA for a booking
   */
  async updateETA(req, res) {
    try {
      const { bookingId } = req.params;
      const { etaMinutes, coordinates } = req.body;

      if (!etaMinutes) {
        return res.status(400).json({ 
          success: false, 
          message: 'ETA in minutes is required' 
        });
      }

      const booking = await BookingService.updateETA(bookingId, req.user._id, etaMinutes, coordinates);

      res.json({
        success: true,
        message: 'ETA updated successfully',
        booking: {
          _id: booking._id,
          tracking: booking.tracking
        }
      });
    } catch (error) {
      console.error('❌ Update ETA failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        message: error.message || 'Failed to update ETA' 
      });
    }
  }

  /**
   * Rate a booking
   */
  async rateBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { rating, review } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ 
          success: false, 
          message: 'Rating must be between 1 and 5' 
        });
      }

      const booking = await BookingService.rateBooking(bookingId, req.user._id, rating, review);

      res.json({
        success: true,
        message: 'Booking rated successfully',
        rating: booking.rating
      });
    } catch (error) {
      console.error('❌ Rate booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        message: error.message || 'Failed to rate booking' 
      });
    }
  }

  /**
   * Start a service
   */
  async startService(req, res) {
    console.log('🚀 [BOOKING-API] Starting service for booking:', req.params.bookingId);
    
    try {
      const { bookingId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      const booking = await EnhancedBookingService.startService(bookingId, req.user._id);

      console.log('✅ [BOOKING-API] Service started successfully');

      res.json({
        success: true,
        message: 'Service started successfully',
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            tracking: {
              startedAt: booking.tracking.startedAt,
              liveTrackingEnabled: booking.tracking.liveTrackingEnabled,
              eta: booking.tracking.eta,
              distance: booking.tracking.distance
            }
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [BOOKING-API] Start service error:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 
                        error.message.includes('not assigned') ? 403 : 400;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to start service'
      });
    }
  }

  /**
   * Mark professional as arrived
   */
 async professionalArrived(req, res) {
    console.log('📍 [BOOKING-API] Professional arrived for booking:', req.params.bookingId);
    
    try {
      const { bookingId } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      const booking = await EnhancedBookingService.professionalArrived(bookingId, req.user._id);

      console.log('✅ [BOOKING-API] Arrival marked successfully');

      res.json({
        success: true,
        message: 'Arrival marked successfully',
        data: {
          booking: {
            _id: booking._id,
            tracking: {
              arrivedAt: booking.tracking.arrivedAt,
              eta: booking.tracking.eta
            }
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [BOOKING-API] Professional arrived error:', error);
      
      const statusCode = error.message.includes('not found') ? 404 : 
                        error.message.includes('not assigned') ? 403 : 400;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to mark arrival'
      });
    }
  }

  /**
   * Create emergency booking
   */
  async createEmergencyBooking(req, res) {
    try {
      const { serviceId, location } = req.body;

      if (!serviceId || !location?.coordinates) {
        return res.status(400).json({ 
          success: false, 
          message: 'Service ID and location are required' 
        });
      }

      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ 
          success: false, 
          message: 'Service not found' 
        });
      }

      // Create emergency booking
      const booking = await BookingService.createEmergencyBooking(req.body, req.user._id);

      res.status(201).json({
        success: true,
        message: 'Emergency booking created successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          isEmergency: booking.isEmergency,
          service: {
            _id: service._id,
            name: service.name,
            category: service.category
          }
        }
      });
    } catch (error) {
      console.error('❌ Emergency booking creation failed:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create emergency booking' 
      });
    }
  }
}

module.exports = new BookingController();