// src/routes/schedule.routes.js - COMPLETE FIXED VERSION
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const scheduleController = require('../controllers/schedule.controller'); // FIXED: No 'new' keyword needed

// All routes require professional authentication
router.use(auth(['professional']));

/**
 * @swagger
 * /api/professional/schedule:
 *   get:
 *     summary: Get professional's schedule for a specific date
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format
 *     responses:
 *       200:
 *         description: Schedule retrieved successfully
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Server error
 */
router.get('/', scheduleController.getSchedule);

/**
 * @swagger
 * /api/professional/schedule/appointments:
 *   get:
 *     summary: Get appointments within a date range
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Appointments retrieved successfully
 */
router.get('/appointments', scheduleController.getAppointments);

/**
 * @swagger
 * /api/professional/schedule/block:
 *   post:
 *     summary: Block time slots
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *               - startTime
 *               - endTime
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               startTime:
 *                 type: string
 *                 example: "14:00"
 *               endTime:
 *                 type: string
 *                 example: "15:00"
 *               reason:
 *                 type: string
 *                 enum: [break, lunch, personal, blocked, holiday]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Time blocked successfully
 */
router.post('/block', scheduleController.blockTime);

/**
 * @swagger
 * /api/professional/schedule/block/{blockId}:
 *   delete:
 *     summary: Remove a time block
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: blockId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Time block removed successfully
 */
router.delete('/block/:blockId', scheduleController.removeTimeBlock);

/**
 * @swagger
 * /api/professional/schedule/working-hours:
 *   post:
 *     summary: Update working hours
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - startTime
 *               - endTime
 *             properties:
 *               startTime:
 *                 type: string
 *                 example: "09:00"
 *               endTime:
 *                 type: string
 *                 example: "18:00"
 *               isWorkingDay:
 *                 type: boolean
 *                 example: true
 *               applyToAll:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       200:
 *         description: Working hours updated successfully
 *   get:
 *     summary: Get working hours
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Working hours retrieved successfully
 */
router.post('/working-hours', scheduleController.updateWorkingHours);
router.get('/working-hours', scheduleController.getWorkingHours);

/**
 * @swagger
 * /api/professional/schedule/holiday:
 *   post:
 *     summary: Set holiday
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - date
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-15"
 *               reason:
 *                 type: string
 *                 example: "Personal holiday"
 *               isHoliday:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Holiday set successfully
 *   get:
 *     summary: Get holidays
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Holidays retrieved successfully
 */
router.post('/holiday', scheduleController.setHoliday);
router.get('/holiday', scheduleController.getHolidays); // FIXED: Changed from '/holiday' to '/holidays'
router.delete('/holiday/:holidayId', scheduleController.removeHoliday);

/**
 * @swagger
 * /api/professional/schedule/check-availability:
 *   get:
 *     summary: Check availability for a time slot
 *     tags: [Schedule]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-06-08"
 *       - in: query
 *         name: startTime
 *         required: true
 *         schema:
 *           type: string
 *         example: "10:00"
 *       - in: query
 *         name: endTime
 *         required: true
 *         schema:
 *           type: string
 *         example: "11:00"
 *     responses:
 *       200:
 *         description: Availability status retrieved successfully
 */
router.get('/check-availability', scheduleController.checkAvailability);

module.exports = router;