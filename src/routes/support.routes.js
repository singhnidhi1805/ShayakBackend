// src/routes/support.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth.middleware');
const SupportController = require('../controllers/support.controller');

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

/**
 * @route GET /support/faq-categories
 * @desc Get FAQ categories
 * @access Public
 */
router.get('/faq-categories', SupportController.getFAQCategories);
/**
 * @swagger
 * tags:
 *   - name: FAQ Management
 *     description: FAQ categories and questions management
 *   - name: Support Tickets
 *     description: Managing support tickets and replies
 *   - name: Live Chat
 *     description: Live chat functionality
 *   - name: Feedback
 *     description: User feedback management
 * 
 * components:
 *   schemas:
 *     FAQCategory:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 607f1f77bcf86cd799439017
 *         name:
 *           type: string
 *           example: Account Management
 *         description:
 *           type: string
 *           example: Questions about account management
 *         order:
 *           type: number
 *           example: 1
 *         isActive:
 *           type: boolean
 *           example: true
 *     FAQ:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 607f1f77bcf86cd799439018
 *         category:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 607f1f77bcf86cd799439017
 *             name:
 *               type: string
 *               example: Account Management
 *         question:
 *           type: string
 *           example: How do I reset my password?
 *         answer:
 *           type: string
 *           example: You can reset your password by clicking on the "Forgot Password" link on the login page.
 *         order:
 *           type: number
 *           example: 1
 *         isActive:
 *           type: boolean
 *           example: true
 *         isCommonIssue:
 *           type: boolean
 *           example: true
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: [password, reset, login]
 *     Ticket:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 607f1f77bcf86cd799439019
 *         ticketNumber:
 *           type: string
 *           example: TIC202300000001
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 607f1f77bcf86cd799439014
 *             name:
 *               type: string
 *               example: John Doe
 *             email:
 *               type: string
 *               example: john.doe@example.com
 *         subject:
 *           type: string
 *           example: Login Issue
 *         message:
 *           type: string
 *           example: I am unable to log in to my account.
 *         category:
 *           type: string
 *           example: Account
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           example: medium
 *         status:
 *           type: string
 *           enum: [open, pending, closed]
 *           example: open
 *         userRole:
 *           type: string
 *           example: user
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-04-09T10:30:00Z
 *         assignedTo:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 607f1f77bcf86cd799439020
 *             name:
 *               type: string
 *               example: Support Agent
 *             email:
 *               type: string
 *               example: agent@example.com
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: screenshot.png
 *               fileUrl:
 *                 type: string
 *                 example: https://example.com/attachments/screenshot.png
 *               fileSize:
 *                 type: number
 *                 example: 1024
 *               mimeType:
 *                 type: string
 *                 example: image/png
 *               uploadedBy:
 *                 type: string
 *                 example: 607f1f77bcf86cd799439014
 *               uploadedAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2023-04-09T10:30:00Z
 *     TicketReply:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 607f1f77bcf86cd799439021
 *         ticket:
 *           type: string
 *           example: 607f1f77bcf86cd799439019
 *         user:
 *           type: object
 *           properties:
 *             _id:
 *               type: string
 *               example: 607f1f77bcf86cd799439014
 *             name:
 *               type: string
 *               example: John Doe
 *             email:
 *               type: string
 *               example: john.doe@example.com
 *             role:
 *               type: string
 *               example: user
 *         message:
 *           type: string
 *           example: I have tried resetting my browser cache but still having issues.
 *         userRole:
 *           type: string
 *           example: user
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2023-04-09T10:30:00Z
 *     Feedback:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 607f1f77bcf86cd799439022
 *         user:
 *           type: string
 *           example: 607f1f77bcf86cd799439014
 *         userRole:
 *           type: string
 *           example: user
 *         type:
 *           type: string
 *           enum: [general, feature, bug]
 *           example: feature
 *         message:
 *           type: string
 *           example: It would be great to have a dark mode feature.
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           example: 4
 *         submittedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-04-09T10:30:00Z
 *     LiveChatAvailability:
 *       type: object
 *       properties:
 *         isAvailable:
 *           type: boolean
 *           example: true
 *         supportHours:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               example: 9:00 AM
 *             end:
 *               type: string
 *               example: 6:00 PM
 *             timezone:
 *               type: string
 *               example: IST
 *             days:
 *               type: string
 *               example: Monday to Friday
 *         onlineAgents:
 *           type: number
 *           example: 2
 *     ChatSession:
 *       type: object
 *       properties:
 *         sessionId:
 *           type: string
 *           example: 607f1f77bcf86cd799439023
 *         agent:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               example: 607f1f77bcf86cd799439020
 *             name:
 *               type: string
 *               example: Support Agent
 *         startedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-04-09T10:30:00Z
 *         status:
 *           type: string
 *           enum: [active, ended]
 *           example: active
 *     Attachment:
 *       type: object
 *       properties:
 *         fileName:
 *           type: string
 *           example: screenshot.png
 *         fileUrl:
 *           type: string
 *           example: https://example.com/attachments/screenshot.png
 *         fileSize:
 *           type: number
 *           example: 1024
 *         mimeType:
 *           type: string
 *           example: image/png
 *         uploadedBy:
 *           type: string
 *           example: 607f1f77bcf86cd799439014
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *           example: 2023-04-09T10:30:00Z
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: Resource not found
 *         details:
 *           type: string
 *           example: The requested resource could not be found
 * 
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/support/faq-categories:
 *   get:
 *     summary: Get all FAQ categories
 *     tags: [FAQ Management]
 *     description: Retrieves a list of all available FAQ categories
 *     responses:
 *       200:
 *         description: List of FAQ categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 categories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FAQCategory'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/support/faqs:
 *   get:
 *     summary: Get FAQs by category
 *     tags: [FAQ Management]
 *     description: Retrieves FAQs filtered by category if provided
 *     parameters:
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: FAQ category ID to filter by
 *     responses:
 *       200:
 *         description: List of FAQs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 faqs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FAQ'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/support/faqs/search:
 *   get:
 *     summary: Search FAQs
 *     tags: [FAQ Management]
 *     description: Search FAQs using a keyword query
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (minimum 3 characters)
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 faqs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FAQ'
 *                 query:
 *                   type: string
 *                   example: password
 *       400:
 *         description: Invalid search query
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
 * /api/support/common-issues:
 *   get:
 *     summary: Get common issues and solutions
 *     tags: [FAQ Management]
 *     description: Retrieves frequently encountered issues and their solutions
 *     responses:
 *       200:
 *         description: List of common issues
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 commonIssues:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FAQ'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Get all support tickets
 *     tags: [Support Tickets]
 *     description: Retrieves all support tickets for the authenticated user or all tickets for admin
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of support tickets
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 tickets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ticket'
 *       401:
 *         description: Unauthorized
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
 *     summary: Create a new support ticket
 *     tags: [Support Tickets]
 *     description: Creates a new support ticket for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - subject
 *               - message
 *             properties:
 *               subject:
 *                 type: string
 *                 example: Login Issue
 *               message:
 *                 type: string
 *                 example: I am unable to log in to my account after the recent update.
 *               category:
 *                 type: string
 *                 example: Account
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 example: medium
 *     responses:
 *       201:
 *         description: Support ticket created successfully
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
 *                   example: Support ticket created successfully
 *                 ticket:
 *                   $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 * /api/support/tickets/{id}:
 *   get:
 *     summary: Get ticket details
 *     tags: [Support Tickets]
 *     description: Retrieves detailed information about a specific support ticket
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket details with replies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 ticket:
 *                   $ref: '#/components/schemas/Ticket'
 *                 replies:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TicketReply'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Ticket not found
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
 * /api/support/tickets/{id}/replies:
 *   post:
 *     summary: Add reply to a ticket
 *     tags: [Support Tickets]
 *     description: Adds a new reply to an existing support ticket
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: I have tried resetting my browser cache but still having issues.
 *     responses:
 *       200:
 *         description: Reply added successfully
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
 *                   example: Reply added successfully
 *                 reply:
 *                   $ref: '#/components/schemas/TicketReply'
 *       400:
 *         description: Invalid input or ticket is closed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Ticket not found
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
 * /api/support/tickets/{id}/close:
 *   put:
 *     summary: Close a support ticket
 *     tags: [Support Tickets]
 *     description: Closes an open support ticket
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket closed successfully
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
 *                   example: Ticket closed successfully
 *                 ticket:
 *                   $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Ticket is already closed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Ticket not found
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
 * /api/support/tickets/{id}/reopen:
 *   put:
 *     summary: Reopen a closed ticket
 *     tags: [Support Tickets]
 *     description: Reopens a previously closed support ticket
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket reopened successfully
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
 *                   example: Ticket reopened successfully
 *                 ticket:
 *                   $ref: '#/components/schemas/Ticket'
 *       400:
 *         description: Ticket is not closed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Ticket not found
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
 * /api/support/tickets/{id}/attachments:
 *   post:
 *     summary: Upload attachment to a ticket
 *     tags: [Support Tickets]
 *     description: Uploads a file attachment to an existing support ticket
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File to upload (max 5MB)
 *     responses:
 *       200:
 *         description: Attachment uploaded successfully
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
 *                   example: Attachment uploaded successfully
 *                 attachment:
 *                   $ref: '#/components/schemas/Attachment'
 *       400:
 *         description: File is required or ticket is closed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       413:
 *         description: File too large
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
 * /api/support/feedback:
 *   post:
 *     summary: Submit app feedback
 *     tags: [Feedback]
 *     description: Submits user feedback about the application
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
 *               - message
 *               - rating
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [general, feature, bug]
 *                 example: feature
 *               message:
 *                 type: string
 *                 example: It would be great to have a dark mode feature.
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 4
 *     responses:
 *       201:
 *         description: Feedback submitted successfully
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
 *                   example: Feedback submitted successfully
 *                 feedback:
 *                   $ref: '#/components/schemas/Feedback'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 * /api/support/live-chat/availability:
 *   get:
 *     summary: Check live chat availability
 *     tags: [Live Chat]
 *     description: Checks if live chat support is currently available
 *     responses:
 *       200:
 *         description: Live chat availability status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 availability:
 *                   $ref: '#/components/schemas/LiveChatAvailability'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/support/live-chat/initiate:
 *   post:
 *     summary: Initiate a live chat session
 *     tags: [Live Chat]
 *     description: Starts a new live chat session with a support agent
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *               - message
 *             properties:
 *               topic:
 *                 type: string
 *                 example: Account Login Issue
 *               message:
 *                 type: string
 *                 example: I need help with accessing my account after the recent update.
 *     responses:
 *       201:
 *         description: Live chat session initiated successfully
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
 *                   example: Live chat session initiated successfully
 *                 chatSession:
 *                   $ref: '#/components/schemas/ChatSession'
 *       400:
 *         description: Missing required fields or chat unavailable
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
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
 * /api/support/live-chat/{sessionId}/messages:
 *   get:
 *     summary: Get chat messages
 *     tags: [Live Chat]
 *     description: Retrieves all messages for a specific chat session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat Session ID
 *     responses:
 *       200:
 *         description: List of chat messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: 607f1f77bcf86cd799439025
 *                       sender:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: 607f1f77bcf86cd799439014
 *                           name:
 *                             type: string
 *                             example: John Doe
 *                       senderRole:
 *                         type: string
 *                         example: user
 *                       message:
 *                         type: string
 *                         example: I need help with logging in.
 *                       sentAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2023-04-09T10:30:00Z
 *                       readAt:
 *                         type: string
 *                         format: date-time
 *                         example: 2023-04-09T10:31:00Z
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Chat session not found
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
 *     summary: Send a chat message
 *     tags: [Live Chat]
 *     description: Sends a new message in an active chat session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat Session ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: I have already tried resetting my password but it's not working.
 *     responses:
 *       201:
 *         description: Message sent successfully
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
 *                   example: Message sent successfully
 *                 chatMessage:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: 607f1f77bcf86cd799439026
 *                     sender:
 *                       type: string
 *                       example: 607f1f77bcf86cd799439014
 *                     senderRole:
 *                       type: string
 *                       example: user
 *                     message:
 *                       type: string
 *                       example: I have already tried resetting my password but it's not working.
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                       example: 2023-04-09T10:35:00Z
 *       400:
 *         description: Missing message or session ended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Chat session not found
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
 * /api/support/live-chat/{sessionId}/end:
 *   put:
 *     summary: End a chat session
 *     tags: [Live Chat]
 *     description: Ends an active chat session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Chat Session ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 4
 *               feedback:
 *                 type: string
 *                 example: The support agent was very helpful and resolved my issue quickly.
 *     responses:
 *       200:
 *         description: Chat session ended successfully
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
 *                   example: Chat session ended successfully
 *                 chatSession:
 *                   $ref: '#/components/schemas/ChatSession'
 *       400:
 *         description: Session already ended
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Chat session not found
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
 * @route GET /support/faqs
 * @desc Get FAQs by category
 * @access Public
 */
