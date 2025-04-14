const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const BookingController = require('../controllers/booking.controller');

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
 *                 example: "67948e9065f73285ae21e621"
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     example: [77.5946, 12.9716]
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post('/', auth, (req, res) => {
  console.log('Received booking request');
  return BookingController.createBooking(req, res);
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
 *     responses:
 *       200:
 *         description: Booking accepted successfully
 */
router.post('/:bookingId/accept', auth, (req, res) => {
  return BookingController.acceptBooking(req, res);
});

/**
 * @swagger
 * /api/bookings/active:
 *   get:
 *     summary: Get active booking for the user
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active booking details
 */
router.get('/active', auth, (req, res) => {
  return BookingController.getActiveBooking(req, res);
});

/**
 * @swagger
 * /api/bookings/history:
 *   get:
 *     summary: Get booking history
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, completed, cancelled]
 *     responses:
 *       200:
 *         description: List of bookings
 */
router.get('/history', auth, (req, res) => {
  BookingController.getBookingHistory(req, res);
});

/**
 * @swagger
 * //**
 * @swagger
 * /api/bookings/{bookingId}/track:
 *   get:
 *     summary: Get real-time tracking information
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current tracking information
 */
router.get('/:bookingId/track', 
  auth, 
  BookingController.getTrackingInfo.bind(BookingController)
);

/**
* @swagger
* /api/bookings/{bookingId}/complete:
*   post:
*     summary: Complete a booking
*     tags: [Bookings]
*     security:
*       - bearerAuth: []
*     parameters:
*       - in: path
*         name: bookingId
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
*               - verificationCode
*             properties:
*               verificationCode:
*                 type: string
*                 example: "123456"
*     responses:
*       200:
*         description: Booking completed successfully
*/
router.post('/:bookingId/complete', auth, (req, res) => {
  BookingController.completeBooking(req, res);
});

module.exports = router;