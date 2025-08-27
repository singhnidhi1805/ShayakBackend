// routes/tracking.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const TrackingController = require('../controllers/tracking.controller');

/**
 * @swagger
 * tags:
 *   name: Tracking
 *   description: Real-time tracking for bookings
 */

/**
 * @swagger
 * /api/tracking/{bookingId}/location:
 *   post:
 *     summary: Update professional's real-time location during booking
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the active booking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coordinates
 *             properties:
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Current location coordinates [longitude, latitude]
 *                 example: [77.5946, 12.9716]
 *               heading:
 *                 type: number
 *                 description: Direction of movement in degrees (0-360)
 *                 example: 45
 *               speed:
 *                 type: number
 *                 description: Current speed in meters per second
 *                 example: 5.5
 *               accuracy:
 *                 type: number
 *                 description: Location accuracy in meters
 *                 example: 10
 *     responses:
 *       200:
 *         description: Location updated successfully
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
 *                   example: "Location updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                     eta:
 *                       type: number
 *                       description: Estimated time of arrival in minutes
 *                     distance:
 *                       type: number
 *                       description: Distance to destination in kilometers
 *                     coordinates:
 *                       type: array
 *                       items:
 *                         type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid coordinates or booking status
 *       403:
 *         description: Not authorized for this booking
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/location', 
  auth(['professional']), 
  TrackingController.updateProfessionalLocation.bind(TrackingController)
);

/**
 * @swagger
 * /api/tracking/{bookingId}:
 *   get:
 *     summary: Get current tracking information for a booking
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking
 *     responses:
 *       200:
 *         description: Tracking information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "in_progress"
 *                     professional:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         currentLocation:
 *                           type: object
 *                           properties:
 *                             coordinates:
 *                               type: array
 *                               items:
 *                                 type: number
 *                     realTimeTracking:
 *                       type: object
 *                       properties:
 *                         professionalLocation:
 *                           type: object
 *                           properties:
 *                             coordinates:
 *                               type: array
 *                               items:
 *                                 type: number
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *                         distance:
 *                           type: number
 *                         eta:
 *                           type: number
 *                         isMoving:
 *                           type: boolean
 *       403:
 *         description: Not authorized to view this booking
 *       404:
 *         description: Booking not found
 */
router.get('/:bookingId', 
  auth(), 
  TrackingController.getTrackingInfo.bind(TrackingController)
);

/**
 * @swagger
 * /api/tracking/{bookingId}/start:
 *   post:
 *     summary: Start tracking when professional accepts booking
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to start tracking
 *     responses:
 *       200:
 *         description: Tracking started successfully
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
 *                   example: "Tracking started successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                     trackingStarted:
 *                       type: boolean
 *                       example: true
 *                     initialETA:
 *                       type: number
 *       400:
 *         description: Booking not in correct status
 *       403:
 *         description: Not authorized for this booking
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/start', 
  auth(['professional']), 
  TrackingController.startTracking.bind(TrackingController)
);

/**
 * @swagger
 * /api/tracking/{bookingId}/stop:
 *   post:
 *     summary: Stop tracking when service is completed
 *     tags: [Tracking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to stop tracking
 *     responses:
 *       200:
 *         description: Tracking stopped successfully
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
 *                   example: "Tracking stopped successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     bookingId:
 *                       type: string
 *                     trackingEnded:
 *                       type: boolean
 *                       example: true
 *       403:
 *         description: Not authorized for this booking
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/stop', 
  auth(['professional']), 
  TrackingController.stopTracking.bind(TrackingController)
);

module.exports = router;