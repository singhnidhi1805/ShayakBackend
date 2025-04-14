const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const AdminServiceController = require('../controllers/admin-service.controller');
const ProfessionalServiceController = require('../controllers/professional-service.controller');

/**
 * @swagger
 * tags:
 *   name: AdminServiceTemplates
 *   description: Routes for managing service templates by admins
 */

/**
 * @swagger
 * /api/admin/templates:
 *   post:
 *     summary: Create a new service template
 *     tags: [AdminServiceTemplates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the service template
 *               description:
 *                 type: string
 *                 description: Detailed description of the service template
 *               price:
 *                 type: number
 *                 description: Default price of the service template
 *     responses:
 *       201:
 *         description: Service template created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */
router.post('/admin/templates', 
  auth.admin, 
  AdminServiceController.createServiceTemplate
);

/**
 * @swagger
 * /api/admin/templates/{id}:
 *   put:
 *     summary: Update an existing service template
 *     tags: [AdminServiceTemplates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the service template to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Service template updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Service template not found
 */
router.put('/admin/templates/:id', 
  auth.admin, 
  AdminServiceController.updateServiceTemplate
);

/**
 * @swagger
 * /api/admin/templates:
 *   get:
 *     summary: List all service templates
 *     tags: [AdminServiceTemplates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of service templates
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   price:
 *                     type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/templates', 
  auth.admin, 
  AdminServiceController.listServiceTemplates
);

/**
 * @swagger
 * tags:
 *   name: ProfessionalServices
 *   description: Routes for managing custom services by professionals
 */

/**
 * @swagger
 * /api/professional/services:
 *   post:
 *     summary: Create a custom service
 *     tags: [ProfessionalServices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the custom service
 *               category:
 *                 type: string
 *                 description: The category of the custom service (must match professional specialization)
 *               description:
 *                 type: string
 *                 description: Detailed description of the service
 *               pricing:
 *                 type: object
 *                 description: Pricing details for the custom service
 *                 required:
 *                   - basePrice
 *                 properties:
 *                   basePrice:
 *                     type: number
 *                     description: Base price of the service
 *               serviceDetails:
 *                 type: object
 *                 description: Additional details about the service
 *               customizationOptions:
 *                 type: object
 *                 description: Customization options for the service
 *     responses:
 *       201:
 *         description: Custom service created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 */


router.post('/professional/services', 
  auth.professional, 
  ProfessionalServiceController.createCustomService
);

/**
 * @swagger
 * /api/professional/services/{id}:
 *   put:
 *     summary: Update an existing custom service
 *     tags: [ProfessionalServices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the custom service to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Custom service updated successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Custom service not found
 */
router.put('/professional/services/:id', 
  auth.professional, 
  ProfessionalServiceController.updateCustomService
);

/**
 * @swagger
 * /api/professional/services:
 *   get:
 *     summary: List all custom services for a professional
 *     tags: [ProfessionalServices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of custom services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   price:
 *                     type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/professional/services', 
  auth.professional, 
  ProfessionalServiceController.listProfessionalServices
);

module.exports = router;
