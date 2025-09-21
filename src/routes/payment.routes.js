// routes/payment.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const PaymentController = require('../controllers/payment.controller');

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentRequest:
 *       type: object
 *       required:
 *         - bookingId
 *         - serviceAmount
 *         - paymentMethod
 *       properties:
 *         bookingId:
 *           type: string
 *           description: ID of the completed booking
 *         serviceAmount:
 *           type: number
 *           description: Base service amount
 *           minimum: 1
 *         additionalCharges:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *               amount:
 *                 type: number
 *         paymentMethod:
 *           type: string
 *           enum: [online, upi, cash]
 *           description: Payment method choice
 *     
 *     PaymentBreakdown:
 *       type: object
 *       properties:
 *         serviceAmount:
 *           type: number
 *         additionalAmount:
 *           type: number
 *         totalAmount:
 *           type: number
 *         platformCommission:
 *           type: number
 *           description: 15% platform commission
 *         professionalPayout:
 *           type: number
 *           description: Amount professional receives
 */

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     summary: Initiate payment after service completion
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentRequest'
 *           examples:
 *             online_payment:
 *               summary: Online payment via Razorpay
 *               value:
 *                 bookingId: "68c50cf1f5d3afbe979cdea8"
 *                 serviceAmount: 500
 *                 additionalCharges:
 *                   - description: "Extra cleaning supplies"
 *                     amount: 50
 *                   - description: "Additional room"
 *                     amount: 100
 *                 paymentMethod: "online"
 *             upi_payment:
 *               summary: UPI payment
 *               value:
 *                 bookingId: "68c50cf1f5d3afbe979cdea8"
 *                 serviceAmount: 500
 *                 paymentMethod: "upi"
 *             cash_payment:
 *               summary: Cash on delivery
 *               value:
 *                 bookingId: "68c50cf1f5d3afbe979cdea8"
 *                 serviceAmount: 500
 *                 paymentMethod: "cash"
 *     responses:
 *       201:
 *         description: Payment initiated successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentId:
 *                       type: string
 *                     bookingId:
 *                       type: string
 *                     paymentMethod:
 *                       type: string
 *                     breakdown:
 *                       $ref: '#/components/schemas/PaymentBreakdown'
 *                     paymentOrder:
 *                       type: object
 *                       description: Payment gateway specific details
 *                     instructions:
 *                       type: string
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Not authorized for this booking
 *       404:
 *         description: Booking not found
 *       409:
 *         description: Payment already processed
 */
router.post('/initiate', auth(), PaymentController.initiatePayment.bind(PaymentController));

/**
 * @swagger
 * /api/payments/{bookingId}/charges:
 *   post:
 *     summary: Add additional charges to a booking (Professional only)
 *     tags: [Payments]
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
 *               - charges
 *             properties:
 *               charges:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                       example: "Extra cleaning supplies"
 *                     amount:
 *                       type: number
 *                       example: 50
 *           example:
 *             charges:
 *               - description: "Extra cleaning supplies"
 *                 amount: 50
 *               - description: "Additional room cleaning"
 *                 amount: 100
 *     responses:
 *       200:
 *         description: Charges added successfully
 *       400:
 *         description: Invalid charges data
 *       403:
 *         description: Only assigned professional can add charges
 *       404:
 *         description: Booking not found
 */
router.post('/:bookingId/charges', auth(['professional']), PaymentController.addAdditionalCharges.bind(PaymentController));

/**
 * @swagger
 * /api/payments/razorpay/verify:
 *   post:
 *     summary: Verify Razorpay payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - razorpay_order_id
 *               - razorpay_payment_id
 *               - razorpay_signature
 *             properties:
 *               razorpay_order_id:
 *                 type: string
 *               razorpay_payment_id:
 *                 type: string
 *               razorpay_signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     paymentId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     amount:
 *                       type: number
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid payment signature or missing details
 *       404:
 *         description: Payment record not found
 */
router.post('/razorpay/verify', auth(), PaymentController.verifyRazorpayPayment.bind(PaymentController));

/**
 * @swagger
 * /api/payments/{paymentId}/upi/verify:
 *   post:
 *     summary: Verify UPI payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
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
 *               - upiTransactionId
 *             properties:
 *               upiTransactionId:
 *                 type: string
 *                 example: "UPI123456789"
 *     responses:
 *       200:
 *         description: UPI payment verified successfully
 *       400:
 *         description: Invalid payment method or missing transaction ID
 *       404:
 *         description: Payment not found
 */
router.post('/:paymentId/upi/verify', auth(), PaymentController.verifyUPIPayment.bind(PaymentController));

/**
 * @swagger
 * /api/payments/{paymentId}:
 *   get:
 *     summary: Get payment details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payment:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         totalAmount:
 *                           type: number
 *                         serviceAmount:
 *                           type: number
 *                         additionalAmount:
 *                           type: number
 *                         platformCommission:
 *                           type: number
 *                         professionalPayout:
 *                           type: number
 *                         paymentMethod:
 *                           type: string
 *                         status:
 *                           type: string
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                         additionalCharges:
 *                           type: array
 *                           items:
 *                             type: object
 *                         invoice:
 *                           type: object
 *       403:
 *         description: Not authorized to view this payment
 *       404:
 *         description: Payment not found
 */
router.get('/:paymentId', auth(), PaymentController.getPaymentDetails.bind(PaymentController));

/**
 * @swagger
 * /api/payments/booking/{bookingId}/summary:
 *   get:
 *     summary: Get payment summary for a booking
 *     tags: [Payments]
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
 *         description: Payment summary retrieved successfully
 *       404:
 *         description: Payment not found for this booking
 */
router.get('/booking/:bookingId/summary', auth(), PaymentController.getPaymentSummary.bind(PaymentController));

/**
 * @swagger
 * /api/payments/{paymentId}/refund:
 *   post:
 *     summary: Process refund (Admin only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
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
 *               - refundAmount
 *               - reason
 *             properties:
 *               refundAmount:
 *                 type: number
 *                 minimum: 1
 *               reason:
 *                 type: string
 *                 example: "Service not satisfactory"
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *       400:
 *         description: Invalid refund data
 *       403:
 *         description: Only admins can process refunds
 *       404:
 *         description: Payment not found
 */
router.post('/:paymentId/refund', auth(['admin']), PaymentController.processRefund.bind(PaymentController));

/**
 * @swagger
 * /api/payments/commission/dues:
 *   get:
 *     summary: Get commission dues (Professional only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Commission dues retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalCommissionDue:
 *                       type: number
 *                       description: Total commission amount due
 *                     pendingPayments:
 *                       type: number
 *                       description: Number of payments with pending commission
 *                     dues:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           totalAmount:
 *                             type: number
 *                           platformCommission:
 *                             type: number
 *                           commissionDueDate:
 *                             type: string
 *                             format: date-time
 *       403:
 *         description: Only professionals can view commission dues
 */
router.get('/commission/dues', auth(['professional']), PaymentController.getCommissionDues.bind(PaymentController));

/**
 * @swagger
 * /api/payments/commission/pay:
 *   post:
 *     summary: Pay commission (Professional only)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentIds
 *               - totalAmount
 *             properties:
 *               paymentIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of payment IDs to pay commission for
 *               totalAmount:
 *                 type: number
 *                 description: Total commission amount being paid
 *     responses:
 *       200:
 *         description: Commission payment recorded successfully
 *       400:
 *         description: Invalid payment IDs
 *       403:
 *         description: Only professionals can pay commission
 */
router.post('/commission/pay', auth(['professional']), PaymentController.payCommission.bind(PaymentController));

module.exports = router;