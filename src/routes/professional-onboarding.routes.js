const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth.middleware');
const validation = require('../middleware/validation');
const ProfessionalOnboardingController = require('../controllers/professional-onboarding.controller');
const professionalValidation = require('../middleware/professional-validation');

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Add file type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'), false);
    }
  }
});

/**
 * @swagger
 * tags:
 *   name: Professional Onboarding
 *   description: Endpoints for professional onboarding and document management
 */

/**
 * @swagger
 * /api/professionals/onboarding/init:
 *   post:
 *     summary: Initialize professional onboarding
 *     tags: [Professional Onboarding]
 *     security:
 *        - bearerAuth: []
 *     requestBody:
 *       description: Request body for onboarding initialization
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: professional@example.com
 *               name:
 *                 type: string
 *                 example: John Doe
 *             required:
 *               - email
 *               - name
 *     responses:
 *       200:
 *         description: Onboarding initialized successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 */

/**
 * @swagger
 * /api/professionals/onboarding/progress:
 *   post:
 *     summary: Save onboarding progress
 *     tags: [Professional Onboarding]
 *     security:
 *        - bearerAuth: []
 *     requestBody:
 *       description: Request body for saving onboarding progress
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               step:
 *                 type: string
 *                 enum: [welcome, personal_details, specializations, documents]
 *                 example: personal_details
 *               data:
 *                 type: object
 *                 example: {
 *                   "name": "John Doe",
 *                   "email": "john@example.com",
 *                   "address": "123 Main St"
 *                 }
 *             required:
 *               - step
 *               - data
 *     responses:
 *       200:
 *         description: Progress saved successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 */

/**
 * @swagger
 * /api/professionals/documents/upload:
 *   post:
 *     summary: Upload document for verification
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - document
 *               - documentType
 *             properties:
 *               document:
 *                 type: string
 *                 format: binary
 *               documentType:
 *                 type: string
 *                 enum: [id_proof, address_proof, professional_certificate]
 *                 description: Type of document being uploaded
 *     responses:
 *       200:
 *         description: Document uploaded successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 *       413:
 *         description: File size too large
 */

/**
 * @swagger
 * /api/professionals/documents/verify:
 *   post:
 *     summary: Verify uploaded document (Admin only)
 *     tags: [Professional Onboarding]
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
 *                 example: 63c9fe8e4f1a4e0012b4b00f
 *               documentId:
 *                 type: string
 *                 example: 63c9fe8e4f1a4e0012b4b010
 *               isValid:
 *                 type: boolean
 *                 example: true
 *               remarks:
 *                 type: string
 *                 example: Document is valid.
 *             required:
 *               - professionalId
 *               - documentId
 *               - isValid
 *     responses:
 *       200:
 *         description: Document verification status updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 */

/**
 * @swagger
 * /api/professionals/onboarding/status:
 *   get:
 *     summary: Get onboarding status and saved progress
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 */

/**
 * @swagger
 * /api/professionals/onboarding/complete:
 *   post:
 *     summary: Complete onboarding process
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 *       400:
 *         description: Onboarding requirements not met
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 */

// Initialize onboarding process
// FIXED: Using auth(['professional']) instead of auth.professional
router.post(
  '/onboarding/init',
  auth(['professional']),
  professionalValidation.initiate,
  ProfessionalOnboardingController.initiateOnboarding
);

// Save onboarding progress
// FIXED: Using auth(['professional']) instead of auth.professional
router.post(
  '/onboarding/progress',
  auth(['professional']),
  ProfessionalOnboardingController.saveOnboardingProgress
);

// Upload document with error handling
// FIXED: Using auth(['professional']) instead of auth.professional
router.post(
  '/documents/upload',
  auth(['professional']),
  (req, res, next) => {
    upload.single('document')(req, res, (err) => {
      if (err) {
        console.error('📁 [UPLOAD] File upload error:', err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: 'File size too large',
            message: 'Maximum file size is 5MB'
          });
        }
        return res.status(400).json({
          success: false,
          error: 'File upload failed',
          message: err.message
        });
      }
      next();
    });
  },
  ProfessionalOnboardingController.uploadDocument
);

// Verify document (admin only)
// FIXED: Using auth(['admin']) instead of auth.admin
router.post(
  '/documents/verify',
  auth(['admin']),
  professionalValidation.verifyDocument,
  ProfessionalOnboardingController.verifyDocument
);

// Get onboarding status
// FIXED: Using auth(['professional']) instead of auth.professional
router.get(
  '/onboarding/status',
  auth(['professional']),
  ProfessionalOnboardingController.getOnboardingStatus
);

// Complete onboarding process - NEW ROUTE
router.post(
  '/onboarding/complete',
  auth(['professional']),
  ProfessionalOnboardingController.completeOnboarding
);

// Get document list for professional
router.get(
  '/documents',
  auth(['professional']),
  ProfessionalOnboardingController.getDocuments
);

// Delete uploaded document
router.delete(
  '/documents/:documentId',
  auth(['professional']),
  ProfessionalOnboardingController.deleteDocument
);

// Admin routes for managing professionals
router.get(
  '/admin/pending',
  auth(['admin']),
  ProfessionalOnboardingController.getPendingProfessionals
);

router.post(
  '/admin/approve/:professionalId',
  auth(['admin']),
  ProfessionalOnboardingController.approveProfessional
);

router.post(
  '/admin/reject/:professionalId',
  auth(['admin']),
  ProfessionalOnboardingController.rejectProfessional
);

// Debug routes for testing auth
router.get('/test-professional-auth', auth(['professional']), (req, res) => {
  console.log('🔐 [PROF-ONBOARD-TEST] Professional auth test successful');
  res.json({
    success: true,
    message: 'Professional onboarding auth working',
    user: { 
      id: req.user._id, 
      role: req.userRole,
      name: req.user.name || 'Professional User'
    }
  });
});

router.get('/test-admin-auth', auth(['admin']), (req, res) => {
  console.log('🔐 [ADMIN-ONBOARD-TEST] Admin auth test successful');
  res.json({
    success: true,
    message: 'Admin onboarding auth working',
    user: { 
      id: req.user._id, 
      role: req.userRole,
      name: req.user.name || 'Admin User'
    }
  });
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('📁 [MULTER] Error:', error.message);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error: 'File size too large',
        message: 'Maximum file size is 5MB'
      });
    }
    return res.status(400).json({
      success: false,
      error: 'File upload error',
      message: error.message
    });
  }
  next(error);
});

module.exports = router;
