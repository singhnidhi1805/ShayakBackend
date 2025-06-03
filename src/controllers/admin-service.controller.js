const Service = require('../models/service.model');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const Joi = require('joi');

// Validation schema for service creation/updating
const serviceSchema = Joi.object({
  name: Joi.string().required().trim().min(3).max(100),
  category: Joi.string().required().valid(
    'plumbing', 
    'electrical', 
    'carpentry', 
    'cleaning', 
    'painting',
    'landscaping',
    'moving',
    'pest_control',
    'appliance_repair',
    'hvac',
    'tiling'
  ),
  description: Joi.string().allow('').trim().max(1000),
  pricing: Joi.object({
    type: Joi.string().valid('fixed', 'range', 'hourly').required(),
    amount: Joi.when('type', {
      is: Joi.valid('fixed', 'hourly'),
      then: Joi.number().min(0).required(),
      otherwise: Joi.number().min(0)
    }),
    minAmount: Joi.when('type', {
      is: 'range',
      then: Joi.number().min(0).required(),
      otherwise: Joi.number().min(0)
    }),
    maxAmount: Joi.when('type', {
      is: 'range',
      then: Joi.number().min(Joi.ref('minAmount')).required(),
      otherwise: Joi.number().min(0)
    })
  }).required(),
  serviceDetails: Joi.array().items(
    Joi.object({
      title: Joi.string().trim().allow(''),
      description: Joi.string().trim().allow('')
    })
  ),
  customizationOptions: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().allow(''),
      options: Joi.array().items(Joi.string()),
      additionalPrice: Joi.number().min(0)
    })
  ),
  isActive: Joi.boolean().default(true)
});

