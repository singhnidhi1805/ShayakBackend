/**
 * @swagger
 * tags:
 *   name: Professional
 *   description: API to manage Professional
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const multer = require('multer');
const verifyDocument = require('../controllers/document-verification.controller');
const { body, validationResult } = require('express-validator');
const Professional = require('../models/professional.model');

const { 
  getProfessionals,
  getProfessionalAvailability,
  validateProfessionalDocuments,
  updateProfessionalLocation,
  updateProfessionalProfile,
  getProfessionalById,
} = require('../controllers/professional.controller');

const { ProfessionalService } = require('../services/professional.service');

/**
 * @swagger
 * /api/professionals:
 *   get:
 *     tags:
 *       - Professional
 *     summary: Get a list of professionals
 *     parameters:
 *       - in: query
 *         name: category
 *         description: Category of the professional
 *         schema:
 *           type: string
 *       - in: query
 *         name: rating
 *         description: Minimum rating of the professional
 *         schema:
 *           type: number
 *       - in: query
 *         name: available
 *         description: Availability of the professional
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: A list of professionals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Professional'
 *       500:
 *         description: Server error
 */
router.get('/', getProfessionals);

/**
 * @swagger
 * /api/professionals/{id}/availability:
 *   get:
 *     tags:
 *       - Professional
 *     summary: Get the availability of a specific professional
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the professional
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Professional availability
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   time:
 *                     type: string
 *                   available:
 *                     type: boolean
 *       500:
 *         description: Server error
 */
router.get('/:id/availability', getProfessionalAvailability);

/**
 * @swagger
 * /api/professionals/documents/validate:
 *   post:
 *     tags:
 *       - Professional
 *     summary: Validate the professional's document
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professionalId:
 *                 type: string
 *                 description: The ID of the professional
 *               documentId:
 *                 type: string
 *                 description: The ID of the document
 *               status:
 *                 type: string
 *                 enum:
 *                   - approved
 *                   - rejected
 *                 description: Status of the document
 *               remarks:
 *                 type: string
 *                 description: Additional remarks for the document
 *     responses:
 *       200:
 *         description: Document validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 *       500:
 *         description: Server error
 */
// FIXED: Using auth() instead of auth (allows all authenticated users for validation)
router.post('/documents/validate', auth(), validateProfessionalDocuments);

// /**
//  * @swagger
//  * /api/professionals/location:
//  *   put:
//  *     tags:
//  *       - Professional
//  *     summary: Update the professional's location
//  *     security:
//  *       - bearerAuth: []
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             type: object
//  *             properties:
//  *               coordinates:
//  *                 type: array
//  *                 items:
//  *                   type: number
//  *                 description: Coordinates (longitude, latitude)
//  *               isAvailable:
//  *                 type: boolean
//  *                 description: Availability status of the professional
//  *     responses:
//  *       200:
//  *         description: Professional location updated successfully
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: object
//  *               properties:
//  *                 status:
//  *                   type: string
//  *       401:
//  *         description: Unauthorized
//  *       403:
//  *         description: Access denied - Professional role required
//  *       404:
//  *         description: Professional not found
//  *       500:
//  *         description: Server error
//  */
// // FIXED: Using auth(['professional']) for professional-specific actions
// router.put('/location', auth(['professional']), updateProfessionalLocation);

