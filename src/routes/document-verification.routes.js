const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const verifyDocument = require('../controllers/document-verification.controller');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * tags:
 *   name: DocumentsVerify
 *   description: API for verifying professional documents
 */

/**
 * @swagger
 * /api/professionals/documents/verify:
 *   post:
 *     summary: Verify professional documents
 *     description: Allows an admin to approve or reject a professional's uploaded documents.
 *     tags: [DocumentsVerify]
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
router.post(
  '/api/professional/documents/verify',
  auth, // Only admins can verify documents
  validateVerificationRequest,
  verifyDocument
);

module.exports = router;