class AdminServiceController {
  /**
   * Create a new service template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async createServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Creating service template');
      console.log('📊 Request body:', JSON.stringify(req.body, null, 2));
      
      // Ensure category field is present and in the correct format
      if (!req.body.category) {
        return res.status(400).json({ 
          error: 'Missing required field', 
          details: 'Category is required' 
        });
      }
      
      // Validate request body
      const { error, value } = serviceSchema.validate(req.body);
      
      if (error) {
        console.log('❌ Validation error details:', error.details);
        logger.warn('Service template validation failed', { error: error.details });
        return res.status(400).json({ 
          error: 'Invalid service data', 
          details: error.details[0].message 
        });
      }
      
      // Create service with validated data
      const newTemplate = new Service({
        ...value,
        createdBy: req.user._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('💾 Service to be saved:', JSON.stringify(newTemplate, null, 2));
      
      await newTemplate.save();
      
      logger.info('Service template created successfully', { 
        serviceId: newTemplate._id,
        adminId: req.user._id 
      });
      
      console.log('✅ Service template created:', newTemplate._id);
      
      res.status(201).json({
        success: true,
        message: 'Service template created successfully',
        service: newTemplate
      });
    } catch (error) {
      console.error('❌ Error creating service template:', error);
      logger.error('Error creating service template', { error });
      
      if (error.name === 'ValidationError') {
        return res.status(400).json({ 
          error: 'Service validation failed', 
          details: error.message 
        });
      }
      
      if (error.name === 'MongoServerError' && error.code === 11000) {
        return res.status(409).json({ 
          error: 'A service with that name already exists' 
        });
      }
      
      res.status(500).json({ 
        error: 'Failed to create service template', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update an existing service template
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Updating service template:', req.params.id);
      
      const { id } = req.params;
      
      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
      // Validate request body
      const { error, value } = serviceSchema.validate(req.body);
      
      if (error) {
        logger.warn('Service template validation failed', { error: error.details });
        return res.status(400).json({ 
          error: 'Invalid service data', 
          details: error.details[0].message 
        });
      }
      
      const updatedTemplate = await Service.findByIdAndUpdate(
        id,
        {
          ...value,
          updatedBy: req.user._id,
          updatedAt: new Date()
        },
        { new: true, runValidators: true }
      );
      
      if (!updatedTemplate) {
        return res.status(404).json({ error: 'Service template not found' });
      }
      
      logger.info('Service template updated successfully', { 
        serviceId: updatedTemplate._id,
        adminId: req.user._id 
      });
      
      console.log('✅ Service template updated:', updatedTemplate._id);
      
      res.json({
        success: true,
        message: 'Service template updated successfully',
        service: updatedTemplate
      });
    } catch (error) {
      logger.error('Error updating service template', { error, serviceId: req.params.id });
      res.status(500).json({ 
        error: 'Failed to update service template',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get a single service template by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async getServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Getting service template:', req.params.id);
      
      const { id } = req.params;
      
      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
      const service = await Service.findById(id);
      
      if (!service) {
        return res.status(404).json({ error: 'Service template not found' });
      }
      
      console.log('✅ Service template found:', service._id);
      
      res.json({
        success: true,
        service
      });
    } catch (error) {
      logger.error('Error fetching service template', { error, serviceId: req.params.id });
      res.status(500).json({ error: 'Failed to fetch service template' });
    }
  }

  /**
   * List all service templates with filtering options
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async listServiceTemplates(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Listing service templates');
      
      const { category, status, search, page = 1, limit = 10 } = req.query;
      
      // Build query filters
      const filter = {};
      
      if (category && category !== 'all') {
        filter.category = category;
      }
      
      if (status && status !== 'all') {
        filter.isActive = status === 'active';
      }
      
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      console.log('🔍 Filter applied:', JSON.stringify(filter));
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Count total templates matching the filter
      const total = await Service.countDocuments(filter);
      
      // Get templates with pagination
      const templates = await Service.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      console.log('✅ Found', templates.length, 'service templates');
      
      res.json({
        success: true,
        message: 'Service templates retrieved successfully',
        templates,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error listing service templates', { error });
      res.status(500).json({ error: 'Failed to retrieve service templates' });
    }
  }

  /**
   * Delete a service template - MISSING METHOD ADDED
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async deleteServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Deleting service template:', req.params.id);
      
      const { id } = req.params;
      
      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
      const deletedTemplate = await Service.findByIdAndDelete(id);
      
      if (!deletedTemplate) {
        return res.status(404).json({ error: 'Service template not found' });
      }
      
      logger.info('Service template deleted successfully', { 
        serviceId: id,
        adminId: req.user._id 
      });
      
      console.log('✅ Service template deleted:', id);
      
      res.json({
        success: true,
        message: 'Service template deleted successfully',
        deletedService: {
          _id: deletedTemplate._id,
          name: deletedTemplate.name
        }
      });
    } catch (error) {
      console.error('❌ Error deleting service template:', error);
      logger.error('Error deleting service template', { error, serviceId: req.params.id });
      res.status(500).json({ 
        error: 'Failed to delete service template',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Update the status of a service template (active/inactive)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async updateServiceStatus(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Updating service status:', req.params.id);
      
      const { id } = req.params;
      const { isActive } = req.body;
      
      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
      // Validate isActive parameter
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ error: 'isActive must be a boolean value' });
      }
      
      const updatedTemplate = await Service.findByIdAndUpdate(
        id,
        {
          isActive,
          updatedBy: req.user._id,
          updatedAt: new Date()
        },
        { new: true }
      );
      
      if (!updatedTemplate) {
        return res.status(404).json({ error: 'Service template not found' });
      }
      
      logger.info('Service template status updated', { 
        serviceId: id, 
        status: isActive ? 'active' : 'inactive',
        adminId: req.user._id 
      });
      
      console.log('✅ Service status updated:', id, 'Active:', isActive);
      
      res.json({
        success: true,
        message: `Service template ${isActive ? 'activated' : 'deactivated'} successfully`,
        service: updatedTemplate
      });
    } catch (error) {
      logger.error('Error updating service status', { error, serviceId: req.params.id });
      res.status(500).json({ error: 'Failed to update service status' });
    }
  }
}

module.exports = new AdminServiceController();