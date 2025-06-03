// src/routes/earnings.routes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const earningsController = require('../controllers/earnings.controller');

/**
 * @route GET /professional/earnings
 * @desc Get earnings summary with filter
 * @access Private (Professional only)
 */
router.get('/earnings', auth(['professional']), earningsController.getEarnings);
/**
 *
 * 
 * @swagger
 * /api/professional/earnings/withdrawals/{id}:
 *   get:
 *     summary: Get withdrawal details
 *     tags: [Withdrawals]
 *     description: Retrieves detailed information about a specific withdrawal request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Withdrawal ID
 *     responses:
 *       200:
 *         description: Withdrawal details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WithdrawalDetails'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Withdrawal or professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 * 
 * @swagger
 * /api/professional/earnings/analytics:
 *   get:
 *     summary: Get earnings analytics
 *     tags: [Analytics]
 *     description: Retrieves analytics and statistical data about earnings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, year]
 *           default: month
 *         description: Time period for analytics data
 *     responses:
 *       200:
 *         description: Earnings analytics data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EarningsAnalytics'
 *       400:
 *         description: Invalid period
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error' @swagger
 * tags:
 *   - name: Earnings
 *     description: Professional earnings management
 *   - name: Transactions
 *     description: Transaction history and details
 *   - name: Payment Methods
 *     description: Payment method management for withdrawals
 *   - name: Withdrawals
 *     description: Withdrawal requests and history
 *   - name: Analytics
 *     description: Earnings analytics and statistics
 * 
 * components:
 *   schemas:
 *     Earnings:
 *       type: object
 *       properties:
 *         totalEarnings:
 *           type: number
 *           format: float
 *           example: 24500.50
 *         totalJobs:
 *           type: integer
 *           example: 15
 *         dateRange:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *               example: "2023-04-01T00:00:00Z"
 *             end:
 *               type: string
 *               format: date-time
 *               example: "2023-04-30T23:59:59Z"
 *         recentTransactions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "607f1f77bcf86cd799439019"
 *               service:
 *                 type: string
 *                 example: "Home Cleaning"
 *               category:
 *                 type: string
 *                 example: "Cleaning"
 *               amount:
 *                 type: number
 *                 format: float
 *                 example: 1200.00
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-04-15T14:30:00Z"
 *         earningsByCategory:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             Cleaning: 12000.00
 *             Plumbing: 8500.50
 *             Electrical: 4000.00
 *     
 *     EarningsDetails:
 *       type: object
 *       properties:
 *         dateRange:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *               example: "2023-04-01T00:00:00Z"
 *             end:
 *               type: string
 *               format: date-time
 *               example: "2023-04-30T23:59:59Z"
 *         statistics:
 *           type: object
 *           properties:
 *             totalEarnings:
 *               type: number
 *               format: float
 *               example: 24500.50
 *             totalJobs:
 *               type: integer
 *               example: 15
 *             averagePerJob:
 *               type: number
 *               format: float
 *               example: 1633.37
 *         transactions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "607f1f77bcf86cd799439019"
 *               service:
 *                 type: string
 *                 example: "Home Cleaning"
 *               category:
 *                 type: string
 *                 example: "Cleaning"
 *               customer:
 *                 type: string
 *                 example: "John Doe"
 *               amount:
 *                 type: number
 *                 format: float
 *                 example: 1200.00
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: "2023-04-15T14:30:00Z"
 *               paymentStatus:
 *                 type: string
 *                 enum: [pending, paid, failed]
 *                 example: "paid"
 *               hasInvoice:
 *                 type: boolean
 *                 example: true
 *         earningsByDate:
 *           type: object
 *           additionalProperties:
 *             type: number
 *           example:
 *             "2023-04-01": 1500.00
 *             "2023-04-02": 2200.00
 *             "2023-04-03": 0
 *             "2023-04-04": 3100.50
 *     
 *     TransactionDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "607f1f77bcf86cd799439019"
 *         service:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "Home Cleaning"
 *             category:
 *               type: string
 *               example: "Cleaning"
 *             description:
 *               type: string
 *               example: "Complete home cleaning service including kitchen, bathrooms, and living areas."
 *         customer:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *               example: "John Doe"
 *             phone:
 *               type: string
 *               example: "+91 98765 43210"
 *         amount:
 *           type: number
 *           format: float
 *           example: 1200.00
 *         commissionFee:
 *           type: number
 *           format: float
 *           example: 180.00
 *         netAmount:
 *           type: number
 *           format: float
 *           example: 1020.00
 *         date:
 *           type: string
 *           format: date-time
 *           example: "2023-04-15T14:30:00Z"
 *         scheduledDate:
 *           type: string
 *           format: date-time
 *           example: "2023-04-15T13:00:00Z"
 *         paymentStatus:
 *           type: string
 *           enum: [pending, paid, failed]
 *           example: "paid"
 *         paymentMethod:
 *           type: string
 *           example: "Online Payment"
 *         rating:
 *           type: object
 *           nullable: true
 *           properties:
 *             score:
 *               type: number
 *               minimum: 1
 *               maximum: 5
 *               example: 4.5
 *             review:
 *               type: string
 *               example: "Great service, very professional and thorough."
 *             createdAt:
 *               type: string
 *               format: date-time
 *               example: "2023-04-15T16:45:00Z"
 *         invoiceAvailable:
 *           type: boolean
 *           example: true
 *     
 *     AvailableBalance:
 *       type: object
 *       properties:
 *         availableBalance:
 *           type: number
 *           format: float
 *           example: 12750.00
 *         pendingWithdrawals:
 *           type: number
 *           format: float
 *           example: 2000.00
 *         totalEarnings:
 *           type: number
 *           format: float
 *           example: 24500.50
 *         platformFee:
 *           type: number
 *           format: float
 *           example: 3675.08
 *         netEarnings:
 *           type: number
 *           format: float
 *           example: 20825.42
 *         totalWithdrawn:
 *           type: number
 *           format: float
 *           example: 6075.42
 *     
 *     PaymentMethod:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "607f1f77bcf86cd799439025"
 *         type:
 *           type: string
 *           enum: [bank_account, upi]
 *           example: "bank_account"
 *         name:
 *           type: string
 *           example: "HDFC Bank Account"
 *         accountNumber:
 *           type: string
 *           example: "xxxx5678"
 *         upiId:
 *           type: string
 *           nullable: true
 *           example: null
 *         bankName:
 *           type: string
 *           example: "HDFC Bank"
 *         ifscCode:
 *           type: string
 *           example: "HDFC0001234"
 *         isDefault:
 *           type: boolean
 *           example: true
 *     
 *     UPIPaymentMethod:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "607f1f77bcf86cd799439026"
 *         type:
 *           type: string
 *           enum: [bank_account, upi]
 *           example: "upi"
 *         name:
 *           type: string
 *           example: "Google Pay"
 *         upiId:
 *           type: string
 *           example: "john.doe@okicici"
 *         accountNumber:
 *           type: string
 *           nullable: true
 *           example: null
 *         bankName:
 *           type: string
 *           nullable: true
 *           example: null
 *         ifscCode:
 *           type: string
 *           nullable: true
 *           example: null
 *         isDefault:
 *           type: boolean
 *           example: false
 *     
 *     Withdrawal:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "607f1f77bcf86cd799439027"
 *         amount:
 *           type: number
 *           format: float
 *           example: 5000.00
 *         status:
 *           type: string
 *           enum: [processing, completed, failed]
 *           example: "processing"
 *         paymentMethod:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [bank_account, upi]
 *               example: "bank_account"
 *             name:
 *               type: string
 *               example: "HDFC Bank Account"
 *             accountNumber:
 *               type: string
 *               example: "xxxx5678"
 *             upiId:
 *               type: string
 *               nullable: true
 *               example: null
 *         requestedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-04-20T10:15:00Z"
 *         processedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2023-04-21T14:30:00Z"
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         reference:
 *           type: string
 *           nullable: true
 *           example: "TXN123456789"
 *     
 *     WithdrawalDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "607f1f77bcf86cd799439027"
 *         amount:
 *           type: number
 *           format: float
 *           example: 5000.00
 *         status:
 *           type: string
 *           enum: [processing, completed, failed]
 *           example: "processing"
 *         paymentMethod:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [bank_account, upi]
 *               example: "bank_account"
 *             name:
 *               type: string
 *               example: "HDFC Bank Account"
 *             accountNumber:
 *               type: string
 *               example: "xxxx5678"
 *             upiId:
 *               type: string
 *               nullable: true
 *               example: null
 *             bankName:
 *               type: string
 *               example: "HDFC Bank"
 *             ifscCode:
 *               type: string
 *               example: "HDFC0001234"
 *         requestedAt:
 *           type: string
 *           format: date-time
 *           example: "2023-04-20T10:15:00Z"
 *         processedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2023-04-21T14:30:00Z"
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: null
 *         reference:
 *           type: string
 *           nullable: true
 *           example: "TXN123456789"
 *         remarks:
 *           type: string
 *           nullable: true
 *           example: "Processing through NEFT. Will be credited within 24 hours."
 *     
 *     EarningsAnalytics:
 *       type: object
 *       properties:
 *         period:
 *           type: string
 *           enum: [week, month, year]
 *           example: "month"
 *         dateRange:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *               example: "2023-03-27T00:00:00Z"
 *             end:
 *               type: string
 *               format: date-time
 *               example: "2023-04-26T23:59:59Z"
 *         summary:
 *           type: object
 *           properties:
 *             totalEarnings:
 *               type: number
 *               format: float
 *               example: 24500.50
 *             totalJobs:
 *               type: integer
 *               example: 15
 *             averagePerJob:
 *               type: number
 *               format: float
 *               example: 1633.37
 *         trends:
 *           type: object
 *           properties:
 *             earningsChange:
 *               type: number
 *               format: float
 *               example: 12.5
 *             jobsChange:
 *               type: number
 *               format: float
 *               example: 8.3
 *         charts:
 *           type: object
 *           properties:
 *             earningsByDate:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     example: "2023-04-15"
 *                   amount:
 *                     type: number
 *                     format: float
 *                     example: 2500.00
 *             servicesByCategory:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   category:
 *                     type: string
 *                     example: "Cleaning"
 *                   count:
 *                     type: integer
 *                     example: 8
 *             bookingsByDayOfWeek:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   day:
 *                     type: string
 *                     example: "Monday"
 *                   count:
 *                     type: integer
 *                     example: 5
 *     
 *     Error:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *           example: "Resource not found"
 *         details:
 *           type: string
 *           example: "The requested resource could not be found"
 */

