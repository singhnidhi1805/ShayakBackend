// ========================================
// TEST ROUTES WITH SWAGGER DOCUMENTATION
// ========================================


const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const TestController = require('../controllers/test.controller');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');

/**
 * @swagger
 * components:
 *   schemas:
 *     TestBookingRequest:
 *       type: object
 *       required:
 *         - serviceId
 *         - location
 *         - scheduledDate
 *       properties:
 *         serviceId:
 *           type: string
 *           description: ID of the service to book
 *           example: "67cb2f40a6c2123077188042"
 *         location:
 *           type: object
 *           required:
 *             - coordinates
 *           properties:
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               description: Location coordinates [longitude, latitude]
 *               example: [85.3096, 23.3441]
 *             address:
 *               type: string
 *               description: Human readable address
 *               example: "Ranchi, Jharkhand"
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *           description: When the service should be performed
 *           example: "2025-05-28T10:00:00.000Z"
 *     
 *     TestBookingResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Test booking created successfully"
 *         data:
 *           type: object
 *           properties:
 *             booking:
 *               type: object
 *               properties:
 *                 _id:
 *                   type: string
 *                   example: "67d12345678901234567890a"
 *                 status:
 *                   type: string
 *                   example: "pending"
 *                 totalAmount:
 *                   type: number
 *                   example: 230
 *                 verificationCode:
 *                   type: string
 *                   example: "123456"
 *                 professionalsFound:
 *                   type: number
 *                   example: 1
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   - name: Test
 *     description: Test endpoints for debugging booking system
 */

/**
 * @swagger
 * /api/test/ping:
 *   get:
 *     summary: Basic server health check (No authentication required)
 *     tags: [Test]
 *     description: Test if the server is running and routes are working
 *     responses:
 *       200:
 *         description: Server is running successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Server is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-01-28T10:00:00.000Z"
 *       500:
 *         description: Server error
 */
router.get('/ping', (req, res) => {
    console.log('🏓 [PING] Ping route called');
    res.json({ 
      success: true, 
      message: 'Server is running', 
      timestamp: new Date().toISOString() 
    });
  });
  

/**
 * @swagger
 * /api/test/auth-test:
 *   get:
 *     summary: Test authentication middleware
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     description: Test if JWT authentication is working and database is connected
 *     responses:
 *       200:
 *         description: Authentication successful and database connected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Basic test successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: string
 *                       example: "67d02a8e861e81bd0f5727b6"
 *                     serviceCount:
 *                       type: number
 *                       example: 5
 *                     professionalCount:
 *                       type: number
 *                       example: 2
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Authentication failed - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Authentication failed"
 *       500:
 *         description: Database connection error
 */
router.get('/auth-test', auth(), TestController.testBasic);


/**
 * @swagger
 * /api/test/booking:
 *   post:
 *     summary: Test booking creation with detailed debugging
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Test the complete booking creation process with step-by-step logging.
 *       This will help identify exactly where the booking process fails.
 *       
 *       **Prerequisites:**
 *       - Professional must be available with painting specialization
 *       - Service must exist and be active
 *       - User must be authenticated
 *       
 *       **What this tests:**
 *       1. Request validation
 *       2. Service lookup
 *       3. Professional matching
 *       4. Database operations
 *       5. Response generation
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TestBookingRequest'
 *           examples:
 *             ranchi_location:
 *               summary: Ranchi location (matches professional)
 *               value:
 *                 serviceId: "67cb2f40a6c2123077188042"
 *                 location:
 *                   coordinates: [85.3096, 23.3441]
 *                   address: "Ranchi, Jharkhand"
 *                 scheduledDate: "2025-05-28T10:00:00.000Z"
 *             bangalore_location:
 *               summary: Bangalore location (alternative)
 *               value:
 *                 serviceId: "67cb2f40a6c2123077188042"
 *                 location:
 *                   coordinates: [77.5946, 12.9716]
 *                   address: "Bangalore, Karnataka"
 *                 scheduledDate: "2025-05-28T14:00:00.000Z"
 *     responses:
 *       201:
 *         description: Test booking created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestBookingResponse'
 *       400:
 *         description: Bad request - Missing or invalid data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Missing required fields"
 *                 step:
 *                   type: string
 *                   example: "validation"
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Authentication required"
 *       404:
 *         description: Service not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Service not found"
 *                 step:
 *                   type: string
 *                   example: "service_lookup"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Database error"
 *                 step:
 *                   type: string
 *                   example: "booking_creation"
 */
router.post('/booking', auth(), TestController.createTestBooking);

/**
 * @swagger
 * /api/test/professional-check:
 *   get:
 *     summary: Check professional data for debugging
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Check the current state of professionals in the database.
 *       This helps debug why professionals might not be found for bookings.
 *     parameters:
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *           enum: [plumbing, electrical, painting, cleaning, carpentry]
 *         description: Filter by specialization
 *         example: painting
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [verified, under_review, pending]
 *         description: Filter by status
 *         example: verified
 *     responses:
 *       200:
 *         description: Professional data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Professional data retrieved"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProfessionals:
 *                       type: number
 *                       example: 2
 *                     availableProfessionals:
 *                       type: number
 *                       example: 1
 *                     professionals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           specializations:
 *                             type: array
 *                             items:
 *                               type: string
 *                           status:
 *                             type: string
 *                           isAvailable:
 *                             type: boolean
 *                           coordinates:
 *                             type: array
 *                             items:
 *                               type: number
 */
