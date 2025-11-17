// src/controllers/professional-onboarding.controller.js
const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const ProfessionalOnboardingService = require('../services/professional-onboarding.service');
// const NotificationService = require('../services/notification.service'); // Comment if not available
// const GeospatialService = require('../services/geospatial.service'); // Comment if not available
const logger = require('../config/logger');
const createError = require('http-errors');
const { generatePresignedUrls } = require('../utils/fileUpload');

class ProfessionalOnboardingController {
  /**
   * Initialize professional onboarding
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async initiateOnboarding(req, res) {
    try {
      console.log('🚀 [ONBOARD] Initiating onboarding for user:', req.user._id);
      
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
      
      console.log('✅ [ONBOARD] Onboarding initiated successfully:', result.professional._id);
      
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
      console.error('❌ [ONBOARD] Error initiating onboarding:', error);
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
      console.log('💾 [ONBOARD] Saving onboarding progress for user:', req.user._id);
      
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
      
      console.log('✅ [ONBOARD] Progress saved successfully for step:', step);
      
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
      console.error('❌ [ONBOARD] Error saving progress:', error);
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
      console.log('📄 [ONBOARD] Uploading document for user:', req.user._id);
      
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
      
      console.log('✅ [ONBOARD] Document uploaded successfully:', result.documentId);
      
      res.status(200).json({
        success: true,
        message: 'Document uploaded successfully',
        documentId: result.documentId,
        status: result.status
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error uploading document:', error);
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
      console.log('✅ [ONBOARD] Admin verifying document:', req.body.documentId);
      
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
      
      console.log('✅ [ONBOARD] Document verification completed:', isValid ? 'approved' : 'rejected');
      
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
      console.error('❌ [ONBOARD] Error verifying document:', error);
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
      console.log('📊 [ONBOARD] Getting onboarding status for user:', req.user._id);
      
      const result = await ProfessionalOnboardingService.getOnboardingStatus(req.user._id);
      
      console.log('✅ [ONBOARD] Onboarding status retrieved');
      
      res.status(200).json({
        success: true,
        onboardingStatus: result
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error getting onboarding status:', error);
      logger.error('Get onboarding status error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to get onboarding status',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Complete onboarding process - MISSING METHOD ADDED
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async completeOnboarding(req, res) {
    try {
      console.log('🎯 [ONBOARD] Completing onboarding for user:', req.user._id);
      
      const result = await ProfessionalOnboardingService.completeOnboarding(req.user._id);
      
      console.log('✅ [ONBOARD] Onboarding completed successfully');
      
      res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully',
        professional: {
          id: result.professional._id,
          name: result.professional.name,
          status: result.professional.status,
          onboardingStep: result.professional.onboardingStep
        }
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error completing onboarding:', error);
      logger.error('Complete onboarding error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to complete onboarding',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get documents for professional with pre-signed URLs
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getDocuments(req, res) {
    try {
      console.log('📋 [ONBOARD] Getting documents for user:', req.user._id);
      
      const professional = await Professional.findById(req.user._id).select('documents name email');
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }

      // Convert to plain object
      const professionalObj = professional.toObject();
      
      // Generate pre-signed URLs for all documents (valid for 1 hour)
      if (professionalObj.documents && professionalObj.documents.length > 0) {
        professionalObj.documents = await generatePresignedUrls(
          professionalObj.documents.map(doc => ({
            ...doc,
            _id: doc._id.toString()
          })),
          3600 // 1 hour expiration
        );
      }
      
      console.log('✅ [ONBOARD] Documents retrieved:', professionalObj.documents?.length || 0);
      
      res.status(200).json({
        success: true,
        documents: professionalObj.documents || [],
        professional: {
          id: professionalObj._id,
          name: professionalObj.name,
          email: professionalObj.email
        }
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error getting documents:', error);
      logger.error('Get documents error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get documents',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

/**
   * Delete uploaded document
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async deleteDocument(req, res) {
    try {
      console.log('🗑️ [ONBOARD] Deleting document:', req.params.documentId);
      
      const { documentId } = req.params;
      
      if (!documentId) {
        return res.status(400).json({
          success: false,
          error: 'Document ID is required'
        });
      }
      
      const result = await ProfessionalOnboardingService.deleteDocument(req.user._id, documentId);
      
      console.log('✅ [ONBOARD] Document deleted successfully');
      
      res.status(200).json({
        success: true,
        message: 'Document deleted successfully',
        documentId: documentId
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error deleting document:', error);
      logger.error('Delete document error:', error);
      res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Failed to delete document',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }



  /**
   * Get pending professionals for admin review - MISSING METHOD ADDED
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getPendingProfessionals(req, res) {
    try {
      console.log('📋 [ONBOARD] Admin getting pending professionals');
      
      const { page = 1, limit = 10 } = req.query;
      
      // Count total pending professionals
      const total = await Professional.countDocuments({ 
        status: { $in: ['under_review', 'pending'] } 
      });
      
      // Get pending professionals with pagination
      const professionals = await Professional.find({ 
        status: { $in: ['under_review', 'pending'] } 
      })
        .select('name email phone onboardingStep documentsStatus createdAt')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));
      
      console.log('✅ [ONBOARD] Found', professionals.length, 'pending professionals');
      
      res.status(200).json({
        success: true,
        professionals,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error getting pending professionals:', error);
      logger.error('Get pending professionals error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pending professionals',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Approve professional - MISSING METHOD ADDED
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async approveProfessional(req, res) {
    try {
      console.log('✅ [ONBOARD] Admin approving professional:', req.params.professionalId);
      
      const { professionalId } = req.params;
      const { remarks } = req.body;
      
      const professional = await Professional.findById(professionalId);
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }
      
      // Update professional status
      professional.status = 'verified';
      professional.onboardingStep = 'completed';
      
      // Generate employee ID if doesn't exist
      if (!professional.employeeId) {
        const year = new Date().getFullYear().toString().substr(-2);
        const count = await Professional.countDocuments();
        professional.employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
      }
      
      await professional.save();
      
      console.log('✅ [ONBOARD] Professional approved successfully:', professional.employeeId);
      
      res.status(200).json({
        success: true,
        message: 'Professional approved successfully',
        professional: {
          id: professional._id,
          name: professional.name,
          status: professional.status,
          employeeId: professional.employeeId
        }
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error approving professional:', error);
      logger.error('Approve professional error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve professional',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Reject professional - MISSING METHOD ADDED
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async rejectProfessional(req, res) {
    try {
      console.log('❌ [ONBOARD] Admin rejecting professional:', req.params.professionalId);
      
      const { professionalId } = req.params;
      const { reason } = req.body;
      
      const professional = await Professional.findById(professionalId);
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }
      
      // Update professional status
      professional.status = 'rejected';
      professional.rejectionReason = reason || 'Application rejected by admin';
      
      await professional.save();
      
      console.log('❌ [ONBOARD] Professional rejected successfully');
      
      res.status(200).json({
        success: true,
        message: 'Professional rejected successfully',
        professional: {
          id: professional._id,
          name: professional.name,
          status: professional.status,
          rejectionReason: professional.rejectionReason
        }
      });
    } catch (error) {
      console.error('❌ [ONBOARD] Error rejecting professional:', error);
      logger.error('Reject professional error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject professional',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  
  /**
   * Get professional documents with pre-signed URLs (for admin)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getProfessionalDocuments(req, res) {
    try {
      const { id } = req.params;
      
      console.log('📋 [DOCUMENTS] Getting documents for professional:', id);
      
      const professional = await Professional.findById(id);
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found'
        });
      }

      // Convert to plain object
      const professionalObj = professional.toObject();
      
      // Generate pre-signed URLs for all documents (valid for 1 hour)
      if (professionalObj.documents && professionalObj.documents.length > 0) {
        professionalObj.documents = await generatePresignedUrls(
          professionalObj.documents.map(doc => ({
            ...doc,
            _id: doc._id.toString()
          })),
          3600 // 1 hour expiration
        );
      }

      console.log('✅ [DOCUMENTS] Documents retrieved with pre-signed URLs:', professionalObj.documents?.length || 0);

      res.status(200).json({
        success: true,
        professional: professionalObj
      });
    } catch (error) {
      console.error('❌ [DOCUMENTS] Error getting documents:', error);
      logger.error('Get professional documents error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get professional documents',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }


  // ========== EXISTING METHODS FROM YOUR ORIGINAL CONTROLLER ==========
  
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
}

module.exports = new ProfessionalOnboardingController();