router.get('/faqs', SupportController.getFAQs);

/**
 * @route GET /support/faqs/search
 * @desc Search FAQs
 * @access Public
 */
router.get('/faqs/search', SupportController.searchFAQs);

/**
 * @route GET /support/tickets
 * @desc Get support tickets
 * @access Private
 */
router.get('/tickets', auth.any, SupportController.getTickets);

/**
 * @route GET /support/tickets/:id
 * @desc Get ticket details
 * @access Private
 */
router.get('/tickets/:id', auth.any, SupportController.getTicketDetails);

/**
 * @route POST /support/tickets
 * @desc Create a support ticket
 * @access Private
 */
router.post('/tickets', auth.any, SupportController.createTicket);

/**
 * @route POST /support/tickets/:id/replies
 * @desc Add reply to a ticket
 * @access Private
 */
router.post('/tickets/:id/replies', auth.any, SupportController.replyToTicket);

/**
 * @route PUT /support/tickets/:id/close
 * @desc Close a support ticket
 * @access Private
 */
router.put('/tickets/:id/close', auth.any, SupportController.closeTicket);

/**
 * @route PUT /support/tickets/:id/reopen
 * @desc Reopen a support ticket
 * @access Private
 */
router.put('/tickets/:id/reopen', auth.any, SupportController.reopenTicket);

/**
 * @route POST /support/tickets/:id/attachments
 * @desc Upload attachment to a ticket
 * @access Private
 */
router.post(
  '/tickets/:id/attachments',
  auth.any,
  upload.single('file'),
  SupportController.uploadAttachment
);

/**
 * @route GET /support/common-issues
 * @desc Get common issues and solutions
 * @access Public
 */
router.get('/common-issues', SupportController.getCommonIssues);

/**
 * @route POST /support/feedback
 * @desc Send feedback about the app
 * @access Private
 */
router.post('/feedback', auth.any, SupportController.sendFeedback);

/**
 * @route GET /support/live-chat/availability
 * @desc Check if support is available for live chat
 * @access Public
 */
router.get('/live-chat/availability', SupportController.checkLiveChatAvailability);

/**
 * @route POST /support/live-chat/initiate
 * @desc Initiate a live chat session
 * @access Private
 */
router.post('/live-chat/initiate', auth.any, SupportController.initiateLiveChat);

module.exports = router;