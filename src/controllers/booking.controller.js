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
    console.log('🚀 [STEP 1] Booking API called');
    console.log('📊 Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 User ID:', req.user?._id);
    
    try {
      console.log('🚀 [STEP 2] Starting booking creation...');
      
      const { serviceId, location, scheduledDate } = req.body;

      // Basic validation
      console.log('🔍 [STEP 3] Validating input...');
      if (!serviceId || !location?.coordinates || !scheduledDate) {
        console.log('❌ [STEP 3] Validation failed - missing fields');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: serviceId, location.coordinates, scheduledDate'
        });
      }
      console.log('✅ [STEP 3] Validation passed');

      // Validate coordinates
      console.log('🔍 [STEP 4] Validating coordinates...');
      if (!Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        console.log('❌ [STEP 4] Invalid coordinates format');
        return res.status(400).json({
          success: false,
          message: 'Invalid location coordinates format. Expected [longitude, latitude]'
        });
      }
      console.log('✅ [STEP 4] Coordinates valid:', location.coordinates);

      // Check if service exists
      console.log('🔍 [STEP 5] Finding service...');
      const service = await Service.findById(serviceId);
      if (!service) {
        console.log('❌ [STEP 5] Service not found:', serviceId);
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      console.log('✅ [STEP 5] Service found:', service.name, '(', service.category, ')');

      // Create booking through service
      console.log('🔍 [STEP 6] Calling BookingService.createBooking...');
      
      // Add timeout to detect hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Booking creation timeout after 10 seconds')), 10000);
      });
      
      const bookingPromise = BookingService.createBooking(req.body, req.user._id);
      
      const booking = await Promise.race([bookingPromise, timeoutPromise]);
      
      console.log('✅ [STEP 6] BookingService completed, booking ID:', booking._id);

      // Send response
      console.log('🔍 [STEP 7] Sending response...');
      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            scheduledDate: booking.scheduledDate,
            totalAmount: booking.totalAmount,
            verificationCode: booking.verificationCode,
            isEmergency: booking.isEmergency,
            service: {
              _id: service._id,
              name: service.name,
              category: service.category
            }
          }
        }
      });
      console.log('✅ [STEP 7] Response sent successfully');
      
    } catch (error) {
      console.error('❌ [ERROR] Booking creation failed at step:', error.message);
      console.error('📚 Full error stack:', error.stack);
      
      // Make sure we always send a response
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to create booking',
          debug: {
            step: 'unknown',
            timestamp: new Date().toISOString()
          }
        });
      }}}
  /**
   * Professional accepts booking
   */
  async acceptBooking(req, res) {
    try {
      const { bookingId } = req.params;
      
      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required'
        });
      }

      console.log(`👨‍🔧 Professional ${req.user._id} accepting booking ${bookingId}`);

      const booking = await BookingService.acceptBooking(bookingId, req.user._id);

      res.json({
        success: true,
        message: 'Booking accepted successfully',
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            scheduledDate: booking.scheduledDate
          }
        }
      });
    } catch (error) {
      console.error('❌ Accept booking error:', error);
      const statusCode = error.message.includes('not found') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to accept booking'
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
  console.log('🔍 [ACTIVE-BOOKING] Getting active booking for user:', req.user._id);
  console.log('👤 [ACTIVE-BOOKING] User role:', req.userRole);
  
  try {
    // Determine query based on user role
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

    console.log('🔍 [ACTIVE-BOOKING] Query:', JSON.stringify(query));

    // Step 1: Find booking without populate first (faster)
    console.log('📋 [ACTIVE-BOOKING] Step 1: Finding booking...');
    
    const findBookingPromise = Booking.findOne(query).lean();
    const findTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Find booking timeout')), 3000);
    });
    
    const booking = await Promise.race([findBookingPromise, findTimeout]);

    if (!booking) {
      console.log('❌ [ACTIVE-BOOKING] No active booking found');
      return res.status(404).json({
        success: false,
        message: 'No active booking found'
      });
    }

    console.log('✅ [ACTIVE-BOOKING] Found booking:', booking._id);

    // Step 2: Get related data separately with timeout protection
    console.log('🔍 [ACTIVE-BOOKING] Step 2: Getting related data...');
    
    const promises = [];
    
    // Get service data
    if (booking.service) {
      const servicePromise = Service.findById(booking.service)
        .select('name category pricing')
        .lean();
      promises.push(servicePromise.catch(err => {
        console.warn('⚠️ [ACTIVE-BOOKING] Service lookup failed:', err.message);
        return null;
      }));
    } else {
      promises.push(Promise.resolve(null));
    }
    
    // Get professional data (if needed)
    if (booking.professional && req.userRole === 'user') {
      const professionalPromise = Professional.findById(booking.professional)
        .select('name phone')
        .lean();
      promises.push(professionalPromise.catch(err => {
        console.warn('⚠️ [ACTIVE-BOOKING] Professional lookup failed:', err.message);
        return null;
      }));
    } else {
      promises.push(Promise.resolve(null));
    }
    
    // Get user data (if needed)
    if (booking.user && req.userRole === 'professional') {
      const userPromise = User.findById(booking.user)
        .select('name phone')
        .lean();
      promises.push(userPromise.catch(err => {
        console.warn('⚠️ [ACTIVE-BOOKING] User lookup failed:', err.message);
        return null;
      }));
    } else {
      promises.push(Promise.resolve(null));
    }

    // Execute all queries with timeout
    const queryTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Related data timeout')), 5000);
    });
    
    const allQueries = Promise.all(promises);
    const [service, professional, user] = await Promise.race([allQueries, queryTimeout]);

    console.log('✅ [ACTIVE-BOOKING] Related data retrieved');
    console.log('   - Service:', service ? service.name : 'Not loaded');
    console.log('   - Professional:', professional ? professional.name : 'Not needed/loaded');
    console.log('   - User:', user ? user.name : 'Not needed/loaded');

    // Step 3: Format response based on user role
    console.log('📦 [ACTIVE-BOOKING] Step 3: Formatting response...');
    
    let response = {
      _id: booking._id,
      service: service || { _id: booking.service, name: 'Service details unavailable' },
      scheduledDate: booking.scheduledDate,
      status: booking.status,
      totalAmount: booking.totalAmount,
      location: booking.location,
      tracking: booking.tracking || {},
      isEmergency: booking.isEmergency || false
    };

    if (req.userRole === 'user') {
      response.professional = professional ? {
        _id: professional._id,
        name: professional.name,
        phone: professional.phone
      } : (booking.professional ? {
        _id: booking.professional,
        name: 'Professional details unavailable',
        phone: 'N/A'
      } : null);
    } else if (req.userRole === 'professional') {
      response.user = user ? {
        _id: user._id,
        name: user.name,
        phone: user.phone
      } : {
        _id: booking.user,
        name: 'User details unavailable',
        phone: 'N/A'
      };
      
      // Only share verification code with professional once service is in progress
      if (booking.status === 'in_progress') {
        response.verificationCode = booking.verificationCode;
      }
    }

    console.log('✅ [ACTIVE-BOOKING] Response formatted successfully');

    res.json({
      success: true,
      data: { booking: response }
    });
    
  } catch (error) {
    console.error('❌ [ACTIVE-BOOKING] Error:', error.message);
    console.error('📚 [ACTIVE-BOOKING] Stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to get active booking';
    if (error.message.includes('timeout')) {
      errorMessage = 'Database query timeout - please try again';
    } else if (error.message.includes('connection')) {
      errorMessage = 'Database connection issue - please try again';
    }
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: errorMessage,
        debug: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

/**
 * Get available bookings for professionals to accept
 */
async getAvailableBookings(req, res) {
  try {
    console.log('🔍 [AVAILABLE-BOOKINGS] Getting available bookings for professional:', req.user._id);
    
    const { specialization, radius = 50 } = req.query;
    
    // Get professional details to check specializations and location
    const professional = await Professional.findById(req.user._id).lean();
    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    console.log('👨‍🔧 [AVAILABLE-BOOKINGS] Professional specializations:', professional.specializations);
    console.log('📍 [AVAILABLE-BOOKINGS] Professional location:', professional.currentLocation);

    // Build query for available bookings
    let query = {
      status: 'pending',
      professional: { $exists: false } // No professional assigned yet
    };

    // If specialization filter is provided, use it
    // Otherwise, filter by professional's specializations
    const specializationsToMatch = specialization 
      ? [specialization] 
      : professional.specializations || [];

    if (specializationsToMatch.length > 0) {
      // Get services that match the specializations
      const matchingServices = await Service.find({
        category: { $in: specializationsToMatch }
      }).select('_id').lean();
      
      if (matchingServices.length > 0) {
        query.service = { $in: matchingServices.map(s => s._id) };
      } else {
        // No matching services found
        return res.json({
          success: true,
          bookings: []
        });
      }
    }

    console.log('🔍 [AVAILABLE-BOOKINGS] Query:', JSON.stringify(query));

    // Find available bookings
    let availableBookings = await Booking.find(query)
      .populate('service', 'name category pricing estimatedDuration')
      .populate('user', 'name phone')
      .sort({ isEmergency: -1, createdAt: 1 }) // Emergency bookings first, then FIFO
      .lean();

    console.log(`📋 [AVAILABLE-BOOKINGS] Found ${availableBookings.length} potential bookings`);

    // Filter by location if professional has location and radius is specified
    if (professional.currentLocation && professional.currentLocation.coordinates) {
      const [profLng, profLat] = professional.currentLocation.coordinates;
      
      availableBookings = availableBookings.filter(booking => {
        if (!booking.location || !booking.location.coordinates) {
          return true; // Include if no location data
        }
        
        const [bookingLng, bookingLat] = booking.location.coordinates;
        const distance = this.calculateDistance(profLat, profLng, bookingLat, bookingLng);
        
        console.log(`📍 [AVAILABLE-BOOKINGS] Booking ${booking._id} distance: ${distance.toFixed(2)}km`);
        return distance <= radius;
      });
    }

    console.log(`✅ [AVAILABLE-BOOKINGS] Final count after location filter: ${availableBookings.length}`);

    // Format response
    const formattedBookings = availableBookings.map(booking => ({
      _id: booking._id,
      service: booking.service,
      user: booking.user,
      scheduledDate: booking.scheduledDate,
      location: booking.location,
      status: booking.status,
      totalAmount: booking.totalAmount,
      verificationCode: booking.verificationCode,
      isEmergency: booking.isEmergency,
      tracking: booking.tracking || {},
      createdAt: booking.createdAt
    }));

    res.json({
      success: true,
      bookings: formattedBookings
    });

  } catch (error) {
    console.error('❌ [AVAILABLE-BOOKINGS] Error:', error);
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
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Get booking details by ID
 */
async getBookingById(req, res) {
  console.log('🔍 [GET-BOOKING-BY-ID] Getting booking details for ID:', req.params.bookingId);
  console.log('👤 [GET-BOOKING-BY-ID] User ID:', req.user._id);
  console.log('👤 [GET-BOOKING-BY-ID] User role:', req.userRole);
  
  try {
    const { bookingId } = req.params;
    
    // Validate booking ID format
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      console.log('❌ [GET-BOOKING-BY-ID] Invalid booking ID format');
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    console.log('🔍 [GET-BOOKING-BY-ID] Step 1: Finding booking...');
    
    // Find booking with timeout protection
    const findBookingPromise = Booking.findById(bookingId).lean();
    const findTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Find booking timeout')), 5000);
    });
    
    const booking = await Promise.race([findBookingPromise, findTimeout]);
    
    if (!booking) {
      console.log('❌ [GET-BOOKING-BY-ID] Booking not found');
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    
    console.log('✅ [GET-BOOKING-BY-ID] Found booking:', booking._id);
    console.log('📊 [GET-BOOKING-BY-ID] Booking user:', booking.user);
    console.log('📊 [GET-BOOKING-BY-ID] Booking professional:', booking.professional);
    console.log('📊 [GET-BOOKING-BY-ID] Booking status:', booking.status);

    // Check authorization
    console.log('🔍 [GET-BOOKING-BY-ID] Step 2: Checking authorization...');
    
    const hasAccess = 
      (req.userRole === 'user' && booking.user.toString() === req.user._id.toString()) ||
      (req.userRole === 'professional' && booking.professional && booking.professional.toString() === req.user._id.toString()) ||
      (req.userRole === 'admin'); // Admin can view all bookings
    
    if (!hasAccess) {
      console.log('❌ [GET-BOOKING-BY-ID] Authorization failed');
      console.log('   - User role:', req.userRole);
      console.log('   - User ID:', req.user._id);
      console.log('   - Booking user:', booking.user);
      console.log('   - Booking professional:', booking.professional);
      
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this booking'
      });
    }
    
    console.log('✅ [GET-BOOKING-BY-ID] Authorization passed');

    // Get related data with timeout protection
    console.log('🔍 [GET-BOOKING-BY-ID] Step 3: Getting related data...');
    
    const promises = [];
    
    // Get service data
    if (booking.service) {
      const servicePromise = Service.findById(booking.service)
        .select('name category pricing estimatedDuration description')
        .lean();
      promises.push(servicePromise.catch(err => {
        console.warn('⚠️ [GET-BOOKING-BY-ID] Service lookup failed:', err.message);
        return { _id: booking.service, name: 'Service details unavailable' };
      }));
    } else {
      promises.push(Promise.resolve(null));
    }
    
    // Get professional data
    if (booking.professional) {
      const professionalPromise = Professional.findById(booking.professional)
        .select('name phone rating specializations currentLocation')
        .lean();
      promises.push(professionalPromise.catch(err => {
        console.warn('⚠️ [GET-BOOKING-BY-ID] Professional lookup failed:', err.message);
        return { 
          _id: booking.professional, 
          name: 'Professional details unavailable',
          phone: 'N/A'
        };
      }));
    } else {
      promises.push(Promise.resolve(null));
    }
    
    // Get user data (for professional view)
    if (booking.user && req.userRole === 'professional') {
      const userPromise = User.findById(booking.user)
        .select('name phone')
        .lean();
      promises.push(userPromise.catch(err => {
        console.warn('⚠️ [GET-BOOKING-BY-ID] User lookup failed:', err.message);
        return { 
          _id: booking.user, 
          name: 'User details unavailable',
          phone: 'N/A'
        };
      }));
    } else {
      promises.push(Promise.resolve(null));
    }

    // Execute all queries with timeout
    const queryTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Related data timeout')), 7000);
    });
    
    const allQueries = Promise.all(promises);
    const [service, professional, user] = await Promise.race([allQueries, queryTimeout]);

    console.log('✅ [GET-BOOKING-BY-ID] Related data retrieved');
    console.log('   - Service:', service ? service.name : 'Not loaded');
    console.log('   - Professional:', professional ? professional.name : 'Not assigned/loaded');
    console.log('   - User:', user ? user.name : 'Not needed/loaded');

    // Format response
    console.log('📦 [GET-BOOKING-BY-ID] Step 4: Formatting response...');
    
    let response = {
      _id: booking._id,
      service: service || { 
        _id: booking.service, 
        name: 'Service details unavailable',
        category: 'unknown',
        pricing: { basePrice: booking.totalAmount }
      },
      scheduledDate: booking.scheduledDate,
      status: booking.status,
      totalAmount: booking.totalAmount,
      location: booking.location,
      tracking: booking.tracking || {},
      isEmergency: booking.isEmergency || false,
      createdAt: booking.createdAt,
      completedAt: booking.completedAt,
      cancelledAt: booking.cancelledAt,
      cancellationReason: booking.cancellationReason,
      rating: booking.rating,
      paymentStatus: booking.paymentStatus,
      reschedulingHistory: booking.reschedulingHistory || []
    };

    // Add professional data for user view
    if (req.userRole === 'user' || req.userRole === 'admin') {
      response.professional = professional ? {
        _id: professional._id,
        name: professional.name,
        phone: professional.phone,
        rating: professional.rating || 0,
        specializations: professional.specializations || [],
        image: professional.image || null
      } : null;
      
      // Don't expose verification code to users
      if (booking.status === 'in_progress' && req.userRole === 'admin') {
        response.verificationCode = booking.verificationCode;
      }
    }
    
    // Add user data for professional view
    if (req.userRole === 'professional') {
      response.user = user ? {
        _id: user._id,
        name: user.name,
        phone: user.phone
      } : {
        _id: booking.user,
        name: 'User details unavailable',
        phone: 'N/A'
      };
      
      // Share verification code with assigned professional
      if (booking.status === 'in_progress') {
        response.verificationCode = booking.verificationCode;
      }
    }

    console.log('✅ [GET-BOOKING-BY-ID] Response formatted successfully');

    res.json({
      success: true,
      data: { booking: response }
    });
    
  } catch (error) {
    console.error('❌ [GET-BOOKING-BY-ID] Error:', error.message);
    console.error('📚 [GET-BOOKING-BY-ID] Stack:', error.stack);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to get booking details';
    let statusCode = 500;
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Database query timeout - please try again';
      statusCode = 504;
    } else if (error.message.includes('connection')) {
      errorMessage = 'Database connection issue - please try again';
      statusCode = 503;
    } else if (error.message.includes('Cast to ObjectId failed')) {
      errorMessage = 'Invalid booking ID format';
      statusCode = 400;
    }
    
    if (!res.headersSent) {
      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        debug: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
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
    try {
      const { bookingId } = req.params;
      const { verificationCode } = req.body;

      if (!verificationCode) {
        return res.status(400).json({ 
          success: false, 
          message: 'Verification code is required' 
        });
      }

      const booking = await BookingService.completeService(bookingId, req.user._id, verificationCode);

      res.json({
        success: true,
        message: 'Booking completed successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          completedAt: booking.completedAt
        }
      });
    } catch (error) {
      console.error('❌ Complete booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
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
    try {
      const { bookingId } = req.params;

      const booking = await BookingService.startService(bookingId, req.user._id);

      res.json({
        success: true,
        message: 'Service started successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          tracking: booking.tracking
        }
      });
    } catch (error) {
      console.error('❌ Start service failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        message: error.message || 'Failed to start service' 
      });
    }
  }

  /**
   * Mark professional as arrived
   */
  async professionalArrived(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await BookingService.professionalArrived(bookingId, req.user._id);

      res.json({
        success: true,
        message: 'Arrival marked successfully',
        booking: {
          _id: booking._id,
          tracking: booking.tracking
        }
      });
    } catch (error) {
      console.error('❌ Professional arrived marking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
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
