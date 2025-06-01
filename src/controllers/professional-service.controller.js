// const Service = require('../models/service.model');
// const logger = require('../config/logger');
// const createError = require('http-errors');

// class ProfessionalServiceController {
//   async createCustomService(req, res) {
//     try {
//       const { 
//         name, 
//         category, 
//         description, 
//         pricing, 
//         serviceDetails, 
//         customizationOptions 
//       } = req.body;

//       // Validate category matches professional's specialization
//       if (!req.user.specializations.includes(category)) {
//         return res.status(403).json({ 
//           error: 'Service category must match your specialization' 
//         });
//       }

//       const newService = new Service({
//         name,
//         category,
//         description,
//         pricing,
//         serviceDetails,
//         customizationOptions,
//         createdBy: req.user._id,
//         isActive: false // Requires admin approval
//       });

//       await newService.save();

//       res.status(201).json({
//         message: 'Custom service created and pending approval',
//         service: newService
//       });
//     } catch (error) {
//       logger.error('Error creating custom service', error);
//       res.status(500).json({ error: 'Failed to create custom service' });
//     }
//   }

//   async updateCustomService(req, res) {
//     try {
//       const { id } = req.params;
//       const updateData = req.body;

//       const existingService = await Service.findById(id);
      
//       if (!existingService) {
//         return res.status(404).json({ error: 'Service not found' });
//       }

//       // Ensure professional can only update their own services
//       if (existingService.createdBy.toString() !== req.user._id.toString()) {
//         return res.status(403).json({ error: 'Unauthorized to modify this service' });
//       }

//       const updatedService = await Service.findByIdAndUpdate(
//         id, 
//         { 
//           ...updateData, 
//           updatedAt: new Date(),
//           isActive: false // Requires re-approval after update
//         },
//         { new: true, runValidators: true }
//       );

//       res.json({
//         message: 'Service updated and pending re-approval',
//         service: updatedService
//       });
//     } catch (error) {
//       logger.error('Error updating custom service', error);
//       res.status(500).json({ error: 'Failed to update service' });
//     }
//   }

//   async listProfessionalServices(req, res) {
//     try {
//       const services = await Service.find({ 
//         createdBy: req.user._id 
//       }).sort({ createdAt: -1 });

//       res.json({
//         message: 'Professional services retrieved successfully',
//         services
//       });
//     } catch (error) {
//       logger.error('Error listing professional services', error);
//       res.status(500).json({ error: 'Failed to retrieve services' });
//     }
//   }
// }

// module.exports = new ProfessionalServiceController();
const Service = require('../models/service.model');
const logger = require('../config/logger');
const createError = require('http-errors');
const mongoose = require('mongoose');

class ProfessionalServiceController {
  async createCustomService(req, res) {
    try {
      console.log('👨‍🔧 [PROF-SERVICE] Creating custom service');
      console.log('👤 Professional:', req.user._id);
      
      const { 
        name,
        category,
        description,
        pricing,
        serviceDetails,
        customizationOptions 
      } = req.body;

      // Basic validation
      if (!name || !category || !pricing) {
        return res.status(400).json({
          error: 'Missing required fields: name, category, and pricing are required'
        });
      }

      // Validate category matches professional's specialization
      if (!req.user.specializations.includes(category)) {
        return res.status(403).json({
          error: 'Service category must match your specialization',
          allowedCategories: req.user.specializations
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
        professional: req.user._id, // Add professional reference
        isCustom: true, // Mark as custom service
        isActive: false // Requires admin approval
      });

      await newService.save();
      
      logger.info('Custom service created', { 
        serviceId: newService._id, 
        professionalId: req.user._id 
      });
      
      console.log('✅ Custom service created:', newService._id);

      res.status(201).json({
        success: true,
        message: 'Custom service created and pending approval',
        service: newService
      });
    } catch (error) {
      console.error('❌ Error creating custom service:', error);
      logger.error('Error creating custom service', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to create custom service',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async updateCustomService(req, res) {
    try {
      console.log('👨‍🔧 [PROF-SERVICE] Updating custom service:', req.params.id);
      
      const { id } = req.params;
      const updateData = req.body;

      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid service ID format' 
        });
      }

      const existingService = await Service.findById(id);
            
      if (!existingService) {
        return res.status(404).json({ 
          success: false,
          error: 'Service not found' 
        });
      }

      // Ensure professional can only update their own services
      if (existingService.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false,
          error: 'Unauthorized to modify this service' 
        });
      }

      // If category is being updated, validate it
      if (updateData.category && !req.user.specializations.includes(updateData.category)) {
        return res.status(403).json({
          success: false,
          error: 'Service category must match your specialization',
          allowedCategories: req.user.specializations
        });
      }

      const updatedService = await Service.findByIdAndUpdate(
        id,
        {
          ...updateData,
          updatedAt: new Date(),
          updatedBy: req.user._id,
          isActive: false // Requires re-approval after update
        },
        { new: true, runValidators: true }
      );

      logger.info('Custom service updated', { 
        serviceId: id, 
        professionalId: req.user._id 
      });
      
      console.log('✅ Custom service updated:', id);