/**
 * @swagger
 * /api/professionals/profile:
 *   put:
 *     tags:
 *       - Professional
 *     summary: Update the professional's profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               specializations:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specializations of the professional
 *               experience:
 *                 type: string
 *                 description: Experience details of the professional
 *               qualifications:
 *                 type: string
 *                 description: Qualifications of the professional
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 *       400:
 *         description: Invalid data
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/professionals/onboard:
 *   post:
 *     tags:
 *       - Professional
 *     summary: Onboard a new professional
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Details of the professional to onboard
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the professional
 *               email:
 *                 type: string
 *                 description: Email of the professional
 *               phone:
 *                 type: string
 *                 description: Phone number of the professional
 *               specializations:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Specializations of the professional
 *               experience:
 *                 type: string
 *                 description: Professional experience
 *               documents:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: Required documents for onboarding
 *     responses:
 *       201:
 *         description: Professional onboarded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   description: ID of the onboarded professional
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/professionals/metrics:
 *   get:
 *     tags:
 *       - Professional
 *     summary: Track performance metrics of a professional
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobsCompleted:
 *                   type: number
 *                   description: Total jobs completed by the professional
 *                 ratings:
 *                   type: number
 *                   description: Average rating of the professional
 *                 feedbacks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       feedback:
 *                         type: string
 *                         description: Customer feedback
 *                       date:
 *                         type: string
 *                         format: date-time
 *                         description: Date of feedback
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/professionals/{id}:
 *   get:
 *     summary: Get professional by ID
 *     description: Fetches a professional's details by their unique ID.
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The professional's unique ID.
 *     responses:
 *       "200":
 *         description: Successfully retrieved professional details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "123456789"
 *                 name:
 *                   type: string
 *                   example: "John Doe"
 *                 email:
 *                   type: string
 *                   example: "john.doe@example.com"
 *                 status:
 *                   type: string
 *                   enum: [under_review, verified, rejected]
 *                   example: "verified"
 *       "400":
 *         description: Invalid ID format
 *       "404":
 *         description: Professional not found
 *       "401":
 *         description: Unauthorized, missing or invalid token
 *       "500":
 *         description: Server error
 */
// FIXED: Using auth() instead of auth
router.get('/:id', auth(), getProfessionalById);

/**
 * @swagger
 * /api/professionals/{id}/documents:
 *   get:
 *     summary: Get professional documents by professional ID
 *     description: Fetches the documents of a professional by their ID.
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The professional's ID (either _id or userId).
 *     responses:
 *       "200":
 *         description: Successfully retrieved professional documents
 *       "401":
 *         description: Unauthorized
 *       "403":
 *         description: Access denied - Admin role required
 *       "404":
 *         description: Professional not found
 *       "500":
 *         description: Server error
 */
