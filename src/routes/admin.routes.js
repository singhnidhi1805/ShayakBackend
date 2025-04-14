const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Admin Dashboard
 *   description: Endpoints for retrieving admin dashboard statistics
 */

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     description: Retrieves statistics related to professionals, services, and other dashboard metrics.
 *     tags: [Admin Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Successfully retrieved dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalProfessionals:
 *                   type: integer
 *                   example: 100
 *                 pendingVerification:
 *                   type: integer
 *                   example: 10
 *                 verified:
 *                   type: integer
 *                   example: 80
 *                 rejected:
 *                   type: integer
 *                   example: 10
 *                 totalServices:
 *                   type: integer
 *                   example: 50
 *                 activeServices:
 *                   type: integer
 *                   example: 40
 *       "500":
 *         description: Server error
 */
router.get('/dashboard/stats', auth.admin, adminController.getDashboardStats);

/**
 * @swagger
 * tags:
 *   name: Admin Profile
 *   description: Endpoints for updating admin profile
 */

/**
 * @swagger
 * /api/admin/profile:
 *   patch:
 *     summary: Update admin profile
 *     description: Allows an admin to update their profile details, including name, email, and password.
 *     tags: [Admin Profile]
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
 *                 example: "Admin User"
 *               email:
 *                 type: string
 *                 example: "admin@example.com"
 *               oldPassword:
 *                 type: string
 *                 example: "currentPassword123"
 *               newPassword:
 *                 type: string
 *                 example: "newPassword456"
 *     responses:
 *       "200":
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *       "400":
 *         description: Invalid request, e.g., incorrect password
 *       "404":
 *         description: Admin not found
 *       "500":
 *         description: Server error
 */
router.patch('/profile', auth.admin, adminController.updateProfile);

/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Endpoints for fetching and exporting report data
 */

/**
 * @swagger
 * /api/admin/reports/{reportType}:
 *   get:
 *     summary: Get report data
 *     description: Fetches report data based on type and time frame.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: reportType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [professional_onboarding, document_verification, service_usage]
 *         description: The type of report to fetch.
 *       - name: timeFrame
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           example: "month"
 *         description: The timeframe for the report.
 *     responses:
 *       "200":
 *         description: Successfully retrieved report data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                         example: "2024-03-01"
 *                       registrations:
 *                         type: integer
 *                         example: 10
 *                       completions:
 *                         type: integer
 *                         example: 5
 *                       completionRate:
 *                         type: number
 *                         example: 50
 *       "500":
 *         description: Server error
 */
router.get('/reports/:reportType', auth.admin, adminController.getReportData);

/**
 * @swagger
 * /api/admin/reports/{reportType}/export:
 *   get:
 *     summary: Export report data
 *     description: Exports the requested report data as a CSV file.
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: reportType
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [professional_onboarding, document_verification, service_usage]
 *       - name: timeFrame
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           example: "month"
 *     responses:
 *       "200":
 *         description: Successfully exported report data as CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       "500":
 *         description: Server error
 */
router.get('/reports/:reportType/export',auth.admin, adminController.exportReport);

module.exports = router;