router.get('/professional-check', auth(), async (req, res) => {
    console.log('👥 [PROF-CHECK] Professional check called');
    
    try {
      const { specialization, status } = req.query;
      
      let query = {};
      if (specialization) {
        query.specializations = { $in: [specialization] };
      }
      if (status) {
        query.status = status;
      }
      
      // Add timeout to database query
      const queryPromise = Professional.find(query)
        .select('name specializations status isAvailable currentLocation');
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 5000);
      });
      
      const allProfessionals = await Promise.race([queryPromise, timeoutPromise]);
      
      const availableProfessionals = allProfessionals.filter(prof => 
        prof.status === 'verified' && 
        prof.isAvailable === true &&
        prof.currentLocation.coordinates[0] !== 0 &&
        prof.currentLocation.coordinates[1] !== 0
      );
      
      console.log('👥 [PROF-CHECK] Total professionals:', allProfessionals.length);
      console.log('👥 [PROF-CHECK] Available professionals:', availableProfessionals.length);
      
      const formattedProfessionals = allProfessionals.map(prof => ({
        _id: prof._id,
        name: prof.name,
        specializations: prof.specializations,
        status: prof.status,
        isAvailable: prof.isAvailable,
        coordinates: prof.currentLocation.coordinates
      }));
      
      res.json({
        success: true,
        message: 'Professional data retrieved',
        data: {
          totalProfessionals: allProfessionals.length,
          availableProfessionals: availableProfessionals.length,
          professionals: formattedProfessionals
        }
      });
      
    } catch (error) {
      console.error('❌ [PROF-CHECK] Error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
/**
 * @swagger
 * /api/test/service-check/{serviceId}:
 *   get:
 *     summary: Check specific service details
 *     tags: [Test]
 *     security:
 *       - bearerAuth: []
 *     description: Check if a specific service exists and get its details
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Service ID to check
 *         example: "67cb2f40a6c2123077188042"
 *     responses:
 *       200:
 *         description: Service details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Service found"
 *                 data:
 *                   type: object
 *                   properties:
 *                     service:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         category:
 *                           type: string
 *                         pricing:
 *                           type: object
 *                         isActive:
 *                           type: boolean
 *       404:
 *         description: Service not found
 */
router.get('/service-check/:serviceId', auth(), async (req, res) => {
    console.log('🔍 [SERVICE-CHECK] Service check called for:', req.params.serviceId);
    
    try {
      // Add timeout to database query
      const queryPromise = Service.findById(req.params.serviceId);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 5000);
      });
      
      const service = await Promise.race([queryPromise, timeoutPromise]);
      
      if (!service) {
        console.log('❌ [SERVICE-CHECK] Service not found');
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }
      
      console.log('✅ [SERVICE-CHECK] Service found:', service.name);
      
      res.json({
        success: true,
        message: 'Service found',
        data: {
          service: {
            _id: service._id,
            name: service.name,
            category: service.category,
            pricing: service.pricing,
            isActive: service.isActive,
            description: service.description
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [SERVICE-CHECK] Error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  });
// Middleware to log all requests
router.use((req, res, next) => {
    console.log('📡 [TEST-ROUTE] Request:', req.method, req.path);
    console.log('📡 [TEST-ROUTE] Auth Header:', req.headers.authorization ? 'Present' : 'Missing');
    next();
  });

module.exports = router;

// ========================================
// SWAGGER SETUP INSTRUCTIONS
// ========================================

/*
1. Add these routes to your main app.js:
   
   const testRoutes = require('./routes/test.routes');
   app.use('/api/test', testRoutes);

2. Make sure your swagger setup includes this file:
   
   const swaggerJsdoc = require('swagger-jsdoc');
   const swaggerUi = require('swagger-ui-express');
   
   const options = {
     definition: {
       openapi: '3.0.0',
       info: {
         title: 'Booking API',
         version: '1.0.0',
       },
     },
     apis: ['./routes/*.js'], // Include all route files
   };
   
   const specs = swaggerJsdoc(options);
   app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

3. Test in this order:
   
   a) GET /api/test/ping (no auth needed)
   b) GET /api/test/auth-test (with JWT token)
   c) GET /api/test/professional-check?specialization=painting
   d) GET /api/test/service-check/67cb2f40a6c2123077188042
   e) POST /api/test/booking (with full request body)
*/

// ========================================
// QUICK TEST CHECKLIST
// ========================================

console.log(`
🧪 SWAGGER TESTING CHECKLIST:
=============================

✅ Step 1: Test basic connectivity
   GET /api/test/ping
   → Should return: {"success": true, "message": "Server is running"}

✅ Step 2: Test authentication
   GET /api/test/auth-test
   → Headers: Authorization: Bearer YOUR_JWT_TOKEN
   → Should return user info and database counts

✅ Step 3: Check professional data
   GET /api/test/professional-check?specialization=painting
   → Should show available professionals with painting specialization

✅ Step 4: Check service data
   GET /api/test/service-check/67cb2f40a6c2123077188042
   → Should show service details for painting service

✅ Step 5: Test booking creation
   POST /api/test/booking
   → Body: {
       "serviceId": "67cb2f40a6c2123077188042",
       "location": {"coordinates": [85.3096, 23.3441]},
       "scheduledDate": "2025-05-28T10:00:00.000Z"
     }
   → Should create booking successfully

🔍 DEBUGGING:
- Watch console logs for each step
- Each endpoint will show exactly what's happening
- If any step fails, you'll know exactly where
`);

// ========================================
// CONTROLLER TEMPLATE
// ========================================

/*
Create controllers/test.controller.js with the TestController class
from the previous artifact. The controller includes:

- testBasic() - Tests auth and database connection
- createTestBooking() - Tests complete booking flow with debugging
- All methods include extensive console logging
- Step-by-step error tracking
- Professional and service validation
*/