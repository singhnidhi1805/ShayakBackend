const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth.middleware');
const validation = require('../middleware/validation');
const ProfessionalOnboardingController = require('../controllers/professional-onboarding.controller');
const professionalValidation = require('../middleware/professional-validation');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
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
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Professional:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: 63c9fe8e4f1a4e0012b4b00f
 *         name:
 *           type: string
 *           example: John Doe
 *         email:
 *           type: string
 *           example: professional@example.com
 *         phone:
 *           type: string
 *           example: '+1234567890'
 *         status:
 *           type: string
 *           enum: [registration_pending, document_pending, under_review, rejected, verified, suspended, inactive]
 *           example: verified
 *         onboardingStep:
 *           type: string
 *           enum: [welcome, personal_details, specializations, documents, completed]
 *           example: completed
 *         employeeId:
 *           type: string
 *           example: PRO240001
 *     Document:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 63c9fe8e4f1a4e0012b4b010
 *         type:
 *           type: string
 *           enum: [id_proof, address_proof, professional_certificate]
 *           example: id_proof
 *         s3Key:
 *           type: string
 *           example: documents/63c9fe8e4f1a4e0012b4b00f/id_proof_1234567890
 *         fileName:
 *           type: string
 *           example: passport.jpg
 *         mimeType:
 *           type: string
 *           example: image/jpeg
 *         fileSize:
 *           type: number
 *           example: 1024000
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           example: approved
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *         verifiedAt:
 *           type: string
 *           format: date-time
 *         remarks:
 *           type: string
 *           example: Document verified successfully
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: Error message
 *         details:
 *           type: string
 *           example: Detailed error information
 */

/**
 * @swagger
 * /api/professionals/onboarding/init:
 *   post:
 *     summary: Initialize professional onboarding
 *     description: Start the onboarding process for a new professional
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
 *                 format: email
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
 *                   example: Onboarding initialized successfully
 *                 professional:
 *                   $ref: '#/components/schemas/Professional'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 */
router.post(
  '/onboarding/init',
  auth(['professional']),
  professionalValidation.initiate,
  ProfessionalOnboardingController.initiateOnboarding
);

/**
 * @swagger
 * /api/professionals/onboarding/progress:
 *   post:
 *     summary: Save onboarding progress
 *     description: Save progress for a specific onboarding step
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
 *                 enum: [personal_details, specializations, documents]
 *                 example: personal_details
 *               data:
 *                 type: object
 *                 example: {
 *                   "name": "John Doe",
 *                   "email": "john@example.com",
 *                   "address": "123 Main St",
 *                   "city": "New York",
 *                   "state": "NY",
 *                   "pincode": "10001"
 *                 }
 *             required:
 *               - step
 *               - data
 *     responses:
 *       200:
 *         description: Progress saved successfully
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
 *                   example: Progress saved successfully
 *                 professional:
 *                   $ref: '#/components/schemas/Professional'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 */
router.post(
  '/onboarding/progress',
  auth(['professional']),
  ProfessionalOnboardingController.saveOnboardingProgress
);

/**
 * @swagger
 * /api/professionals/documents/upload:
 *   post:
 *     summary: Upload document for verification
 *     description: Upload a document (ID proof, address proof, or professional certificate) to S3. The file is stored securely and accessible via pre-signed URLs.
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
 *                 description: File to upload (JPEG, PNG, or PDF - max 5MB)
 *               documentType:
 *                 type: string
 *                 enum: [id_proof, address_proof, professional_certificate]
 *                 description: Type of document being uploaded
 *     responses:
 *       200:
 *         description: Document uploaded successfully
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
 *                   example: Document uploaded successfully
 *                 documentId:
 *                   type: string
 *                   example: 63c9fe8e4f1a4e0012b4b010
 *                 status:
 *                   type: string
 *                   example: pending
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 *       413:
 *         description: File size too large (max 5MB)
 */
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

/**
 * @swagger
 * /api/professionals/documents/verify:
 *   post:
 *     summary: Verify uploaded document (Admin only)
 *     description: Approve or reject a professional's uploaded document
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
 *                 description: ID of the professional
 *               documentId:
 *                 type: string
 *                 example: 63c9fe8e4f1a4e0012b4b010
 *                 description: ID of the document to verify
 *               isValid:
 *                 type: boolean
 *                 example: true
 *                 description: True to approve, false to reject
 *               remarks:
 *                 type: string
 *                 example: Document is valid and verified
 *                 description: Optional remarks or feedback
 *             required:
 *               - professionalId
 *               - documentId
 *               - isValid
 *     responses:
 *       200:
 *         description: Document verification status updated
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
 *                   example: Document approved successfully
 *                 professional:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
 *                     documentsStatus:
 *                       type: object
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 *       404:
 *         description: Professional or document not found
 */
router.post(
  '/documents/verify',
  auth(['admin']),
  professionalValidation.verifyDocument,
  ProfessionalOnboardingController.verifyDocument
);

/**
 * @swagger
 * /api/professionals/onboarding/status:
 *   get:
 *     summary: Get onboarding status and saved progress
 *     description: Retrieve the current onboarding status and progress for the authenticated professional
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 onboardingStatus:
 *                   type: object
 *                   properties:
 *                     currentStatus:
 *                       type: string
 *                       example: verified
 *                     onboardingStep:
 *                       type: string
 *                       example: completed
 *                     employeeId:
 *                       type: string
 *                       example: PRO240001
 *                     progress:
 *                       type: object
 *                     missingDocuments:
 *                       type: array
 *                       items:
 *                         type: string
 *                     documentStatus:
 *                       type: object
 *                     isComplete:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 *       404:
 *         description: Professional not found
 */
