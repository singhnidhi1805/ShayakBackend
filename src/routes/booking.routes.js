
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const BookingController = require('../controllers/booking.controller');

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Booking ID
 *         user:
 *           type: string
 *           description: User ID who made the booking
 *         professional:
 *           type: string
 *           description: Professional ID assigned to booking
 *         service:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *             name:
 *               type: string
 *             category:
 *               type: string
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *         location:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [Point]
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               example: [77.5946, 12.9716]
 *         status:
 *           type: string
 *           enum: [pending, accepted, in_progress, completed, cancelled]
 *         totalAmount:
 *           type: number
 *         verificationCode:
 *           type: string
 *         isEmergency:
 *           type: boolean
 *         tracking:
 *           type: object
 *           properties:
 *             startedAt:
 *               type: string
 *               format: date-time
 *             arrivedAt:
 *               type: string
 *               format: date-time
 *             eta:
 *               type: number
 *         rating:
 *           type: object
 *           properties:
 *             score:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *             review:
 *               type: string
 *             createdAt:
 *               type: string
 *               format: date-time
 *         createdAt:
 *           type: string
 *           format: date-time
 *         completedAt:
 *           type: string
 *           format: date-time
 *         cancelledAt:
 *           type: string
 *           format: date-time
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking management endpoints
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - location
 *               - scheduledDate
 *             properties:
 *               serviceId:
 *                 type: string
 *                 description: ID of the service to book
 *                 example: "67948e9065f73285ae21e621"
 *               location:
 *                 type: object
 *                 required:
 *                   - coordinates
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     description: Location coordinates [longitude, latitude]
 *                     example: [77.5946, 12.9716]
 *                   address:
 *                     type: string
 *                     description: Human readable address
 *                     example: "123 Main Street, Bangalore"
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: When the service should be performed
 *                 example: "2025-05-28T10:00:00.000Z"
 *               isEmergency:
 *                 type: boolean
 *                 description: Whether this is an emergency booking
 *                 default: false
 *     responses:
 *       201:
 *         description: Booking created successfully
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
 *                   example: "Booking created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     booking:
 *                       $ref: '#/components/schemas/Booking'
 *       400:
 *         description: Bad request - missing required fields
 *       404:
 *         description: Service not found
 *       500:
 *         description: Internal server error
 */
router.post('/', auth(), (req, res) => {
  console.log('🚀 POST /bookings - Creating new booking');
  BookingController.createBooking(req, res);
});

/**
 * @swagger
 * /api/bookings/{bookingId}/accept:
 *   post:
 *     summary: Accept a booking (Professional only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to accept
 *         example: "67948e9065f73285ae21e999"
 *     responses:
 *       200:
 *         description: Booking accepted successfully
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
 *                   example: "Booking accepted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     booking:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         status:
 *                           type: string
 *                           example: "accepted"
 *                         scheduledDate:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Bad request or booking not available
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/accept', auth(['professional']), (req, res) => {
  console.log('✅ POST /bookings/:id/accept - Professional accepting booking');
  BookingController.acceptBooking(req, res);
});

/**
 * @swagger
 * /api/bookings/active:
 *   get:
 *     summary: Get active booking for the current user
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active booking details
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
 *                     booking:
 *                       $ref: '#/components/schemas/Booking'
 *       404:
 *         description: No active booking found
 *       500:
 *         description: Internal server error
 */
router.get('/active', auth(), BookingController.getActiveBooking.bind(BookingController));

/**
 * @swagger
 * /api/bookings/history:
 *   get:
 *     summary: Get booking history with pagination
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of bookings per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, in_progress, completed, cancelled]
 *         description: Filter bookings by status
 *     responses:
 *       200:
 *         description: List of bookings with pagination info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 bookings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Booking'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */
router.get('/history', auth(), BookingController.getBookingHistory.bind(BookingController));

