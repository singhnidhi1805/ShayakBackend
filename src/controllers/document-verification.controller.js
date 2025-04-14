// document-verification.controller.js

const Professional = require('../models/professional.model');
const { sendNotification } = require('../services/notification.service');
const logger = require('../config/logger');
const mongoose = require('mongoose');

/**
 * Verifies a professional's document
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyDocument = async (req, res) => {
  // Set a reasonable timeout
  const OPERATION_TIMEOUT = 15000; // 15 seconds
  const operationStart = Date.now();
  
  try {
    // Log request for debugging
    console.log('Document verification request received:', { 
      body: JSON.stringify(req.body),
      admin: req.user._id
    });
    
    const { professionalId, documentId, isValid, remarks } = req.body;

    // Input validation with detailed error messages
    if (!professionalId) {
      return res.status(400).json({
        success: false,
        error: 'Professional ID is required'
      });
    }

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }

    if (typeof isValid !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isValid must be a boolean (true or false)'
      });
    }

    // Ensure the user is an admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only administrators can verify documents'
      });
    }

    // Find professional with timeout check
    let professional = null;
    
    try {
      // First try to find by MongoDB _id if it's a valid ObjectId
      if (mongoose.Types.ObjectId.isValid(professionalId)) {
        professional = await Professional.findById(professionalId)
          .maxTimeMS(OPERATION_TIMEOUT);
        
        console.log(`Search by _id (${professionalId}): ${professional ? 'Found' : 'Not found'}`);
      }
      
      // If not found, try to find by userId (the "PRO..." string)
      if (!professional) {
        professional = await Professional.findOne({ userId: professionalId })
          .maxTimeMS(OPERATION_TIMEOUT);
        
        console.log(`Search by userId (${professionalId}): ${professional ? 'Found' : 'Not found'}`);
      }
    } catch (findError) {
      console.error('Error finding professional:', findError);
      return res.status(findError.name === 'MongoTimeoutError' ? 504 : 500).json({
        success: false,
        error: 'Failed to find professional',
        message: findError.message
      });
    }

    if (!professional) {
      return res.status(404).json({
        success: false,
        error: 'Professional not found'
      });
    }

    console.log(`Found professional: ${professional._id} (${professional.name})`);
    
    // Check if professional has documents
    if (!professional.documents || !professional.documents.length) {
      return res.status(400).json({
        success: false,
        error: 'Professional has no documents to verify'
      });
    }

    // Find the document using string comparison for safety
    const documentIndex = professional.documents.findIndex(doc => 
      doc._id.toString() === documentId
    );

    if (documentIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Document not found for this professional'
      });
    }

    const document = professional.documents[documentIndex];
    if (!document.type) {
      return res.status(400).json({
        success: false,
        error: 'Document has no type specified'
      });
    }
    
    const documentType = document.type;
    console.log(`Found document: ${documentType} (${documentId})`);

    // Calculate new status
    const newStatus = isValid ? 'approved' : 'rejected';
    console.log(`Updating document status to: ${newStatus}`);
    
    // Create update operations
    const updateData = {};
    updateData[`documents.${documentIndex}.status`] = newStatus;
    updateData[`documents.${documentIndex}.verifiedAt`] = new Date();
    updateData[`documents.${documentIndex}.verifiedBy`] = req.user._id;
    updateData[`documentsStatus.${documentType}`] = newStatus;
    
    // Add remarks if provided
    if (remarks) {
      updateData[`documents.${documentIndex}.remarks`] = remarks;
    }
    
    // Update the document with timeout
    try {
      professional = await Professional.findByIdAndUpdate(
        professional._id,
        { $set: updateData },
        { 
          new: true,
          maxTimeMS: OPERATION_TIMEOUT - (Date.now() - operationStart)
        }
      );
      
      if (!professional) {
        throw new Error('Failed to update document status');
      }
    } catch (updateError) {
      console.error('Error updating document status:', updateError);
      return res.status(updateError.name === 'MongoTimeoutError' ? 504 : 500).json({
        success: false,
        error: 'Failed to update document status',
        message: updateError.message
      });
    }
    
    // Calculate overall status based on document statuses
    const documentsStatus = professional.documentsStatus || {};
    
    // Count different status types
    const statusCounts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      not_submitted: 0
    };
    
    // Count each status type
    Object.values(documentsStatus).forEach(status => {
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });
    
    console.log('Document status counts:', statusCounts);
    
    // Determine the professional's overall status
    let newProfessionalStatus = professional.status;
    if (statusCounts.rejected > 0) {
      newProfessionalStatus = 'rejected';
    } else if (statusCounts.pending > 0) {
      newProfessionalStatus = 'under_review';
    } else if (statusCounts.not_submitted > 0 && statusCounts.approved > 0) {
      newProfessionalStatus = 'document_pending';
    } else if (statusCounts.approved > 0 && statusCounts.not_submitted === 0) {
      newProfessionalStatus = 'verified';
    }
    
    console.log(`Updating professional status from ${professional.status} to ${newProfessionalStatus}`);
    
    // Update onboarding step if appropriate
    let onboardingStep = professional.onboardingStep;
    if (newProfessionalStatus === 'verified' && professional.onboardingStep === 'documents') {
      onboardingStep = 'completed';
    }
    
    // Generate employee ID if verified and doesn't have one yet
    let employeeId = professional.employeeId;
    if (newProfessionalStatus === 'verified' && !professional.employeeId) {
      const year = new Date().getFullYear().toString().substr(-2);
      
      // Get the count with a short timeout
      try {
        const count = await Professional.countDocuments().maxTimeMS(2000);
        employeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
      } catch (countError) {
        // If count fails, use timestamp instead
        console.warn('Count operation failed, using timestamp instead:', countError);
        employeeId = `PRO${year}${Date.now().toString().slice(-6)}`;
      }
    }
    
    // Check if we're taking too long
    if (Date.now() - operationStart > OPERATION_TIMEOUT) {
      // If we're running out of time, return success for the document update
      // and trigger the status update asynchronously
      updateProfessionalStatusAsync(
        professional._id, 
        newProfessionalStatus, 
        onboardingStep, 
        employeeId
      );
      
      return res.status(200).json({
        success: true,
        message: `Document ${isValid ? 'approved' : 'rejected'} successfully. Professional status will be updated shortly.`,
        professional: professional
      });
    }
    
    // Update professional status if we have time left
    try {
      professional = await Professional.findByIdAndUpdate(
        professional._id,
        { 
          $set: {
            status: newProfessionalStatus,
            onboardingStep: onboardingStep,
            ...(employeeId ? { employeeId } : {}),
            updatedAt: new Date()
          } 
        },
        { 
          new: true,
          maxTimeMS: OPERATION_TIMEOUT - (Date.now() - operationStart)
        }
      );
    } catch (statusUpdateError) {
      console.error('Error updating professional status:', statusUpdateError);
      
      // Still return success for the document verification part
      return res.status(200).json({
        success: true,
        message: `Document ${isValid ? 'approved' : 'rejected'} successfully, but failed to update overall status.`,
        professional: professional
      });
    }
    
    // Send notification to the professional (don't wait for it)
    try {
      sendNotification(professional.userId, 'document_verification', {
        status: newStatus,
        documentType,
        remarks: remarks || ''
      }).catch(notificationError => {
        console.warn('Failed to send notification:', notificationError);
      });
    } catch (notificationError) {
      console.warn('Failed to initialize notification:', notificationError);
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: `Document ${isValid ? 'approved' : 'rejected'} successfully`,
      professional
    });
    
  } catch (error) {
    console.error('Error in document verification:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify document'
    });
  }
};

// Function to update professional status asynchronously
const updateProfessionalStatusAsync = async (professionalId, newStatus, onboardingStep, employeeId) => {
  try {
    await Professional.findByIdAndUpdate(
      professionalId,
      { 
        $set: {
          status: newStatus,
          onboardingStep: onboardingStep,
          ...(employeeId ? { employeeId } : {}),
          updatedAt: new Date()
        } 
      },
      { maxTimeMS: 10000 }
    );
    
    console.log(`Async status update completed for professional ${professionalId}`);
  } catch (error) {
    console.error(`Async status update failed for professional ${professionalId}:`, error);
  }
};

module.exports = verifyDocument;