/**
 * @swagger
 * /api/professional/earnings:
 *   get:
 *     summary: Get earnings summary
 *     tags: [Earnings]
 *     description: Retrieves earnings summary for the professional with filter options
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [week, month, year, all]
 *           default: week
 *         description: Time period filter for earnings data
 *     responses:
 *       200:
 *         description: Earnings summary data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Earnings'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/professional/earnings/details:
 *   get:
 *     summary: Get detailed earnings
 *     tags: [Earnings]
 *     description: Retrieves detailed earnings information for a specific time period
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2023-04-01"
 *         description: Start date for earnings data (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2023-04-30"
 *         description: End date for earnings data (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Detailed earnings data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EarningsDetails'
 *       400:
 *         description: Invalid or missing date parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/professional/earnings/transactions/{id}:
 *   get:
 *     summary: Get transaction details
 *     tags: [Transactions]
 *     description: Retrieves detailed information for a specific transaction
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TransactionDetails'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Transaction or professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/professional/earnings/transactions/{id}/invoice:
 *   post:
 *     summary: Generate invoice for a transaction
 *     tags: [Transactions]
 *     description: Generates and returns a PDF invoice for a specific transaction
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: PDF invoice
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Transaction or professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/professional/earnings/available-balance:
 *   get:
 *     summary: Get available balance
 *     tags: [Earnings]
 *     description: Retrieves the available balance for withdrawal and related financial information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available balance and related information
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AvailableBalance'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/professional/earnings/payment-methods:
 *   get:
 *     summary: Get payment methods
 *     tags: [Payment Methods]
 *     description: Retrieves all active payment methods for the professional
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of payment methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 paymentMethods:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - $ref: '#/components/schemas/PaymentMethod'
 *                       - $ref: '#/components/schemas/UPIPaymentMethod'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   
 *   post:
 *     summary: Add payment method
 *     tags: [Payment Methods]
 *     description: Adds a new payment method for the professional
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [bank_account, upi]
 *                 example: "bank_account"
 *               name:
 *                 type: string
 *                 example: "HDFC Bank Account"
 *               accountNumber:
 *                 type: string
 *                 example: "123456789012"
 *               upiId:
 *                 type: string
 *                 example: "john.doe@okicici"
 *               bankName:
 *                 type: string
 *                 example: "HDFC Bank"
 *               ifscCode:
 *                 type: string
 *                 example: "HDFC0001234"
 *               isDefault:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Payment method added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payment method added successfully"
 *                 paymentMethod:
 *                   oneOf:
 *                     - $ref: '#/components/schemas/PaymentMethod'
 *                     - $ref: '#/components/schemas/UPIPaymentMethod'
 *       400:
 *         description: Invalid input or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/professional/earnings/payment-methods/{id}:
 *   delete:
 *     summary: Remove payment method
 *     tags: [Payment Methods]
 *     description: Removes (deactivates) a payment method
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment method ID
 *     responses:
 *       200:
 *         description: Payment method removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Payment method removed successfully"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Payment method or professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/professional/earnings/withdrawals:
 *   get:
 *     summary: Get withdrawal history
 *     tags: [Withdrawals]
 *     description: Retrieves the history of withdrawal requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of withdrawals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 withdrawals:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Withdrawal'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   
 *   post:
 *     summary: Request a withdrawal
 *     tags: [Withdrawals]
 *     description: Creates a new withdrawal request for available funds
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentMethodId
 *             properties:
 *               amount:
 *                 type: number
 *                 format: float
 *                 minimum: 1
 *                 example: 5000.00
 *                 description: Amount to withdraw
 *               paymentMethodId:
 *                 type: string
 *                 example: "607f1f77bcf86cd799439025"
 *                 description: ID of the payment method to use
 *     responses:
 *       201:
 *         description: Withdrawal request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Withdrawal request submitted successfully"
 *                 withdrawal:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "607f1f77bcf86cd799439027"
 *                     amount:
 *                       type: number
 *                       format: float
 *                       example: 5000.00
 *                     status:
 *                       type: string
 *                       enum: [processing, completed, failed]
 *                       example: "processing"
 *                     requestedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2023-04-20T10:15:00Z"
 *       400:
 *         description: Invalid input, insufficient balance, or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - User is not a professional
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Payment method or professional profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *

/**
 * @route GET /professional/earnings/details
 * @desc Get detailed earnings for a specific time period
 * @access Private (Professional only)
 */
