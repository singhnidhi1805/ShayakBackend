const express = require('express');
const userAuth = require('../controllers/userAuth.controller');
const professionalAuth = require('../controllers/professionalAuth.controller');
const adminAuth = require('../controllers/adminAuth.controller');
const router = express.Router();


/**
 * @swagger
 * /api/auth/user/send-otp:
 *   post:
 *     summary: Send OTP to a user's phone
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - recaptchaToken
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number (with or without +91)
 *                 example: "8210036495"
 *               recaptchaToken:
 *                 type: string
 *                 description: For testing, use "test_recaptcha_token"
 *                 example: "test_recaptcha_token"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *                 sessionId:
 *                   type: string
 *                   description: Session ID for OTP verification
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Phone number is required"
 *       500:
 *         description: Server error
 */
router.post('/user/send-otp', userAuth.sendOtp);

/**
 * @swagger
 * /api/auth/user/verify-otp:
 *   post:
 *     summary: Verify OTP and authenticate the user
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - sessionId
 *               - role
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number with country code
 *                 example: "+918210036495"
 *               otp:
 *                 type: string
 *                 description: For testing, use "123456"
 *                 example: "123456"
 *               sessionId:
 *                 type: string
 *                 description: Session ID received from send-otp
 *               role:
 *                 type: string
 *                 enum: [user]
 *                 example: "user"
 *     responses:
 *       200:
 *         description: User authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP verified successfully"
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid OTP or session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid OTP or Session"
 *       500:
 *         description: Server error
 */
router.post('/user/verify-otp', userAuth.verifyOtp);
/**
 * @swagger
 * /api/auth/user/send-otp:
 *   post:
 *     summary: Send OTP to a user's phone
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - recaptchaToken
 *             properties:
 *               phone:
 *                 type: string
 *                 description: User's phone number (with or without +91)
 *                 example: "8210036495"
 *               recaptchaToken:
 *                 type: string
 *                 description: For testing, use "test_recaptcha_token"
 *                 example: "test_recaptcha_token"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *                 sessionId:
 *                   type: string
 *                   description: Session ID for OTP verification
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/professional/send-otp:
 *   post:
 *     summary: Send OTP to a professional's phone
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - recaptchaToken
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Professional's phone number (with or without +91)
 *                 example: "9876543210"
 *               recaptchaToken:
 *                 type: string
 *                 description: For testing, use "test_recaptcha_token"
 *                 example: "test_recaptcha_token"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *                 sessionId:
 *                   type: string
 *                   description: Session ID for OTP verification
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/admin/send-otp:
 *   post:
 *     summary: Send OTP to an admin's phone
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - recaptchaToken
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Admin's phone number (with or without +91)
 *                 example: "9998887777"
 *               recaptchaToken:
 *                 type: string
 *                 description: For testing, use "test_recaptcha_token"
 *                 example: "test_recaptcha_token"
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP sent successfully"
 *                 sessionId:
 *                   type: string
 *                   description: Session ID for OTP verification
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/professional/verify-otp:
 *   post:
 *     summary: Verify OTP and authenticate the professional
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - sessionId
 *               - role
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Professional's phone number with country code
 *                 example: "+919876543210"
 *               otp:
 *                 type: string
 *                 description: For testing, use "123456"
 *                 example: "123456"
 *               sessionId:
 *                 type: string
 *                 description: Session ID received from send-otp
 *               role:
 *                 type: string
 *                 enum: [professional]
 *                 example: "professional"
 *     responses:
 *       200:
 *         description: Professional authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP verified successfully"
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, verified, active, inactive, suspended]
 *       401:
 *         description: Invalid OTP or session
 *       500:
 *         description: Server error
 */

/**
 * @swagger
 * /api/auth/admin/verify-otp:
 *   post:
 *     summary: Verify OTP and authenticate the admin
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *               - sessionId
 *               - role
 *             properties:
 *               phone:
 *                 type: string
 *                 description: Admin's phone number with country code
 *                 example: "+919998887777"
 *               otp:
 *                 type: string
 *                 description: For testing, use "123456"
 *                 example: "123456"
 *               sessionId:
 *                 type: string
 *                 description: Session ID received from send-otp
 *               role:
 *                 type: string
 *                 enum: [admin]
 *                 example: "admin"
 *     responses:
 *       200:
 *         description: Admin authenticated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "OTP verified successfully"
 *                 token:
 *                   type: string
 *                   description: JWT token for authentication
 *                 user:
 *                   type: object
 *                   properties:
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         description: Invalid OTP or session
 *       500:
 *         description: Server error
 */


// router.post('/user/send-otp', userAuth.sendOtp); 
// router.post('/user/send-otp', userAuth.sendOtp);
router.post('/user/verify-otp', userAuth.verifyOtp);

// Professional routes
router.post('/professional/send-otp', professionalAuth.sendOtp);
router.post('/professional/verify-otp', professionalAuth.verifyOtp);

// Admin routes
router.post('/admin/send-otp', adminAuth.sendOtp);
router.post('/admin/verify-otp', adminAuth.verifyOtp);


module.exports = router; 