/**
 * @swagger
 * /api/bookings/{bookingId}/complete:
 *   post:
 *     summary: Complete a booking with verification code (Professional only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to complete
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationCode
 *             properties:
 *               verificationCode:
 *                 type: string
 *                 description: 6-digit verification code provided by customer
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Booking completed successfully
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
 *                   example: "Booking completed successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "completed"
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid verification code or bad request
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/complete', auth(['professional']), BookingController.completeBooking.bind(BookingController));

/**
 * @swagger
 * /api/bookings/{bookingId}/cancel:
 *   post:
 *     summary: Cancel a booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to cancel
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for cancellation
 *                 example: "Emergency came up"
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
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
 *                   example: "Booking cancelled successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "cancelled"
 *                     cancelledAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Cannot cancel booking in current status
 *       403:
 *         description: Not authorized to cancel this booking
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/cancel', auth(), BookingController.cancelBooking.bind(BookingController));

/**
 * @swagger
 * /api/bookings/{bookingId}/start:
 *   post:
 *     summary: Start a service (Professional only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to start
 *     responses:
 *       200:
 *         description: Service started successfully
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
 *                   example: "Service started successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "in_progress"
 *                     tracking:
 *                       type: object
 *                       properties:
 *                         startedAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Booking not in correct status to start
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/start', auth(['professional']), BookingController.startService.bind(BookingController));


/**
 * @swagger
 * /api/bookings/{bookingId}/arrived:
 *   post:
 *     summary: Mark professional as arrived (Professional only)
 *     tags: [Bookings]
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
 *         description: Arrival marked successfully
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
 *                   example: "Arrival marked successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     tracking:
 *                       type: object
 *                       properties:
 *                         arrivedAt:
 *                           type: string
 *                           format: date-time
 *                         eta:
 *                           type: number
 *                           example: 0
 *       400:
 *         description: Booking not in correct status
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/arrived', auth(['professional']), BookingController.professionalArrived.bind(BookingController));

/**
 * @swagger
 * /api/bookings/{bookingId}/rate:
 *   post:
 *     summary: Rate a completed booking (Customer only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to rate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 description: Rating score from 1 to 5
 *                 example: 4
 *               review:
 *                 type: string
 *                 description: Optional review text
 *                 example: "Great service, very professional!"
 *     responses:
 *       200:
 *         description: Booking rated successfully
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
 *                   example: "Booking rated successfully"
 *                 rating:
 *                   type: object
 *                   properties:
 *                     score:
 *                       type: number
 *                     review:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid rating or booking already rated
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/rate', auth(['user']), BookingController.rateBooking.bind(BookingController));

/**
 * @swagger
 * /api/bookings/{bookingId}/reschedule:
 *   post:
 *     summary: Reschedule a booking (Customer only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking to reschedule
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - scheduledDate
 *             properties:
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: New scheduled date and time
 *                 example: "2025-05-29T14:00:00.000Z"
 *               reason:
 *                 type: string
 *                 description: Reason for rescheduling
 *                 example: "Schedule conflict"
 *     responses:
 *       200:
 *         description: Booking rescheduled successfully
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
 *                   example: "Booking rescheduled successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     scheduledDate:
 *                       type: string
 *                       format: date-time
 *                     reschedulingHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           oldDate:
 *                             type: string
 *                             format: date-time
 *                           newDate:
 *                             type: string
 *                             format: date-time
 *                           rescheduledAt:
 *                             type: string
 *                             format: date-time
 *       400:
 *         description: Invalid date or booking cannot be rescheduled
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/reschedule', auth(['user']), BookingController.rescheduleBooking.bind(BookingController));


/**
 * @swagger
 * /api/bookings/{bookingId}/eta:
 *   post:
 *     summary: Update ETA for a booking (Professional only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the booking
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - etaMinutes
 *             properties:
 *               etaMinutes:
 *                 type: number
 *                 minimum: 0
 *                 description: Estimated time of arrival in minutes
 *                 example: 15
 *               coordinates:
 *                 type: array
 *                 items:
 *                   type: number
 *                 description: Current location coordinates [longitude, latitude]
 *                 example: [77.5946, 12.9716]
 *     responses:
 *       200:
 *         description: ETA updated successfully
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
 *                   example: "ETA updated successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     tracking:
 *                       type: object
 *                       properties:
 *                         eta:
 *                           type: number
 *                         lastLocation:
 *                           type: object
 *                           properties:
 *                             type:
 *                               type: string
 *                               example: "Point"
 *                             coordinates:
 *                               type: array
 *                               items:
 *                                 type: number
 *                             timestamp:
 *                               type: string
 *                               format: date-time
 *       400:
 *         description: Invalid ETA or booking not in correct status
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/eta', auth(['professional']), BookingController.updateETA.bind(BookingController));

/**
 * @swagger
 * /api/bookings/emergency:
 *   post:
 *     summary: Create an emergency booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serviceId
 *               - location
 *             properties:
 *               serviceId:
 *                 type: string
 *                 description: ID of the service to book
 *                 example: "67948e9065f73285ae21e621"
 *               location:
 *                 type: object
 *                 required:
 *                   - coordinates
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     description: Location coordinates [longitude, latitude]
 *                     example: [77.5946, 12.9716]
 *                   address:
 *                     type: string
 *                     description: Human readable address
 *                     example: "123 Main Street, Bangalore"
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *                 description: When the service should be performed (defaults to now for emergency)
 *                 example: "2025-05-28T10:00:00.000Z"
 *     responses:
 *       201:
 *         description: Emergency booking created successfully
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
 *                   example: "Emergency booking created successfully"
 *                 booking:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "pending"
 *                     isEmergency:
 *                       type: boolean
 *                       example: true
 *                     service:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         category:
 *                           type: string
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Service not found
 *       500:
 *         description: Internal server error
 */
router.post('/emergency', auth(), BookingController.createEmergencyBooking.bind(BookingController));


module.exports = router;