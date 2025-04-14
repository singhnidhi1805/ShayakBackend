const Service = require('../models/service.model');
const logger = require('../config/logger');
const createError = require('http-errors');

class ProfessionalServiceController {
  async createCustomService(req, res) {
    try {
      const { 
        name, 
        category, 
        description, 
        pricing, 
        serviceDetails, 
        customizationOptions 
      } = req.body;

      // Validate category matches professional's specialization
      if (!req.user.specializations.includes(category)) {
        return res.status(403).json({ 
          error: 'Service category must match your specialization' 
        });
      }

      const newService = new Service({
        name,
        category,
        description,
        pricing,
        serviceDetails,
        customizationOptions,
        createdBy: req.user._id,
        isActive: false // Requires admin approval
      });

      await newService.save();

      res.status(201).json({
        message: 'Custom service created and pending approval',
        service: newService
      });
    } catch (error) {
      logger.error('Error creating custom service', error);
      res.status(500).json({ error: 'Failed to create custom service' });
    }
  }

  async updateCustomService(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingService = await Service.findById(id);
      
      if (!existingService) {
        return res.status(404).json({ error: 'Service not found' });
      }

      // Ensure professional can only update their own services
      if (existingService.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Unauthorized to modify this service' });
      }

      const updatedService = await Service.findByIdAndUpdate(
        id, 
        { 
          ...updateData, 
          updatedAt: new Date(),
          isActive: false // Requires re-approval after update
        },
        { new: true, runValidators: true }
      );

      res.json({
        message: 'Service updated and pending re-approval',
        service: updatedService
      });
    } catch (error) {
      logger.error('Error updating custom service', error);
      res.status(500).json({ error: 'Failed to update service' });
    }
  }

  async listProfessionalServices(req, res) {
    try {
      const services = await Service.find({ 
        createdBy: req.user._id 
      }).sort({ createdAt: -1 });

      res.json({
        message: 'Professional services retrieved successfully',
        services
      });
    } catch (error) {
      logger.error('Error listing professional services', error);
      res.status(500).json({ error: 'Failed to retrieve services' });
    }
  }
}

module.exports = new ProfessionalServiceController();