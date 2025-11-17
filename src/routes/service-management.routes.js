const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth.middleware');
const adminServiceController = require('../controllers/admin-service.controller');

// ✅ Create uploads directory if it doesn't exist
const uploadDir = 'uploads/services';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'service-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: fileFilter
});

/**
 * @swagger
 * tags:
 *   name: Admin Service Templates
 *   description: Admin endpoints for managing service templates
 */

/**
 * @swagger
 * /api/admin/templates:
 *   post:
 *     summary: Create a new service template
 *     tags: [Admin Service Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               pricing:
 *                 type: object
 *               serviceDetails:
 *                 type: array
 *               customizationOptions:
 *                 type: array
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Service template created successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/templates',
  auth(['admin']),
  upload.single('image'),
  adminServiceController.createServiceTemplate
);

/**
 * @swagger
 * /api/admin/templates:
 *   get:
 *     summary: List all service templates
 *     tags: [Admin Service Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, inactive]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of service templates
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/templates',
  auth(['admin']),
  adminServiceController.listServiceTemplates
);

/**
 * @swagger
 * /api/admin/templates/{id}:
 *   get:
 *     summary: Get a single service template by ID
 *     tags: [Admin Service Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service template details
 *       404:
 *         description: Service template not found
 */
router.get(
  '/templates/:id',
  auth(['admin']),
  adminServiceController.getServiceTemplate
);

/**
 * @swagger
 * /api/admin/templates/{id}:
 *   put:
 *     summary: Update a service template
 *     tags: [Admin Service Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               image:
 *                 type: string
 *                 format: binary
 *               pricing:
 *                 type: object
 *               serviceDetails:
 *                 type: array
 *               customizationOptions:
 *                 type: array
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Service template updated successfully
 *       404:
 *         description: Service template not found
 */
router.put(
  '/templates/:id',
  auth(['admin']),
  upload.single('image'),
  adminServiceController.updateServiceTemplate
);

/**
 * @swagger
 * /api/admin/templates/{id}:
 *   delete:
 *     summary: Delete a service template
 *     tags: [Admin Service Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service template deleted successfully
 *       404:
 *         description: Service template not found
 */
router.delete(
  '/templates/:id',
  auth(['admin']),
  adminServiceController.deleteServiceTemplate
);

/**
 * @swagger
 * /api/admin/templates/{id}/status:
 *   patch:
 *     summary: Update service template status (active/inactive)
 *     tags: [Admin Service Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - isActive
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Service template status updated
 *       404:
 *         description: Service template not found
 */
router.patch(
  '/templates/:id/status',
  auth(['admin']),
  adminServiceController.updateServiceStatus
);

module.exports = router;