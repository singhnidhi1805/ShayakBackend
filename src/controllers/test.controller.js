const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Professional = require('../models/professional.model');

class TestController {
  
  // Simple auth test with timeout
  async testBasic(req, res) {
    console.log('🧪 [BASIC-TEST] Basic test called');
    console.log('👤 [BASIC-TEST] User ID:', req.user?._id);
    
    try {
      // Add timeout to database operations
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timeout')), 8000);
      });
      
      const dbPromise = new Promise(async (resolve) => {
        console.log('📊 [BASIC-TEST] Counting services...');
        const serviceCount = await Service.countDocuments();
        console.log('📊 [BASIC-TEST] Service count:', serviceCount);
        
        console.log('👥 [BASIC-TEST] Counting professionals...');
        const professionalCount = await Professional.countDocuments();
        console.log('👥 [BASIC-TEST] Professional count:', professionalCount);
        
        resolve({ serviceCount, professionalCount });
      });
      
      const dbResult = await Promise.race([dbPromise, timeoutPromise]);
      
      console.log('✅ [BASIC-TEST] Database operations completed');
      
      res.json({
        success: true,
        message: 'Basic test successful',
        data: {
          user: req.user._id,
          serviceCount: dbResult.serviceCount,
          professionalCount: dbResult.professionalCount,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('❌ [BASIC-TEST] Error:', error.message);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: error.message,
          step: 'database_operation'
        });
      }
    }
  }
  
  // Ultra-simple booking test
  async createTestBooking(req, res) {
    console.log('📝 [BOOKING-TEST] Booking test called');
    console.log('📊 [BOOKING-TEST] Request body:', JSON.stringify(req.body, null, 2));
    console.log('👤 [BOOKING-TEST] User ID:', req.user?._id);
    
    try {
      const { serviceId, location, scheduledDate } = req.body;
      
      // Step 1: Validation
      console.log('🔍 [BOOKING-TEST] Step 1: Validation');
      if (!serviceId || !location?.coordinates || !scheduledDate) {
        console.log('❌ [BOOKING-TEST] Validation failed');
        return res.status(400).json({
          success: false,
          message: 'Missing required fields',
          step: 'validation'
        });
      }
      console.log('✅ [BOOKING-TEST] Validation passed');
      
      // Step 2: Find service (with timeout)
      console.log('🔍 [BOOKING-TEST] Step 2: Finding service...');
      const servicePromise = Service.findById(serviceId);
      const serviceTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Service lookup timeout')), 5000);
      });
      
      const service = await Promise.race([servicePromise, serviceTimeout]);
      
      if (!service) {
        console.log('❌ [BOOKING-TEST] Service not found');
        return res.status(404).json({
          success: false,
          message: 'Service not found',
          step: 'service_lookup'
        });
      }
      console.log('✅ [BOOKING-TEST] Service found:', service.name);
      
      // Step 3: Find professionals (with timeout)
      console.log('🔍 [BOOKING-TEST] Step 3: Finding professionals...');
      const profPromise = Professional.find({
        specializations: { $in: [service.category] },
        status: 'verified',
        isAvailable: true
      }).select('name specializations status isAvailable currentLocation');
      
      const profTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Professional lookup timeout')), 5000);
      });
      
      const professionals = await Promise.race([profPromise, profTimeout]);
      
      console.log('👥 [BOOKING-TEST] Found', professionals.length, 'professionals');
      professionals.forEach(prof => {
        console.log(`   - ${prof.name}: Available=${prof.isAvailable}, Location=[${prof.currentLocation.coordinates.join(',')}]`);
      });
      
      // Step 4: Create booking (with timeout)
      console.log('🔍 [BOOKING-TEST] Step 4: Creating booking...');
      const bookingData = {
        user: req.user._id,
        service: serviceId,
        location: {
          type: 'Point',
          coordinates: location.coordinates
        },
        scheduledDate: new Date(scheduledDate),
        status: 'pending',
        totalAmount: service.pricing?.amount || 230,
        verificationCode: Math.floor(100000 + Math.random() * 900000).toString(),
        isEmergency: false
      };
      
      const booking = new Booking(bookingData);
      
      const savePromise = booking.save();
      const saveTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Booking save timeout')), 5000);
      });
      
      const savedBooking = await Promise.race([savePromise, saveTimeout]);
      
      console.log('✅ [BOOKING-TEST] Booking created:', savedBooking._id);
      
      // Step 5: Send response
      console.log('📤 [BOOKING-TEST] Step 5: Sending response...');
      res.status(201).json({
        success: true,
        message: 'Test booking created successfully',
        data: {
          booking: {
            _id: savedBooking._id,
            status: savedBooking.status,
            totalAmount: savedBooking.totalAmount,
            verificationCode: savedBooking.verificationCode,
            professionalsFound: professionals.length
          }
        }
      });
      console.log('✅ [BOOKING-TEST] Response sent successfully');
      
    } catch (error) {
      console.error('❌ [BOOKING-TEST] Error:', error.message);
      console.error('📚 [BOOKING-TEST] Stack:', error.stack);
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: error.message,
          step: 'booking_creation'
        });
      }
    }
  }
}

module.exports = new TestController();