      res.json({
        success: true,
        message: 'Service updated and pending re-approval',
        service: updatedService
      });
    } catch (error) {
      console.error('❌ Error updating custom service:', error);
      logger.error('Error updating custom service', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to update service',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  async listProfessionalServices(req, res) {
    try {
      console.log('👨‍🔧 [PROF-SERVICE] Listing services for professional:', req.user._id);
      
      const { category, status, page = 1, limit = 10 } = req.query;
      
      // Build query filters
      const filter = {
        createdBy: req.user._id
      };
      
      if (category && category !== 'all') {
        filter.category = category;
      }
      
      if (status && status !== 'all') {
        filter.isActive = status === 'active';
      }
      
      console.log('🔍 Filter applied:', JSON.stringify(filter));
      
      // Calculate pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      // Count total services
      const total = await Service.countDocuments(filter);
      
      // Get services with pagination
      const services = await Service.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
      
      console.log('✅ Found', services.length, 'services');

      res.json({
        success: true,
        message: 'Professional services retrieved successfully',
        services,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('❌ Error listing professional services:', error);
      logger.error('Error listing professional services', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to retrieve services',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Delete a custom service - MISSING METHOD ADDED
   */
  async deleteCustomService(req, res) {
    try {
      console.log('👨‍🔧 [PROF-SERVICE] Deleting custom service:', req.params.id);
      
      const { id } = req.params;

      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid service ID format' 
        });
      }

      const service = await Service.findById(id);
      
      if (!service) {
        return res.status(404).json({ 
          success: false,
          error: 'Service not found' 
        });
      }

      // Ensure professional can only delete their own services
      if (service.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false,
          error: 'Unauthorized to delete this service' 
        });
      }

      // Check if service is being used in active bookings
      const Booking = require('../models/booking.model');
      const activeBookings = await Booking.countDocuments({
        service: id,
        status: { $in: ['pending', 'accepted', 'in_progress'] }
      });

      if (activeBookings > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete service with active bookings',
          activeBookings
        });
      }

      await Service.findByIdAndDelete(id);

      logger.info('Custom service deleted', { 
        serviceId: id, 
        professionalId: req.user._id 
      });
      
      console.log('✅ Custom service deleted:', id);

      res.json({
        success: true,
        message: 'Service deleted successfully',
        deletedService: {
          _id: service._id,
          name: service.name
        }
      });
    } catch (error) {
      console.error('❌ Error deleting custom service:', error);
      logger.error('Error deleting custom service', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to delete service',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Toggle service availability - MISSING METHOD ADDED
   */
  async toggleServiceAvailability(req, res) {
    try {
      console.log('👨‍🔧 [PROF-SERVICE] Toggling service availability:', req.params.id);
      
      const { id } = req.params;

      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid service ID format' 
        });
      }

      const service = await Service.findById(id);
      
      if (!service) {
        return res.status(404).json({ 
          success: false,
          error: 'Service not found' 
        });
      }

      // Ensure professional can only modify their own services
      if (service.createdBy.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false,
          error: 'Unauthorized to modify this service' 
        });
      }

      // Toggle the isActive status
      const updatedService = await Service.findByIdAndUpdate(
        id,
        {
          isActive: !service.isActive,
          updatedAt: new Date(),
          updatedBy: req.user._id
        },
        { new: true }
      );

      logger.info('Service availability toggled', { 
        serviceId: id,
        newStatus: updatedService.isActive,
        professionalId: req.user._id 
      });
      
      console.log('✅ Service availability toggled:', id, 'Active:', updatedService.isActive);

      res.json({
        success: true,
        message: `Service ${updatedService.isActive ? 'activated' : 'deactivated'} successfully`,
        service: updatedService
      });
    } catch (error) {
      console.error('❌ Error toggling service availability:', error);
      logger.error('Error toggling service availability', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to toggle service availability',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get a single custom service by ID - ADDITIONAL METHOD
   */
  async getCustomService(req, res) {
    try {
      console.log('👨‍🔧 [PROF-SERVICE] Getting custom service:', req.params.id);
      
      const { id } = req.params;

      // Validate MongoDB ObjectID
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid service ID format' 
        });
      }

      const service = await Service.findOne({
        _id: id,
        createdBy: req.user._id
      });

      if (!service) {
        return res.status(404).json({ 
          success: false,
          error: 'Service not found' 
        });
      }

      console.log('✅ Custom service found:', service._id);

      res.json({
        success: true,
        service
      });
    } catch (error) {
      console.error('❌ Error fetching custom service:', error);
      logger.error('Error fetching custom service', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to fetch service',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get service statistics for professional - BONUS METHOD
   */
  async getServiceStats(req, res) {
    try {
      console.log('👨‍🔧 [PROF-SERVICE] Getting service stats for:', req.user._id);
      
      const totalServices = await Service.countDocuments({ createdBy: req.user._id });
      const activeServices = await Service.countDocuments({ 
        createdBy: req.user._id, 
        isActive: true 
      });
      const pendingServices = await Service.countDocuments({ 
        createdBy: req.user._id, 
        isActive: false 
      });

      // Get services by category
      const servicesByCategory = await Service.aggregate([
        { $match: { createdBy: req.user._id } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);

      console.log('✅ Service stats calculated');

      res.json({
        success: true,
        message: 'Service statistics retrieved',
        stats: {
          total: totalServices,
          active: activeServices,
          pending: pendingServices,
          byCategory: servicesByCategory
        }
      });
    } catch (error) {
      console.error('❌ Error getting service stats:', error);
      logger.error('Error getting service stats', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to get service statistics'
      });
    }
  }
}

module.exports = new ProfessionalServiceController();