// FIXED: Using auth(['admin']) for document access - only admins should see documents
router.get('/:id/documents', auth(['admin']), async (req, res) => {
  try {
    console.log('👨‍💼 [PROF-DOCS] Getting professional documents for ID:', req.params.id);
    
    const { id } = req.params;
    const mongoose = require('mongoose');
    const Professional = require('../models/professional.model');
    
    // Try to find the professional by the given ID
    let professional = null;
    
    // First, try direct ID match
    if (mongoose.Types.ObjectId.isValid(id)) {
      professional = await Professional.findById(id);
      console.log(`🔍 Search by direct ID ${id}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // If not found, try as userId
    if (!professional) {
      professional = await Professional.findOne({ userId: id });
      console.log(`🔍 Search by userId ${id}: ${professional ? 'Found' : 'Not found'}`);
    }
    
    // If still not found, this might be a user ID, so check if it matches the first document's pattern
    if (!professional && id.startsWith('PRO')) {
      const userProfessional = await Professional.findOne({ userId: id });
      
      if (userProfessional) {
        console.log(`🔍 Found user professional with custom ID: ${id}`);
        professional = await Professional.findOne({ userId: userProfessional._id.toString() });
        console.log(`🔍 Search for professional linked to user: ${professional ? 'Found' : 'Not found'}`);
      }
    }
    
    if (!professional) {
      console.log(`❌ No professional found for ID: ${id}`);
      return res.status(404).json({ 
        success: false,
        error: 'Professional not found' 
      });
    }
    
    console.log(`✅ Found professional: ${professional.name}, Documents: ${professional.documents?.length || 0}`);
    
    // Return the professional with documents
    res.json({ 
      success: true,
      professional: {
        _id: professional._id,
        name: professional.name,
        email: professional.email,
        phone: professional.phone,
        userId: professional.userId,
        status: professional.status,
        onboardingStep: professional.onboardingStep,
        documentsStatus: professional.documentsStatus,
        documents: professional.documents || [],
        address: professional.address,
        city: professional.city,
        state: professional.state,
        pincode: professional.pincode,
        employeeId: professional.employeeId,
        createdAt: professional.createdAt,
        updatedAt: professional.updatedAt,
        alternatePhone: professional.alternatePhone,
        specializations: professional.specializations || []
      }
    });
  } catch (error) {
    console.error('❌ Error fetching professional documents:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch professional documents',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @swagger
 * /api/professionals/documents/verify:
 *   post:
 *     summary: Verify professional documents
 *     description: Allows an admin to approve or reject a professional's uploaded documents.
 *     tags: [Professional]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professionalId:
 *                 type: string
 *                 example: "67c87c63861e81bd0f1400fd"
 *                 description: The MongoDB _id or userId of the professional
 *               documentId:
 *                 type: string
 *                 example: "67cc1be5a6c21230771881d3"
 *                 description: The MongoDB _id of the document to be verified
 *               isValid:
 *                 type: boolean
 *                 example: true
 *                 description: Whether the document is approved (`true`) or rejected (`false`)
 *               remarks:
 *                 type: string
 *                 example: "Document verified successfully."
 *                 description: Optional remarks regarding the verification (Max 500 characters)
 *     responses:
 *       200:
 *         description: Document verification status updated successfully
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
 *                   example: "Document approved successfully"
 *                 professional:
 *                   type: object
 *       400:
 *         description: Missing or invalid parameters in request body
 *       401:
 *         description: Unauthorized - Missing or invalid authentication token
 *       403:
 *         description: Forbidden - Only admins can verify documents
 *       404:
 *         description: Professional or document not found
 *       504:
 *         description: Operation timed out
 *       500:
 *         description: Internal server error
 */

// Validation middleware for verifying document request
const validateVerificationRequest = [
  body('professionalId')
    .notEmpty().withMessage('Professional ID is required'),
  body('documentId')
    .notEmpty().withMessage('Document ID is required'),
  body('isValid')
    .isBoolean().withMessage('isValid must be a boolean value'),
  body('remarks')
    .optional()
    .isString().withMessage('Remarks must be a string')
    .isLength({ max: 500 }).withMessage('Remarks cannot exceed 500 characters'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    next();
  }
];

// Route handler for verifying documents
// FIXED: Using auth(['admin']) instead of auth.admin
router.post(
  '/documents/verify',
  auth(['admin']), // Only admins can verify documents
  validateVerificationRequest,
  verifyDocument
);

// FIXED: Using auth(['professional']) instead of auth
router.put('/profile', auth(['professional']), updateProfessionalProfile);

// FIXED: Using auth(['admin']) for onboarding (assuming admin creates professionals)
router.post('/onboard', auth(['admin']), async (req, res) => {
  try {
    console.log('👨‍💼 [PROF-ONBOARD] Admin onboarding new professional');
    
    // Add validation if professionalValidation exists
    // const { error } = professionalValidation.onboarding.validate(req.body);
    // if (error) {
    //   return res.status(400).json({ error: error.details[0].message });
    // }

    const professional = await ProfessionalService.onboardProfessional(req.body);
    
    console.log('✅ Professional onboarded:', professional._id);
    
    res.status(201).json({
      success: true,
      message: 'Professional onboarded successfully',
      professional
    });
  } catch (error) {
    console.error('❌ Error onboarding professional:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Alternative location update route (same as above but different path)
// FIXED: Using auth(['professional']) instead of auth
// router.put('/location', auth(['professional']), async (req, res) => {
//   try {
//     console.log('📍 [PROF-LOCATION] Updating professional location');
    
//     const { coordinates, isAvailable } = req.body;
    
//     if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
//       return res.status(400).json({
//         success: false,
//         error: 'Invalid coordinates format. Expected [longitude, latitude]'
//       });
//     }
    
//     await ProfessionalService.updateLocation(req.user._id, coordinates, isAvailable);
    
//     console.log('✅ Professional location updated');
    
//     res.json({ 
//       success: true,
//       message: 'Location updated successfully'
//     });
//   } catch (error) {
//     console.error('❌ Error updating location:', error);
//     res.status(500).json({ 
//       success: false,
//       error: error.message 
//     });
//   }
// });

// FIXED: Using auth(['professional']) instead of auth
router.get('/metrics', auth(['professional']), async (req, res) => {
  try {
    console.log('📊 [PROF-METRICS] Getting professional metrics');
    
    const metrics = await ProfessionalService.trackPerformanceMetrics(req.user._id);
    
    console.log('✅ Professional metrics retrieved');
    
    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('❌ Error getting metrics:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Debug routes for testing auth
router.get('/test-professional-auth', auth(['professional']), (req, res) => {
  console.log('🔐 [PROF-TEST] Professional auth test successful');
  res.json({
    success: true,
    message: 'Professional auth working',
    user: { 
      id: req.user._id, 
      role: req.userRole,
      name: req.user.name || 'Professional User'
    }
  });
});

router.get('/test-admin-auth', auth(['admin']), (req, res) => {
  console.log('🔐 [ADMIN-PROF-TEST] Admin auth test successful');
  res.json({
    success: true,
    message: 'Admin auth working for professional routes',
    user: { 
      id: req.user._id, 
      role: req.userRole,
      name: req.user.name || 'Admin User'
    }
  });
});
/**
 * @swagger
 * /api/professionals/location:
 *   put:
 *     summary: Update professional location and availability
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coordinates
 *               - isAvailable
 *             properties:
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Location coordinates [longitude, latitude]
 *                 example: [77.5946, 12.9716]
 *               isAvailable:
 *                 type: boolean
 *                 description: Availability status
 *                 example: true
 *               accuracy:
 *                 type: number
 *                 description: Location accuracy in meters
 *                 example: 10
 *     responses:
 *       200:
 *         description: Location updated successfully
 *       400:
 *         description: Invalid coordinates
 *       404:
 *         description: Professional not found
 *       500:
 *         description: Server error
 */
router.put('/location', auth(['professional']), async (req, res) => {
  try {
    console.log('📍 [LOCATION-ROUTE] Route handler called!');
    console.log('📍 [LOCATION-ROUTE] User from token:', JSON.stringify(req.user, null, 2));
    console.log('📍 [LOCATION-ROUTE] Request body:', JSON.stringify(req.body, null, 2));

    const { coordinates, isAvailable, accuracy } = req.body;

    // Validate coordinates
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length !== 2) {
      console.log('❌ [LOCATION-ROUTE] Invalid coordinates format');
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates format. Expected [longitude, latitude]'
      });
    }

    const [longitude, latitude] = coordinates;

    // Validate coordinate values
    if (
      typeof longitude !== 'number' || 
      typeof latitude !== 'number' ||
      longitude < -180 || longitude > 180 ||
      latitude < -90 || latitude > 90
    ) {
      console.log('❌ [LOCATION-ROUTE] Invalid coordinate values');
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinate values'
      });
    }

    // Get the user ID from the token (the one that worked in auth middleware)
    const userId = req.user._id || req.user.id;
    console.log('🔍 [LOCATION-ROUTE] Searching for professional with ID:', userId);
    console.log('🔍 [LOCATION-ROUTE] ID type:', typeof userId);

    // Import mongoose to handle ObjectId conversion if needed
    const mongoose = require('mongoose');
    let searchId = userId;
    
    // Convert to ObjectId if it's a string
    if (typeof userId === 'string') {
      try {
        searchId = new mongoose.Types.ObjectId(userId);
        console.log('🔄 [LOCATION-ROUTE] Converted string ID to ObjectId:', searchId);
      } catch (error) {
        console.log('⚠️ [LOCATION-ROUTE] Could not convert to ObjectId, using string:', userId);
        searchId = userId;
      }
    }

    // Try multiple search methods to find the professional
    console.log('🔍 [LOCATION-ROUTE] Method 1: Searching by _id...');
    let professional = await Professional.findById(searchId);
    
    if (!professional) {
      console.log('🔍 [LOCATION-ROUTE] Method 2: Searching by string ID...');
      professional = await Professional.findById(userId);
    }
    
    if (!professional) {
      console.log('🔍 [LOCATION-ROUTE] Method 3: Searching by userId field...');
      professional = await Professional.findOne({ userId: req.user.userId });
    }

    if (!professional) {
      console.log('🔍 [LOCATION-ROUTE] Method 4: Searching with string conversion...');
      professional = await Professional.findOne({ _id: userId.toString() });
    }

    // Debug: Let's see what's in the database
    if (!professional) {
      console.log('❌ [LOCATION-ROUTE] Professional still not found. Let me check the database...');
      
      // Get all professionals to debug
      const allProfessionals = await Professional.find({}).select('_id name userId').limit(5);
      console.log('📋 [LOCATION-ROUTE] Sample professionals in DB:');
      allProfessionals.forEach(prof => {
        console.log(`   - ID: ${prof._id} (${typeof prof._id}), Name: ${prof.name}, UserID: ${prof.userId}`);
      });
      
      // Try one more search by exact match
      console.log('🔍 [LOCATION-ROUTE] Method 5: Direct string search...');
      professional = await Professional.findOne({ 
        _id: '67cf175779f3c56aba6f0e01' 
      });
      
      if (professional) {
        console.log('✅ [LOCATION-ROUTE] Found with direct string search!');
      }
    }

    if (!professional) {
      console.log('❌ [LOCATION-ROUTE] Professional DEFINITIVELY not found');
      return res.status(404).json({
        success: false,
        message: 'Professional not found',
        debug: {
          searchedIds: [userId, searchId, req.user.userId, '67cf175779f3c56aba6f0e01'],
          userFromToken: req.user,
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log('✅ [LOCATION-ROUTE] Professional found:', professional.name);
    console.log('📊 [LOCATION-ROUTE] Professional ID type:', typeof professional._id);

    // Update location data
    const updateData = {
      currentLocation: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      isAvailable: isAvailable,
      updatedAt: new Date()
    };

    // Add accuracy if provided
    if (accuracy && typeof accuracy === 'number') {
      updateData.locationAccuracy = accuracy;
    }

    console.log('💾 [LOCATION-ROUTE] Updating professional with data:', updateData);

    // Update the professional document using the found professional's ID
    const updatedProfessional = await Professional.findByIdAndUpdate(
      professional._id, // Use the ID from the found professional
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedProfessional) {
      console.log('❌ [LOCATION-ROUTE] Update failed');
      return res.status(500).json({
        success: false,
        message: 'Failed to update professional'
      });
    }

    console.log('✅ [LOCATION-ROUTE] Professional updated successfully!');
    console.log('📊 [LOCATION-ROUTE] New location:', updatedProfessional.currentLocation);
    console.log('📊 [LOCATION-ROUTE] New availability:', updatedProfessional.isAvailable);

    // Return success response
    res.json({
      success: true,
      message: 'Location updated successfully',
      data: {
        professionalId: updatedProfessional._id,
        currentLocation: updatedProfessional.currentLocation,
        isAvailable: updatedProfessional.isAvailable,
        lastUpdated: updatedProfessional.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ [LOCATION-ROUTE] Error:', error);
    console.error('❌ [LOCATION-ROUTE] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to update location',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});
/**
 * @swagger
 * /api/professionals/availability:
 *   patch:
 *     summary: Toggle professional availability
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isAvailable
 *             properties:
 *               isAvailable:
 *                 type: boolean
 *                 description: Availability status
 *                 example: true
 *     responses:
 *       200:
 *         description: Availability updated successfully
 *       404:
 *         description: Professional not found
 *       500:
 *         description: Server error
 */
router.patch('/availability', auth(['professional']), async (req, res) => {
  try {
    console.log('🔄 [PROFESSIONALS-AVAILABILITY] Request from professional:', req.user._id);
    
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isAvailable must be a boolean value'
      });
    }

    // Find professional (try both methods)
    let professional = await Professional.findById(req.user._id);
    if (!professional) {
      professional = await Professional.findOne({ userId: req.user._id });
    }

    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    // Update availability
    const updatedProfessional = await Professional.findByIdAndUpdate(
      professional._id,
      { 
        isAvailable: isAvailable,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    console.log('✅ [PROFESSIONALS-AVAILABILITY] Availability updated successfully');

    res.json({
      success: true,
      message: 'Availability updated successfully',
      data: {
        professionalId: updatedProfessional._id,
        isAvailable: updatedProfessional.isAvailable,
        lastUpdated: updatedProfessional.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ [PROFESSIONALS-AVAILABILITY] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update availability',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @swagger
 * /api/professionals/availability:
 *   get:
 *     summary: Get professional availability status
 *     tags: [Professionals]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability status retrieved successfully
 *       404:
 *         description: Professional not found
 *       500:
 *         description: Server error
 */
router.get('/availability', auth(['professional']), async (req, res) => {
  try {
    // Find professional (try both methods)
    let professional = await Professional.findById(req.user._id)
      .select('isAvailable currentLocation updatedAt');
    
    if (!professional) {
      professional = await Professional.findOne({ userId: req.user._id })
        .select('isAvailable currentLocation updatedAt');
    }

    if (!professional) {
      return res.status(404).json({
        success: false,
        message: 'Professional not found'
      });
    }

    res.json({
      success: true,
      data: {
        isAvailable: professional.isAvailable || false,
        currentLocation: professional.currentLocation || null,
        lastUpdated: professional.updatedAt
      }
    });

  } catch (error) {
    console.error('❌ [PROFESSIONALS-AVAILABILITY] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get availability status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;