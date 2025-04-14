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
 *         description: Forbidden
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
 */


// Initialize onboarding process
router.post(
  '/onboarding/init',
  auth.professional,
  professionalValidation.initiate,
  ProfessionalOnboardingController.initiateOnboarding
);

// Save onboarding progress
router.post(
  '/onboarding/progress',
  auth.professional,
  ProfessionalOnboardingController.saveOnboardingProgress
);

// Upload document
router.post(
  '/documents/upload',
  auth.professional,
  upload.single('document'),
  ProfessionalOnboardingController.uploadDocument
);

// Verify document (admin only)
router.post(
  '/documents/verify',
  auth.admin,
  professionalValidation.verifyDocument,
  ProfessionalOnboardingController.verifyDocument
);

// Get onboarding status
router.get(
  '/onboarding/status',
  auth.professional,
  ProfessionalOnboardingController.getOnboardingStatus
);

module.exports = router;