const express = require('express');
const router = express.Router();
const locationController = require('../controllers/location.controller');
const authMiddleware = require('../middleware/auth.middleware');
const auth = require('../middleware/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: Location Management
 *   description: API endpoints for managing user addresses and location
 * 
 * components:
 *   schemas:
 *     Address:
 *       type: object
 *       required:
 *         - houseNo
 *         - street
 *         - city
 *         - state
 *         - zipCode
 *       properties:
 *         houseNo:
 *           type: string
 *           description: House number or flat number
 *         street:
 *           type: string
 *           description: Street name
 *         landmark:
 *           type: string
 *           description: Nearby landmark (optional)
 *         city:
 *           type: string
 *           description: City name
 *         state:
 *           type: string
 *           description: State name
 *         zipCode:
 *           type: string
 *           description: Postal/ZIP code
 *         isDefault:
 *           type: boolean
 *           description: Whether this is the default address
 *           default: false
 *         addressType:
 *           type: string
 *           enum: [home, work, other]
 *           default: home
 *           description: Type of address
 * 
 *     CurrentLocation:
 *       type: object
 *       required:
 *         - latitude
 *         - longitude
 *       properties:
 *         latitude:
 *           type: number
 *           format: float
 *           description: Latitude coordinate
 *         longitude:
 *           type: number
 *           format: float
 *           description: Longitude coordinate
 */

/**
 * @swagger
 * /api/location/address:
 *   post:
 *     summary: Add a new address
 *     tags: [Location Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Address added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address added successfully
 *                 addresses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Address'
 *       400:
 *         description: Maximum address limit reached or invalid input
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/address', auth.user, locationController.addAddress);

/**
 * @swagger
 * /api/location/address/{addressId}:
 *   put:
 *     summary: Update an existing address
 *     tags: [Location Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the address to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Address'
 *     responses:
 *       200:
 *         description: Address updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address updated successfully
 *                 addresses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Address'
 *       404:
 *         description: Address not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put('/address/:addressId', authMiddleware, locationController.updateAddress);

/**
 * @swagger
 * /api/location/address/{addressId}:
 *   delete:
 *     summary: Delete an address
 *     tags: [Location Management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: addressId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the address to delete
 *     responses:
 *       200:
 *         description: Address deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Address deleted successfully
 *                 addresses:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Address'
 *                 newDefaultAddressId:
 *                   type: string
 *                   nullable: true
 *                   description: ID of the new default address if the deleted address was default
 *       404:
 *         description: Address not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete('/address/:addressId', authMiddleware, locationController.deleteAddress);

/**
 * @swagger
 * /api/location/current-location:
 *   post:
 *     summary: Update user's current location
 *     tags: [Location Management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CurrentLocation'
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
 *                 currentLocation:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       example: Point
 *                     coordinates:
 *                       type: array
 *                       items:
 *                         type: number
 *                       example: [72.8777, 19.0760]
 *                     lastUpdated:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/current-location', authMiddleware, locationController.updateCurrentLocation);

module.exports = router;