router.get('/earnings/details',auth(['professional']), earningsController.getEarningsDetails);

/**
 * @route GET /professional/earnings/transactions/:id
 * @desc Get transaction details
 * @access Private (Professional only)
 */
router.get('/earnings/transactions/:id', auth(['professional']), earningsController.getTransactionDetails);

/**
 * @route POST /professional/earnings/transactions/:id/invoice
 * @desc Generate invoice for a transaction
 * @access Private (Professional only)
 */
router.post('/earnings/transactions/:id/invoice',auth(['professional']), earningsController.generateInvoice);

/**
 * @route GET /professional/earnings/available-balance
 * @desc Get available balance for withdrawal
 * @access Private (Professional only)
 */
router.get('/earnings/available-balance', auth(['professional']), earningsController.getAvailableBalance);

/**
 * @route GET /professional/earnings/payment-methods
 * @desc Get payment methods
 * @access Private (Professional only)
 */
router.get('/earnings/payment-methods', auth(['professional']), earningsController.getPaymentMethods);

/**
 * @route POST /professional/earnings/payment-methods
 * @desc Add payment method
 * @access Private (Professional only)
 */
router.post('/earnings/payment-methods', auth(['professional']), earningsController.addPaymentMethod);

/**
 * @route DELETE /professional/earnings/payment-methods/:id
 * @desc Remove payment method
 * @access Private (Professional only)
 */
router.delete('/earnings/payment-methods/:id', auth(['professional']), earningsController.removePaymentMethod);

/**
 * @route POST /professional/earnings/withdrawals
 * @desc Request withdrawal
 * @access Private (Professional only)
 */
router.post('/earnings/withdrawals', auth(['professional']), earningsController.requestWithdrawal);

/**
 * @route GET /professional/earnings/withdrawals
 * @desc Get withdrawal history
 * @access Private (Professional only)
 */
router.get('/earnings/withdrawals', auth(['professional']), earningsController.getWithdrawalHistory);

/**
 * @route GET /professional/earnings/withdrawals/:id
 * @desc Get withdrawal details
 * @access Private (Professional only)
 */
router.get('/earnings/withdrawals/:id', auth(['professional']), earningsController.getWithdrawalDetails);

/**
 * @route GET /professional/earnings/analytics
 * @desc Get earnings analytics
 * @access Private (Professional only)
 */
router.get('/earnings/analytics', auth(['professional']), earningsController.getEarningsAnalytics);

module.exports = router;