const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Professional = require('../models/professional.model');
const EnhancedBookingService = require('../services/BookingService'); // Use exact filename
// const logger = require('../config/logger'); // Comment out if not available
const twilioService = require('../services/twilio.service');
const User = require('../models/user.model');

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
  console.log('📋 [BOOKING-API] Booking ID from params:', req.params.bookingId);
  console.log('👤 [BOOKING-API] Professional ID from req.user:', req.user._id);
  console.log('👤 [BOOKING-API] Full req.user:', JSON.stringify(req.user, null, 2));
  
  try {
    const bookingId = req.params.bookingId;
    const professionalId = req.user._id; // ✅ Extract from req.user, not parameters
    
    console.log(`🎯 [BOOKING-API] Attempting to accept booking: ${bookingId}`);
    console.log(`👤 [BOOKING-API] By professional: ${professionalId}`);
    
    // CRITICAL: Validate that professionalId exists
    if (!professionalId) {
      return res.status(400).json({
        success: false,
        message: 'Professional ID not found in authentication token'
      });
    }
    
    // CRITICAL: Validate that bookingId exists
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    // CRITICAL: Validate ObjectId formats
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(professionalId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid professional ID format'
      });
    }

    // ✅ CALL THE SERVICE METHOD (which you need to create separately)
    // Option 1: If you have a BookingService, call it
    // const booking = await BookingService.acceptBooking(bookingId, professionalId);
    
    // Option 2: If you don't have a separate service, implement the logic here:
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Convert to ObjectId explicitly
      const bookingObjectId = new mongoose.Types.ObjectId(bookingId);
      const professionalObjectId = new mongoose.Types.ObjectId(professionalId);
      
      console.log(`🔍 [BOOKING-API] Searching for booking with ObjectId: ${bookingObjectId}`);
      
      // Find booking
      const booking = await Booking.findById(bookingObjectId)
        .populate('user', 'name phone currentLocation')
        .populate('service', 'name category pricing')
        .session(session);
      
      console.log(`🔍 [BOOKING-API] Booking found: ${!!booking}`);
      
      if (!booking) {
        await session.abortTransaction();
        console.error(`❌ [BOOKING-API] No booking found with ID: ${bookingObjectId}`);
        return res.status(404).json({
          success: false,
          message: 'Booking not found or already accepted'
        });
      }
      
      console.log(`📋 [BOOKING-API] Current booking status: ${booking.status}`);
      console.log(`📋 [BOOKING-API] Current booking professional: ${booking.professional}`);
      
      // Check if booking is still pending
      if (booking.status !== 'pending') {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Cannot accept booking: booking is already ${booking.status}`
        });
      }
      
      // Check if booking already has a professional assigned
      if (booking.professional) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: 'Booking already accepted by another professional'
        });
      }
      
      // Find professional
     const professional = await Professional.findById(professionalObjectId)
  .select('name phone rating specializations isAvailable currentLocation currentBooking')
  .session(session);

if (!professional) {
  await session.abortTransaction();
  console.error(`❌ [BOOKING-API] No professional found with ID: ${professionalObjectId}`);
  return res.status(404).json({
    success: false,
    message: 'Professional not found'
  });
}

console.log(`👨‍🔧 [BOOKING-API] Professional found: ${professional.name}`);
console.log(`🔧 [BOOKING-API] Professional specializations: ${professional.specializations}`);
console.log(`📦 [BOOKING-API] Service category: ${booking.service.category}`);

// Verify professional specialization
if (!professional.specializations.includes(booking.service.category)) {
  await session.abortTransaction();
  return res.status(400).json({
    success: false,
    message: `Service category '${booking.service.category}' does not match professional specializations: ${professional.specializations.join(', ')}`
  });
}

// Check professional availability
if (!professional.isAvailable) {
  await session.abortTransaction();
  return res.status(400).json({
    success: false,
    message: 'Professional is not currently available'
  });
}
      
      console.log('📍 [BOOKING-API] Calculating initial ETA...');
      
      // Calculate initial ETA and distance
      let initialETA = null;
      let initialDistance = null;
      
      if (professional.currentLocation && professional.currentLocation.coordinates && 
          booking.location && booking.location.coordinates) {
        
        // Calculate distance using Haversine formula
        const calculateDistance = (lat1, lon1, lat2, lon2) => {
          const R = 6371; // Radius of the Earth in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c;
        };
        
        initialDistance = calculateDistance(
          professional.currentLocation.coordinates[1], // Professional lat
          professional.currentLocation.coordinates[0], // Professional lng
          booking.location.coordinates[1], // Booking lat
          booking.location.coordinates[0]  // Booking lng
        );
        
        // Calculate ETA (assuming average speed of 30 km/h)
        initialETA = Math.round((initialDistance / 30) * 60);
        
        console.log('📏 [BOOKING-API] Initial distance:', initialDistance.toFixed(2), 'km');
        console.log('⏱️ [BOOKING-API] Initial ETA:', initialETA, 'minutes');
      } else {
        console.log('⚠️ [BOOKING-API] Professional or booking location not available for ETA calculation');
      }
      
      // Update booking
      booking.professional = professionalObjectId;
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
      
      console.log('💾 [BOOKING-API] Saving booking...');
      await booking.save({ session });
      console.log('✅ [BOOKING-API] Booking saved');

      console.log('💾 [BOOKING-API] Updating professional availability...');
await Professional.findByIdAndUpdate(
  professionalObjectId,
  { 
    isAvailable: false,
    currentBooking: {
      bookingId: bookingObjectId,
      acceptedAt: new Date()
    }
  },
  { 
    session,
    runValidators: false
  }
);
console.log('✅ [BOOKING-API] Professional updated');
      
      // Update professional availability
      professional.isAvailable = false;
      professional.currentBooking = {
        bookingId: bookingObjectId,
        acceptedAt: new Date()
      };
      
      console.log('💾 [BOOKING-API] Saving professional...');
      await professional.save({ session });
      console.log('✅ [BOOKING-API] Professional saved');
      
      await session.commitTransaction();
      console.log('✅ [BOOKING-API] Transaction committed');
      
      // Populate professional details for response
      await booking.populate('professional', 'name phone rating currentLocation');
      
      console.log('✅ [BOOKING-API] Booking accepted successfully:', booking._id);
      
      // Send success response
      res.status(200).json({
        success: true,
        message: 'Booking accepted successfully',
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            scheduledDate: booking.scheduledDate,
            location: booking.location,
            totalAmount: booking.totalAmount,
            professional: booking.professional,
            acceptedAt: booking.acceptedAt,
            tracking: {
              initialized: true,
              eta: booking.tracking?.eta,
              distance: booking.tracking?.distance,
              initialETA: booking.tracking?.initialETA,
              initialDistance: booking.tracking?.initialDistance
            }
          }
        }
      });

      // TODO: Send socket notifications (if you have socket.io set up)
      // this.notifyBookingAccepted(booking, professional, initialETA, initialDistance);
      
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
    
  } catch (error) {
    console.error('❌ [BOOKING-API] Error accepting booking:', error.message);
    console.error('❌ [BOOKING-API] Error stack:', error.stack);
    
    // Handle specific error cases
    if (error.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or already accepted'
      });
    }
    
    if (error.message.includes('already accepted') || error.message.includes('already')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('not available')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('does not match')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    // Generic error response
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to accept booking',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
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
        setTimeout(() => reject(new Error('Database query timeout')), 10000);
      });
      
      const booking = await Promise.race([findBookingPromise, findTimeout]);

      if (!booking) {
        console.log('❌ [BOOKING-API] No active booking found');
        return res.status(404).json({
          success: false,
          message: 'No active booking found'
        });
      }

      console.log('✅ [BOOKING-API] Active booking found:', {
        id: booking._id,
        status: booking.status,
        service: booking.service?.name
      });

      // Format response based on user role with ID validation
      let response = {
        _id: booking._id.toString(), // Ensure string format
        service: booking.service,
        scheduledDate: booking.scheduledDate,
        status: booking.status,
        totalAmount: booking.totalAmount,
        location: booking.location,
        tracking: booking.tracking || {},
        isEmergency: booking.isEmergency || false,
        createdAt: booking.createdAt,
        hasValidId: !!booking._id
      };

      // Add role-specific data
      if (req.userRole === 'user' && booking.professional) {
        response.professional = {
          _id: booking.professional._id.toString(),
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
          _id: booking.user._id.toString(),
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
      console.error('❌ [BOOKING-API] Get active booking error:', error);
      
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
    console.log('🔍 [BOOKING-API] Getting available bookings for professional:', req.user._id);
    
    try {
      const { specialization, radius = 50 } = req.query;
      
      // Get professional details with enhanced validation
      const professional = await Professional.findById(req.user._id).lean();
      if (!professional) {
        console.log('❌ [BOOKING-API] Professional not found');
        return res.status(404).json({
          success: false,
          message: 'Professional not found'
        });
      }

      console.log('📊 [BOOKING-API] Professional details:', {
        id: professional._id,
        specializations: professional.specializations,
        isAvailable: professional.isAvailable,
        hasLocation: !!professional.currentLocation?.coordinates
      });

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
          console.log('📭 [BOOKING-API] No services match specializations');
          return res.json({
            success: true,
            bookings: [],
            totalCount: 0,
            message: 'No services match your specializations'
          });
        }
      }

      console.log('🔍 [BOOKING-API] Query:', JSON.stringify(query));

      // Find available bookings with enhanced population
      let availableBookings = await Booking.find(query)
        .populate('service', 'name category pricing estimatedDuration')
        .populate('user', 'name phone')
        .sort({ isEmergency: -1, createdAt: 1 })
        .lean();

      console.log(`📊 [BOOKING-API] Found ${availableBookings.length} potential bookings`);

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

      console.log(`📊 [BOOKING-API] Final count after location filter: ${availableBookings.length}`);

      // Format bookings for response with proper ID handling
      const formattedBookings = availableBookings
        .filter(booking => booking._id) // Ensure booking has valid ID
        .map(booking => ({
          _id: booking._id.toString(), // Ensure string format
          service: booking.service,
          customer: {
            name: booking.user?.name || 'Customer',
            phone: booking.user?.phone || ''
          },
          scheduledDate: booking.scheduledDate,
          location: booking.location,
          status: booking.status,
          totalAmount: booking.totalAmount || 0,
          isEmergency: booking.isEmergency || false,
          distanceFromYou: booking.distanceFromYou,
          estimatedETA: booking.estimatedETA,
          createdAt: booking.createdAt,
          // Add verification that ID exists
          hasValidId: !!booking._id
        }))
        .filter(booking => booking.hasValidId); // Final filter for valid IDs

      console.log(`✅ [BOOKING-API] Formatted ${formattedBookings.length} bookings with valid IDs`);

      res.json({
        success: true,
        bookings: formattedBookings,
        totalCount: formattedBookings.length,
        professionalLocation: professional.currentLocation,
        metadata: {
          radius: radius,
          specializations: specializationsToMatch,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ [BOOKING-API] Get available bookings error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get available bookings',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
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
  console.log('🚀 [BOOKING-CONTROLLER] Starting service for booking');
  console.log('📋 [BOOKING-CONTROLLER] Booking ID:', req.params.bookingId);
  console.log('👤 [BOOKING-CONTROLLER] Professional ID:', req.user._id);
  
  try {
    // ✅ CORRECT: Extract from req.params (not req.body!)
    const bookingId = req.params.bookingId;  // ← From URL parameter
    const professionalId = req.user._id;      // ← From auth middleware
    
    // Validate inputs
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    console.log('✅ [BOOKING-CONTROLLER] Validation passed, calling service...');
    
    // ✅ CORRECT: Call SERVICE method with direct parameters
    const booking = await EnhancedBookingService.startService(
      bookingId,        // ← Direct parameter
      professionalId    // ← Direct parameter
    );
    
    console.log('✅ [BOOKING-CONTROLLER] Service started successfully');

    // Send response
    res.status(200).json({
      success: true,
      message: 'Service started successfully',
      data: {
        booking: {
          _id: booking._id,
          status: booking.status,
          tracking: {
            startedAt: booking.tracking?.startedAt,
            liveTrackingEnabled: booking.tracking?.liveTrackingEnabled,
            eta: booking.tracking?.eta,
            distance: booking.tracking?.distance
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ [BOOKING-CONTROLLER] Error starting service:', error.message);
    
    // Handle specific errors
    if (error.message === 'Booking not found') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not in accepted status'
      });
    }
    
    if (error.message.includes('cannot start') || 
        error.message.includes('not assigned')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    // Generic error
    res.status(500).json({
      success: false,
      message: 'Failed to start service',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

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
  async sendServiceCompletionOTP(req, res) {
    console.log('📱 [BOOKING-API] Sending service completion OTP');
    
    try {
      const { bookingId } = req.params;
      const professionalId = req.user._id;

      console.log('📋 [BOOKING-API] Booking ID:', bookingId);
      console.log('👨‍🔧 [BOOKING-API] Professional ID:', professionalId);

      // Validate booking ID
      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      // Find and validate booking
      const booking = await Booking.findOne({
        _id: bookingId,
        professional: professionalId,
        status: 'in_progress'
      }).populate('user', 'name phone email');

      if (!booking) {
        console.log('❌ [BOOKING-API] Booking not found or not in progress');
        return res.status(404).json({
          success: false,
          message: 'Booking not found or not in progress'
        });
      }

      console.log('✅ [BOOKING-API] Booking found:', {
        id: booking._id,
        status: booking.status,
        customer: booking.user?.name
      });

      // Check if user has phone number
      if (!booking.user?.phone) {
        console.log('❌ [BOOKING-API] Customer phone number not found');
        return res.status(400).json({
          success: false,
          message: 'Customer phone number not found'
        });
      }

      // Send OTP to customer's phone using Twilio service
      const customerPhone = booking.user.phone;
      console.log('📞 [BOOKING-API] Sending OTP to:', customerPhone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2'));
      
      const otpResult = await twilioService.sendOtp(customerPhone);

      // Store session ID in booking for verification
      booking.completionOTPSession = otpResult.sessionId;
      booking.completionOTPSentAt = new Date();
      booking.completionOTPAttempts = 0; // Reset attempts
      await booking.save();

      console.log('✅ [BOOKING-API] OTP sent successfully');

      res.status(200).json({
        success: true,
        message: 'OTP sent to customer successfully',
        data: {
          sessionId: otpResult.sessionId,
          customerPhone: customerPhone.replace(/(\d{2})\d{6}(\d{2})/, '$1******$2'),
          expiresIn: 600 // 10 minutes in seconds
        }
      });

    } catch (error) {
      console.error('❌ [BOOKING-API] Error sending service completion OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send OTP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Verify OTP and mark service as completed
   * Professional enters the OTP received from customer
   */
async verifyServiceCompletionOTP(req, res) {
  console.log('🔍 [BOOKING-API] Verifying service completion OTP');
  
  try {
    const { bookingId } = req.params;
    const { otp } = req.body;
    const professionalId = req.user._id;

    console.log('📋 [BOOKING-API] Booking ID:', bookingId);
    console.log('🔢 [BOOKING-API] OTP length:', otp?.length);

    // Validate input
    if (!bookingId || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Booking ID and OTP are required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Validate OTP format
    if (!/^\d{4,6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'OTP must be 4-6 digits'
      });
    }

    // Find booking
    const booking = await Booking.findOne({
      _id: bookingId,
      professional: professionalId,
      status: 'in_progress' // ✅ Must be in_progress
    }).populate('user', 'name phone email').populate('service', 'name category pricing');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not in progress'
      });
    }

    // Check if OTP was sent
    if (!booking.completionOTPSession) {
      console.log('❌ [BOOKING-API] OTP not sent yet');
      return res.status(400).json({
        success: false,
        message: 'OTP not sent yet. Please request OTP first.'
      });
    }

    // Check OTP expiry (10 minutes)
    const otpAge = (new Date() - new Date(booking.completionOTPSentAt)) / 1000 / 60;
    if (otpAge > 10) {
      console.log('❌ [BOOKING-API] OTP expired. Age:', otpAge.toFixed(2), 'minutes');
      return res.status(400).json({
        success: false,
        message: 'OTP expired. Please request a new one.',
        expired: true
      });
    }

    // Check attempt limit (max 3 attempts)
    if (booking.completionOTPAttempts >= 3) {
      console.log('❌ [BOOKING-API] Max OTP attempts reached');
      return res.status(400).json({
        success: false,
        message: 'Maximum OTP attempts reached. Please request a new OTP.',
        maxAttemptsReached: true
      });
    }

    // Verify OTP using Twilio Verify API
    const isValid = await twilioService.verifyOtp(booking.user.phone, otp);

    if (!isValid) {
      booking.completionOTPAttempts = (booking.completionOTPAttempts || 0) + 1;
      await booking.save();

      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again.',
        attemptsRemaining: 3 - booking.completionOTPAttempts
      });
    }

    console.log('✅ [BOOKING-API] OTP verified successfully');

    // ✅ CRITICAL: NOW mark service as completed
    booking.status = 'completed';
    booking.completedAt = new Date();
    booking.completionOTPVerifiedAt = new Date();
    
    // Stop tracking automatically
    if (booking.tracking) {
      booking.tracking.isActive = false;
      booking.tracking.liveTrackingEnabled = false;
      booking.tracking.trackingEnded = new Date();
      
      if (booking.tracking.startedAt) {
        const serviceTime = (new Date() - new Date(booking.tracking.startedAt)) / 1000 / 60;
        booking.tracking.totalServiceTime = Math.round(serviceTime);
      }
    }
    
    await booking.save();

    // Calculate payment breakdown
    const serviceAmount = booking.totalAmount || booking.service?.pricing?.basePrice || 0;
    const additionalCharges = booking.additionalCharges || [];
    
    const additionalAmount = additionalCharges.reduce(
      (sum, charge) => sum + (charge.amount || 0),
      0
    );
    const totalAmount = serviceAmount + additionalAmount;
    const commissionRate = 0.15;
    const platformCommission = Math.round(totalAmount * commissionRate * 100) / 100;
    const professionalPayout = Math.round((totalAmount - platformCommission) * 100) / 100;

    const paymentBreakdown = {
      serviceAmount: parseFloat(serviceAmount.toFixed(2)),
      additionalAmount: parseFloat(additionalAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      platformCommission: parseFloat(platformCommission.toFixed(2)),
      professionalPayout: parseFloat(professionalPayout.toFixed(2)),
      commissionRate,
      additionalCharges
    };

    res.status(200).json({
      success: true,
      message: 'Service completed successfully',
      data: {
        booking: {
          _id: booking._id,
          status: booking.status,
          completedAt: booking.completedAt,
          tracking: {
            isActive: false,
            trackingEnded: booking.tracking?.trackingEnded,
            totalServiceTime: booking.tracking?.totalServiceTime
          }
        },
        paymentBreakdown
      }
    });

  } catch (error) {
    console.error('❌ [BOOKING-API] Error verifying OTP:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify OTP',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

  async updateTrackingLocation (req, res) {
     try {
    const { bookingId, latitude, longitude, accuracy, heading, speed } = req.body;
    const professionalId = req.user.professionalId || req.user._id;

    const booking = await Booking.findOne({
      _id: bookingId,
      professional: professionalId,
      status: { $in: ['accepted', 'in_progress'] }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Active booking not found'
      });
    }

    // Update tracking location
    booking.updateTracking({
      coordinates: [parseFloat(longitude), parseFloat(latitude)],
      accuracy: accuracy || null,
      heading: heading || null,
      speed: speed || null
    });

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Location updated',
      tracking: {
        distance: booking.tracking.distance,
        eta: booking.tracking.eta
      }
    });

  } catch (error) {
    console.error('❌ Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: error.message
    });
  }
};


  /**
   * Resend OTP for service completion
   */
  async resendServiceCompletionOTP(req, res) {
    console.log('🔄 [BOOKING-API] Resending service completion OTP');
    
    try {
      const { bookingId } = req.params;
      const professionalId = req.user._id;

      if (!mongoose.Types.ObjectId.isValid(bookingId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid booking ID format'
        });
      }

      // Find booking
      const booking = await Booking.findOne({
        _id: bookingId,
        professional: professionalId,
        status: 'in_progress'
      }).populate('user', 'name phone email');

      if (!booking) {
        console.log('❌ [BOOKING-API] Booking not found');
        return res.status(404).json({
          success: false,
          message: 'Booking not found or not in progress'
        });
      }

      // Check if last OTP was sent recently (prevent spam)
      if (booking.completionOTPSentAt) {
        const timeSinceLastOTP = (new Date() - new Date(booking.completionOTPSentAt)) / 1000;
        if (timeSinceLastOTP < 30) { // 30 seconds cooldown
          return res.status(429).json({
            success: false,
            message: 'Please wait 30 seconds before requesting a new OTP',
            retryAfter: Math.ceil(30 - timeSinceLastOTP)
          });
        }
      }

      // Send new OTP
      const otpResult = await twilioService.sendOtp(booking.user.phone);

      // Update booking
      booking.completionOTPSession = otpResult.sessionId;
      booking.completionOTPSentAt = new Date();
      booking.completionOTPAttempts = 0; // Reset attempts
      await booking.save();

      console.log('✅ [BOOKING-API] OTP resent successfully');

      res.status(200).json({
        success: true,
        message: 'OTP resent successfully',
        data: {
          sessionId: otpResult.sessionId,
          expiresIn: 600
        }
      });

    } catch (error) {
      console.error('❌ [BOOKING-API] Error resending OTP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resend OTP',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Helper function to calculate payment breakdown
   * @private
   */
  calculatePaymentBreakdown(serviceAmount, additionalCharges = [], commissionRate = 0.15) {
    const additionalAmount = additionalCharges.reduce(
      (sum, charge) => sum + (charge.amount || 0),
      0
    );
    const totalAmount = serviceAmount + additionalAmount;
    const platformCommission = Math.round(totalAmount * commissionRate * 100) / 100;
    const professionalPayout = Math.round((totalAmount - platformCommission) * 100) / 100;

    return {
      serviceAmount: parseFloat(serviceAmount.toFixed(2)),
      additionalAmount: parseFloat(additionalAmount.toFixed(2)),
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      platformCommission: parseFloat(platformCommission.toFixed(2)),
      professionalPayout: parseFloat(professionalPayout.toFixed(2)),
      commissionRate,
      additionalCharges
    };
  }


  
}

module.exports = new BookingController();