router.get(
  '/onboarding/status',
  auth(['professional']),
  ProfessionalOnboardingController.getOnboardingStatus
);

/**
 * @swagger
 * /api/professionals/onboarding/complete:
 *   post:
 *     summary: Complete onboarding process
 *     description: Mark the onboarding process as complete
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
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
 *                   example: Onboarding completed successfully
 *                 professional:
 *                   type: object
 *       400:
 *         description: Onboarding requirements not met
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Professional role required
 */
router.post(
  '/onboarding/complete',
  auth(['professional']),
  ProfessionalOnboardingController.completeOnboarding
);

/**
 * @swagger
 * /api/professionals/documents:
 *   get:
 *     summary: Get document list for professional
 *     description: Retrieve all documents for the authenticated professional with pre-signed URLs (valid for 1 hour)
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 documents:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Document'
 *                       - type: object
 *                         properties:
 *                           fileUrl:
 *                             type: string
 *                             description: Pre-signed URL (valid for 1 hour)
 *                             example: https://bucket.s3.region.amazonaws.com/path?signature=xyz
 *                 professional:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied
 *       404:
 *         description: Professional not found
 */
router.get(
  '/documents',
  auth(['professional']),
  ProfessionalOnboardingController.getDocuments
);

/**
 * @swagger
 * /api/professionals/documents/{documentId}:
 *   delete:
 *     summary: Delete uploaded document
 *     description: Delete a document from S3 and database
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the document to delete
 *         example: 63c9fe8e4f1a4e0012b4b010
 *     responses:
 *       200:
 *         description: Document deleted successfully
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
 *                   example: Document deleted successfully
 *                 documentId:
 *                   type: string
 *                   example: 63c9fe8e4f1a4e0012b4b010
 *       400:
 *         description: Invalid document ID
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Document not found
 */
router.delete(
  '/documents/:documentId',
  auth(['professional']),
  ProfessionalOnboardingController.deleteDocument
);

/**
 * @swagger
 * /api/professionals/admin/pending:
 *   get:
 *     summary: Get pending professionals for admin review
 *     description: Retrieve a paginated list of professionals pending verification
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Pending professionals retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 professionals:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Professional'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 */
router.get(
  '/admin/pending',
  auth(['admin']),
  ProfessionalOnboardingController.getPendingProfessionals
);

/**
 * @swagger
 * /api/professionals/admin/approve/{professionalId}:
 *   post:
 *     summary: Approve professional
 *     description: Approve a professional and generate employee ID
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: professionalId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the professional to approve
 *         example: 63c9fe8e4f1a4e0012b4b00f
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               remarks:
 *                 type: string
 *                 example: All documents verified and approved
 *     responses:
 *       200:
 *         description: Professional approved successfully
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
 *                   example: Professional approved successfully
 *                 professional:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     status:
 *                       type: string
 *                     employeeId:
 *                       type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 *       404:
 *         description: Professional not found
 */
router.post(
  '/admin/approve/:professionalId',
  auth(['admin']),
  ProfessionalOnboardingController.approveProfessional
);

/**
 * @swagger
 * /api/professionals/admin/reject/{professionalId}:
 *   post:
 *     summary: Reject professional
 *     description: Reject a professional application with reason
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: professionalId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the professional to reject
 *         example: 63c9fe8e4f1a4e0012b4b00f
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Documents are not clear or valid
 *     responses:
 *       200:
 *         description: Professional rejected successfully
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
 *                   example: Professional rejected successfully
 *                 professional:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 *       404:
 *         description: Professional not found
 */
router.post(
  '/admin/reject/:professionalId',
  auth(['admin']),
  ProfessionalOnboardingController.rejectProfessional
);

/**
 * @swagger
 * /api/professionals/{id}/documents:
 *   get:
 *     summary: Get professional documents with pre-signed URLs (Admin only)
 *     description: Retrieve all documents for a specific professional with pre-signed URLs (valid for 1 hour)
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Professional ID
 *         example: 63c9fe8e4f1a4e0012b4b00f
 *     responses:
 *       200:
 *         description: Professional documents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 professional:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Professional'
 *                     - type: object
 *                       properties:
 *                         documents:
 *                           type: array
 *                           items:
 *                             allOf:
 *                               - $ref: '#/components/schemas/Document'
 *                               - type: object
 *                                 properties:
 *                                   fileUrl:
 *                                     type: string
 *                                     description: Pre-signed URL (valid for 1 hour)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 *       404:
 *         description: Professional not found
 */
router.get(
  '/:id/documents',
  auth(['admin']),
  ProfessionalOnboardingController.getProfessionalDocuments
);

/**
 * @swagger
 * /api/professionals/test-professional-auth:
 *   get:
 *     summary: Test professional authentication
 *     description: Debug endpoint to test professional authentication
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *                   example: Professional onboarding auth working
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
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

/**
 * @swagger
 * /api/professionals/test-admin-auth:
 *   get:
 *     summary: Test admin authentication
 *     description: Debug endpoint to test admin authentication
 *     tags: [Professional Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *                   example: Admin onboarding auth working
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Admin role required
 */
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