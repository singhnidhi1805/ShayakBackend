const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const ProfessionalLocationController = require('../controllers/professional-location.controller');

/**
 * @swagger
 * /api/professional/location:
 *   post:
 *     summary: Update professional's current location
 *     tags: [Professional Location]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 description: Latitude of current location
 *                 example: 12.9716
 *               longitude:
 *                 type: number
 *                 description: Longitude of current location
 *                 example: 77.5946
 *               accuracy:
 *                 type: number
 *                 description: Accuracy of location in meters
 *                 example: 10
 *               heading:
 *                 type: number
 *                 description: Heading in degrees
 *                 example: 90
 *               speed:
 *                 type: number
 *                 description: Speed in meters per second
 *                 example: 5
 *               isAvailable:
 *                 type: boolean
 *                 description: Whether professional is available for new jobs
 *                 example: true
 *     responses:
 *       200:
 *         description: Location updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Location updated successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentLocation:
 *                       type: object
 *                       properties:
 *                         location:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               example: Point
 *                             coordinates:
 *                               type: array
 *                               items:
 *                                 type: number
 *                               example: [77.5946, 12.9716]
 *                         accuracy:
 *                           type: number
 *                           example: 10
 *                         heading:
 *                           type: number
 *                           example: 90
 *                         speed:
 *                           type: number
 *                           example: 5
 *                     isOnline:
 *                       type: boolean
 *                       example: true
 *                     lastLocationUpdate:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-01-21T14:45:00.000Z
 *       400:
 *         description: Invalid input or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid coordinates
 *                 message:
 *                   type: string
 *                   example: Latitude must be between -90 and 90, longitude between -180 and 180
 *       404:
 *         description: Professional not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Professional not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to update location
 */

/**
 * @swagger
 * /api/professional/nearby:
 *   get:
 *     summary: Get nearby available professionals
 *     tags: [Professional Location]
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           description: Search radius in meters
 *           default: 5000
 *       - in: query
 *         name: specializations
 *         schema:
 *           type: string
 *           description: Comma-separated list of specializations
 *     responses:
 *       200:
 *         description: List of nearby professionals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Nearby professionals retrieved successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     professionals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: 64b1f1f2e12345678abcd123
 *                           name:
 *                             type: string
 *                             example: John Doe
 *                           specializations:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["electrician", "plumber"]
 *                           location:
 *                             type: object
 *                             properties:
 *                               location:
 *                                 type: object
 *                                 properties:
 *                                   type:
 *                                     type: string
 *                                     example: Point
 *                                   coordinates:
 *                                     type: array
 *                                     items:
 *                                       type: number
 *                                     example: [77.5946, 12.9716]
 *                           distance:
 *                             type: number
 *                             example: 4.5
 *                           rating:
 *                             type: number
 *                             example: 4.8
 *       400:
 *         description: Missing or invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Missing coordinates
 *                 message:
 *                   type: string
 *                   example: Latitude and longitude are required
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to fetch nearby professionals
 */

router.post('/location', 
  auth.professional,
  ProfessionalLocationController.updateLocation
);

router.get('/nearby',
  ProfessionalLocationController.getNearbyProfessionals
);

module.exports = router;
