const Service = require('../models/service.model');
const logger = require('../config/logger');
const mongoose = require('mongoose');
const Joi = require('joi');
const fs = require('fs');
const path = require('path');

// ✅ Helper function to get full image URL
const getFullImageUrl = (imagePath, req) => {
  if (!imagePath) return null;
  
  // If already a full URL, return as is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Remove leading slash if present
  const cleanPath = imagePath.startsWith('/') ? imagePath.substring(1) : imagePath;
  
  // Get base URL from environment or request
  const baseUrl = process.env.BASE_URL || 
                  process.env.API_URL || 
                  `${req.protocol}://${req.get('host')}`;
  
  return `${baseUrl}/${cleanPath}`;
};

// ✅ Transform service to include full image URL
const transformServiceResponse = (service, req) => {
  if (!service) return null;
  
  const serviceObj = service.toObject ? service.toObject() : service;
  
  if (serviceObj.image) {
    serviceObj.imageUrl = getFullImageUrl(serviceObj.image, req);
  }
  
  return serviceObj;
};

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
  image: Joi.string().allow(''),
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
   */
  async createServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Creating service template');
      
      const parsedBody = { ...req.body };
      
      if (typeof parsedBody.pricing === 'string') {
        parsedBody.pricing = JSON.parse(parsedBody.pricing);
      }
      
      if (typeof parsedBody.serviceDetails === 'string') {
        parsedBody.serviceDetails = JSON.parse(parsedBody.serviceDetails);
      }
      
      if (typeof parsedBody.customizationOptions === 'string') {
        parsedBody.customizationOptions = JSON.parse(parsedBody.customizationOptions);
      }
      
      if (req.file) {
        parsedBody.image = `/uploads/services/${req.file.filename}`;
      }
      
      if (!parsedBody.category) {
        return res.status(400).json({ 
          error: 'Missing required field', 
          details: 'Category is required' 
        });
      }
      
      const { error, value } = serviceSchema.validate(parsedBody);
      
      if (error) {
        console.log('❌ Validation error details:', error.details);
        
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        
        return res.status(400).json({ 
          error: 'Invalid service data', 
          details: error.details[0].message 
        });
      }
      
      const newTemplate = new Service({
        ...value,
        createdBy: req.user._id,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      await newTemplate.save();
      
      logger.info('Service template created successfully', { 
        serviceId: newTemplate._id,
        adminId: req.user._id 
      });
      
      // ✅ Transform response with full image URL
      const transformedService = transformServiceResponse(newTemplate, req);
      
      res.status(201).json({
        success: true,
        message: 'Service template created successfully',
        service: transformedService
      });
    } catch (error) {
      console.error('❌ Error creating service template:', error);
      
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
      
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
   */
  async updateServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Updating service template:', req.params.id);
      
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
      const parsedBody = { ...req.body };
      
      if (typeof parsedBody.pricing === 'string') {
        parsedBody.pricing = JSON.parse(parsedBody.pricing);
      }
      
      if (typeof parsedBody.serviceDetails === 'string') {
        parsedBody.serviceDetails = JSON.parse(parsedBody.serviceDetails);
      }
      
      if (typeof parsedBody.customizationOptions === 'string') {
        parsedBody.customizationOptions = JSON.parse(parsedBody.customizationOptions);
      }
      
      if (req.file) {
        const oldService = await Service.findById(id);
        if (oldService && oldService.image) {
          const oldImagePath = path.join(__dirname, '..', oldService.image);
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
          }
        }
        
        parsedBody.image = `/uploads/services/${req.file.filename}`;
      }
      
      const { error, value } = serviceSchema.validate(parsedBody);
      
      if (error) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        
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
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(404).json({ error: 'Service template not found' });
      }
      
      logger.info('Service template updated successfully', { 
        serviceId: updatedTemplate._id,
        adminId: req.user._id 
      });
      
      // ✅ Transform response with full image URL
      const transformedService = transformServiceResponse(updatedTemplate, req);
      
      res.json({
        success: true,
        message: 'Service template updated successfully',
        service: transformedService
      });
    } catch (error) {
      logger.error('Error updating service template', { error, serviceId: req.params.id });
      
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting file:', unlinkError);
        }
      }
      
      res.status(500).json({ 
        error: 'Failed to update service template',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get a single service template by ID
   */
  async getServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Getting service template:', req.params.id);
      
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
      const service = await Service.findById(id);
      
      if (!service) {
        return res.status(404).json({ error: 'Service template not found' });
      }
      
      // ✅ Transform response with full image URL
      const transformedService = transformServiceResponse(service, req);
      
      res.json({
        success: true,
        service: transformedService
      });
    } catch (error) {
      logger.error('Error fetching service template', { error, serviceId: req.params.id });
      res.status(500).json({ error: 'Failed to fetch service template' });
    }
  }

  /**
   * List all service templates with filtering options
   */
  async listServiceTemplates(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Listing service templates');
      
      const { category, status, search, page = 1, limit = 10 } = req.query;
      
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
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await Service.countDocuments(filter);
      
      const templates = await Service.find(filter)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      // ✅ Transform all services with full image URLs
      const transformedTemplates = templates.map(template => 
        transformServiceResponse(template, req)
      );
      
      res.json({
        success: true,
        message: 'Service templates retrieved successfully',
        templates: transformedTemplates,
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
   * Delete a service template
   */
  async deleteServiceTemplate(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Deleting service template:', req.params.id);
      
      const { id } = req.params;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
      const deletedTemplate = await Service.findByIdAndDelete(id);
      
      if (!deletedTemplate) {
        return res.status(404).json({ error: 'Service template not found' });
      }
      
      if (deletedTemplate.image) {
        const imagePath = path.join(__dirname, '..', deletedTemplate.image);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
      
      logger.info('Service template deleted successfully', { 
        serviceId: id,
        adminId: req.user._id 
      });
      
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
   */
  async updateServiceStatus(req, res) {
    try {
      console.log('🔧 [ADMIN-SERVICE] Updating service status:', req.params.id);
      
      const { id } = req.params;
      const { isActive } = req.body;
      
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid service ID format' });
      }
      
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
      
      // ✅ Transform response with full image URL
      const transformedService = transformServiceResponse(updatedTemplate, req);
      
      res.json({
        success: true,
        message: `Service template ${isActive ? 'activated' : 'deactivated'} successfully`,
        service: transformedService
      });
    } catch (error) {
      logger.error('Error updating service status', { error, serviceId: req.params.id });
      res.status(500).json({ error: 'Failed to update service status' });
    }
  }
}

module.exports = new AdminServiceController();