// src/controllers/professional-onboarding.controller.js
const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const ProfessionalOnboardingService = require('../services/professional-onboarding.service');
const NotificationService = require('../services/notification.service');
const GeospatialService = require('../services/geospatial.service');
const logger = require('../config/logger');
const createError = require('http-errors');

class ProfessionalOnboardingController {
  /**
   * Initialize professional onboarding
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async initiateOnboarding(req, res) {
    try {
      const { email, name } = req.body;
      
      if (!email || !name) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: 'Name and email are required'
        });
      }
      
      const result = await ProfessionalOnboardingService.initiateOnboarding(
        req.user._id,
        { name, email }
      );
      
      res.status(200).json({
        success: true,
        message: 'Onboarding initialized successfully',
        professional: {
          id: result.professional._id,
          name: result.professional.name,
          email: result.professional.email,
          onboardingStep: result.professional.onboardingStep,
          status: result.professional.status
        }
      });
    } catch (error) {
      logger.error('Initiate onboarding error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to initialize onboarding',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Save onboarding progress
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async saveOnboardingProgress(req, res) {
    try {
      const { step, data } = req.body;
      
      if (!step || !data) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: 'Step and data are required'
        });
      }
      
      // Validate step
      const validSteps = ['personal_details', 'specializations', 'documents'];
      if (!validSteps.includes(step)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid step',
          details: `Step must be one of: ${validSteps.join(', ')}`
        });
      }
      
      const result = await ProfessionalOnboardingService.saveOnboardingProgress(
        req.user._id,
        step,
        data
      );
      
      res.status(200).json({
        success: true,
        message: 'Progress saved successfully',
        professional: {
          id: result.professional._id,
          name: result.professional.name,
          email: result.professional.email,
          onboardingStep: result.professional.onboardingStep,
          status: result.professional.status
        }
      });
    } catch (error) {
      logger.error('Save onboarding progress error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to save progress',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Upload document for verification
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async uploadDocument(req, res) {
    try {
      const { documentType } = req.body;
      const file = req.file;
      
      if (!documentType) {
        return res.status(400).json({
          success: false,
          error: 'Missing document type',
          details: 'Document type is required'
        });
      }
      
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          details: 'Please upload a document file'
        });
      }
      
      // Validate document type
      const validTypes = ['id_proof', 'address_proof', 'professional_certificate'];
      if (!validTypes.includes(documentType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid document type',
          details: `Document type must be one of: ${validTypes.join(', ')}`
        });
      }
      
      const result = await ProfessionalOnboardingService.uploadDocument(
        req.user._id,
        documentType,
        file
      );
      
      res.status(200).json({
        success: true,
        message: 'Document uploaded successfully',
        documentId: result.documentId,
        status: result.status
      });
    } catch (error) {
      logger.error('Upload document error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to upload document',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Verify document (admin only)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async verifyDocument(req, res) {
    try {
      const { professionalId, documentId, isValid, remarks } = req.body;
      
      if (!professionalId || !documentId || isValid === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: 'Professional ID, document ID, and isValid are required'
        });
      }
      
      const result = await ProfessionalOnboardingService.verifyDocument(
        professionalId,
        documentId,
        req.user._id,
        isValid,
        remarks
      );
      
      res.status(200).json({
        success: true,
        message: `Document ${isValid ? 'approved' : 'rejected'} successfully`,
        professional: {
          id: result.professional._id,
          name: result.professional.name,
          email: result.professional.email,
          onboardingStep: result.professional.onboardingStep,
          status: result.professional.status,
          documentsStatus: result.professional.documentsStatus
        }
      });
    } catch (error) {
      logger.error('Verify document error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to verify document',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get onboarding status
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getOnboardingStatus(req, res) {
    try {
      const result = await ProfessionalOnboardingService.getOnboardingStatus(req.user._id);
      
      res.status(200).json({
        success: true,
        onboardingStatus: result
      });
    } catch (error) {
      logger.error('Get onboarding status error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to get onboarding status',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get all professionals (admin only)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getProfessionals(req, res) {
    try {
      const { page = 1, limit = 10, search, status } = req.query;
      
      // Build the query
      const query = {};
      
      if (status && status !== 'all') {
        query.status = status;
      }
      
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { employeeId: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Count total documents
      const total = await Professional.countDocuments(query);
      
      // Find professionals with pagination
      const professionals = await Professional.find(query)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));
      
      res.status(200).json({
        success: true,
        professionals,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      });
    } catch (error) {
      logger.error('Get professionals error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get professionals',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get professional by ID
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getProfessionalById(req, res) {
    try {
      // Check if we're looking for a professional by their userId or their _id
      let professionalQuery = {};
      
      if (req.params.id) {
        // Check if the ID is a valid MongoDB ObjectId
        if (req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
          professionalQuery = { _id: req.params.id };
        } else {
          // If not a valid ObjectId, try to find by userId
          professionalQuery = { userId: req.params.id };
        }
      }
      
      const professional = await Professional.findOne(professionalQuery).select('-password');
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }
      
      // Access control: professionals can only see their own profiles
      if (req.userRole === 'professional' && professional._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          details: 'You can only view your own profile'
        });
      }
      
      res.status(200).json({
        success: true,
        professional
      });
    } catch (error) {
      logger.error('Get professional by ID error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get professional details',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Verify professional (admin only)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async verifyProfessional(req, res) {
    try {
      const { id } = req.params;
      const { status, remarks } = req.body;
      
      if (!status) {
        return res.status(400).json({
          success: false,
          error: 'Missing status',
          details: 'Status is required'
        });
      }
      
      // Validate status
      const validStatuses = ['verified', 'rejected', 'suspended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
          details: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }
      
      const professional = await Professional.findById(id);
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }
      
      // Update professional status
      professional.status = status;
      
      // If verifying, also update onboarding step to completed
      if (status === 'verified' && professional.onboardingStep !== 'completed') {
        professional.onboardingStep = 'completed';
      }
      
      // Generate employee ID if verified and doesn't have one
      if (status === 'verified' && !professional.employeeId) {
        const year = new Date().getFullYear().toString().substr(-2);
        const count = await Professional.countDocuments();
        professional.employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
      }
      
      await professional.save();
      
      // Send notification to professional
      await NotificationService.createNotification({
        recipient: professional._id,
        type: 'account_verification',
        title: `Account ${status === 'verified' ? 'Verified' : (status === 'rejected' ? 'Rejected' : 'Suspended')}`,
        message: remarks || `Your account has been ${status}`,
        data: { status }
      });
      
      res.status(200).json({
        success: true,
        message: `Professional ${status} successfully`,
        professional: {
          id: professional._id,
          name: professional.name,
          status: professional.status,
          employeeId: professional.employeeId
        }
      });
    } catch (error) {
      logger.error('Verify professional error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify professional',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Update professional availability
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateAvailability(req, res) {
    try {
      const { id } = req.params;
      const { isAvailable } = req.body;
      
      if (isAvailable === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing availability status',
          details: 'isAvailable is required'
        });
      }
      
      // Ensure professionals can only update their own availability
      if (req.userRole === 'professional' && id !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          details: 'You can only update your own availability'
        });
      }
      
      const professional = await Professional.findById(id);
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }
      
      // Ensure professional is verified before allowing availability updates
      if (professional.status !== 'verified') {
        return res.status(403).json({
          success: false,
          error: 'Account not verified',
          details: 'Your account must be verified to update availability'
        });
      }
      
      professional.isAvailable = isAvailable;
      await professional.save();
      
      res.status(200).json({
        success: true,
        message: `Availability updated to ${isAvailable ? 'available' : 'unavailable'}`,
        professional: {
          id: professional._id,
          name: professional.name,
          isAvailable: professional.isAvailable
        }
      });
    } catch (error) {
      logger.error('Update availability error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update availability',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get professionals by category
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getProfessionalsByCategory(req, res) {
    try {
      const { category } = req.params;
      const { page = 1, limit = 10 } = req.query;
      
      if (!category) {
        return res.status(400).json({
          success: false,
          error: 'Missing category',
          details: 'Category is required'
        });
      }
      
      // Count total documents
      const total = await Professional.countDocuments({
        specializations: category,
        status: 'verified',
        isAvailable: true
      });
      
      // Find professionals with pagination
      const professionals = await Professional.find({
        specializations: category,
        status: 'verified',
        isAvailable: true
      })
        .select('name phone email specializations userId')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));
      
      res.status(200).json({
        success: true,
        professionals,
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      });
    } catch (error) {
      logger.error('Get professionals by category error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get professionals by category',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get nearby professionals
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getNearbyProfessionals(req, res) {
    try {
      const { latitude, longitude, radius = 10, specializations } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing coordinates',
          details: 'Latitude and longitude are required'
        });
      }
      
      // Parse specializations if provided
      let specializationsArray = [];
      if (specializations) {
        specializationsArray = specializations.split(',');
      }
      
      const nearbyProfessionals = await GeospatialService.findNearbyProfessionals(
        [parseFloat(longitude), parseFloat(latitude)],
        parseFloat(radius),
        specializationsArray
      );
      
      res.status(200).json({
        success: true,
        professionals: nearbyProfessionals,
        total: nearbyProfessionals.length,
        radius: parseFloat(radius)
      });
    } catch (error) {
      logger.error('Get nearby professionals error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get nearby professionals',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new ProfessionalOnboardingController();