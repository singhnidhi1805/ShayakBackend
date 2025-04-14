/**
 * @swagger
 * tags:
 *   name: Services
 *   description: API to manage Services
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const { 
  createService, 
  getServices, 
  updateService,
  getServicesByCategory,
  getServiceDetails,
  getTopRatedServices,
  searchServices
} = require('../controllers/service.controller');

// Enhanced service controller with new features
const multer = require('multer');
const storage = multer.diskStorage({
  destination: 'uploads/services',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

/**
 * @swagger
 * /api/services/search:
 *   get:
 *     tags:
 *       - Services
 *     summary: Search for services
 *     parameters:
 *       - in: query
 *         name: query
 *         description: Search term to match services
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of services matching the search query
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       500:
 *         description: Server error
 */
router.get('/search', searchServices);

/**
 * @swagger
 * /api/services/top-rated:
 *   get:
 *     tags:
 *       - Services
 *     summary: Get top-rated services
 *     responses:
 *       200:
 *         description: A list of top-rated services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       500:
 *         description: Server error
 */
router.get('/top-rated', getTopRatedServices);

/**
 * @swagger
 * /api/services/category/{category}:
 *   get:
 *     tags:
 *       - Services
 *     summary: Get services by category
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         description: Category of the services to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: A list of services in the specified category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       500:
 *         description: Server error
 */
router.get('/category/:category', getServicesByCategory);

/**
 * @swagger
 * /api/services/{id}:
 *   get:
 *     tags:
 *       - Services
 *     summary: Get service details by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the service
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */
router.get('/:id', getServiceDetails);

/**
 * @swagger
 * /api/services:
 *   get:
 *     tags:
 *       - Services
 *     summary: Get all services with optional filters
 *     parameters:
 *       - in: query
 *         name: category
 *         description: Filter services by category
 *         schema:
 *           type: string
 *       - in: query
 *         name: minPrice
 *         description: Minimum price of the service
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxPrice
 *         description: Maximum price of the service
 *         schema:
 *           type: number
 *       - in: query
 *         name: sort
 *         description: Sorting option for services (price_asc, price_desc, rating)
 *         schema:
 *           type: string
 *           enum:
 *             - price_asc
 *             - price_desc
 *             - rating
 *     responses:
 *       200:
 *         description: A list of services
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Service'
 *       500:
 *         description: Server error
 */
router.get('/', getServices);

// Protected routes
/**
 * @swagger
 * /api/services:
 *   post:
 *     tags:
 *       - Services
 *     summary: Create a new service
 *     parameters:
 *       - in: body
 *         name: service
 *         description: Service details to create
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/Service'
 *     responses:
 *       201:
 *         description: Service created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Invalid data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/', auth, upload.single('image'), createService);

/**
 * @swagger
 * /api/services/{id}:
 *   put:
 *     tags:
 *       - Services
 *     summary: Update service details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the service to update
 *         schema:
 *           type: string
 *       - in: body
 *         name: service
 *         description: Service details to update
 *         required: true
 *         schema:
 *           $ref: '#/components/schemas/Service'
 *     responses:
 *       200:
 *         description: Service updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Service'
 *       400:
 *         description: Invalid data
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */
router.put('/:id', auth, upload.single('image'), updateService);

/**
 * @swagger
 * /api/services/{id}:
 *   delete:
 *     tags:
 *       - Services
 *     summary: Delete a service
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the service to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *       404:
 *         description: Service not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
