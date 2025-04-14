const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const { uploadToS3, deleteFromS3 } = require('../utils/fileUpload');
const EmailService = require('../services/email.service');
const { sendSMS } = require('../services/sms.service');
const logger = require('../config/logger');
const createError = require('http-errors');
const ServiceCreationService = require('../services/service-creation.service');
const SMSService = require('./sms.service');
const User = require('../models/user.model'); // Add this line

class ProfessionalOnboardingService {
  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
  }

  async saveOnboardingProgress(professionalId, step, data) {
    try {
      // Ensure we're working with the Professional's _id
      let updateFields = {
        onboardingStep: step
      };

      // Set different fields based on the step
      switch (step) {
        case 'personal_details':
          updateFields = {
            ...updateFields,
            name: data.name,
            email: data.email,
            alternatePhone: data.alternatePhone,
            address: data.address,
            city: data.city,
            state: data.state,
            pincode: data.pincode
          };
          break;
        case 'specializations':
          updateFields = {
            ...updateFields,
            specializations: data
          };
          break;
        case 'documents':
          // Document handling is done in uploadDocument method
          break;
      }

      // Find and update professional in a single operation - using _id directly
      const professional = await Professional.findByIdAndUpdate(
        professionalId,
        { $set: updateFields },
        { new: true, runValidators: true }
      );

      if (!professional) {
        throw createError(404, 'Professional not found');
      }

      return { success: true, professional };
    } catch (error) {
      logger.error('Error saving onboarding progress:', error);
      throw error;
    }
  }


  async initiateOnboarding(professionalId, professionalData) {
    try {
      // Find professional by _id directly
      const professional = await Professional.findById(professionalId);
  
      if (!professional) {
        throw createError(404, 'Professional not found');
      }
  
      // Update the existing professional with new data
      professional.name = professionalData.name;
      professional.email = professionalData.email.toLowerCase().trim();
      professional.onboardingStep = 'personal_details';
      
      await professional.save();
  
      // Send welcome notification asynchronously
      this.emailService.sendEmail({
        template: 'welcome-professional',
        to: professional.email,
        subject: 'Welcome to Our Platform',
        data: { 
          name: professional.name,
          dashboardUrl: process.env.DASHBOARD_URL || 'https://yourplatform.com/dashboard'
        }
      }).catch(error => {
        logger.error('Welcome email error:', error);
      });
  
      return { success: true, professional };
    } catch (error) {
      logger.error('Onboarding initiation error:', error);
      throw error;
    }
  }
  
  async uploadDocument(professionalId, documentType, file) {
    try {
      // Validate file first
      if (!file?.buffer) {
        throw createError(400, 'Missing file data');
      }

      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw createError(400, `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.mimetype)) {
        throw createError(400, `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
      }

      // Get professional document for file cleanup - use _id directly
      const professional = await Professional.findById(professionalId);
      if (!professional) {
        throw createError(404, 'Professional not found');
      }

      // Handle S3 operations
      let fileUrl;
      const existingDoc = professional.documents.find(doc => doc.type === documentType);
      if (existingDoc) {
        try {
          await deleteFromS3(existingDoc.fileUrl);
        } catch (s3Error) {
          logger.warn('Failed to delete old document:', s3Error);
        }
      }

      const fileKey = `documents/${professional._id}/${documentType}_${Date.now()}`;
      fileUrl = await uploadToS3(file.buffer, fileKey, file.mimetype);

      // Update document in one atomic operation - use _id directly
      const updatedProfessional = await Professional.findByIdAndUpdate(
        professionalId,
        {
          $set: {
            [`documentsStatus.${documentType}`]: 'pending',
            status: 'under_review',
            onboardingStep: 'documents'
          },
          $push: {
            documents: {
              $each: [{
                type: documentType,
                fileUrl,
                fileName: file.originalname,
                mimeType: file.mimetype,
                fileSize: file.size,
                uploadedAt: new Date(),
                status: 'pending'
              }],
              $sort: { uploadedAt: -1 }
            }
          }
        },
        { new: true, runValidators: true }
      );

      if (!updatedProfessional) {
        throw createError(500, 'Failed to update professional record');
      }

      // Send admin notification asynchronously
      this.emailService.sendEmail({
        template: 'new-document-upload',
        to: process.env.ADMIN_EMAIL,
        subject: 'New Document Upload',
        data: {
          professionalName: updatedProfessional.name,
          documentType,
          professionalId: updatedProfessional._id
        }
      }).catch(error => {
        logger.warn('Admin notification failed:', error);
      });

      return { 
        success: true, 
        documentId: updatedProfessional.documents.find(doc => doc.type === documentType)._id,
        status: 'pending'
      };
    } catch (error) {
      logger.error('Document upload error:', error);
      throw error;
    }
  }

  async verifyDocument(professionalId, documentId, adminId, isValid, remarks) {
    try {
      // Fetch current state
      const professional = await Professional.findById(professionalId);
      if (!professional) {
        throw createError(404, 'Professional not found');
      }
  
      const document = professional.documents.find(doc => doc._id.toString() === documentId);
      if (!document) {
        throw createError(404, 'Document not found');
      }
  
      // Prepare update
      const documentStatus = isValid ? 'approved' : 'rejected';
      const updateQuery = {
        $set: {
          [`documents.$[doc].status`]: documentStatus,
          [`documents.$[doc].verifiedBy`]: adminId,
          [`documents.$[doc].verifiedAt`]: new Date(),
          [`documentsStatus.${document.type}`]: documentStatus
        }
      };
      
      // Add remarks if provided
      if (remarks) {
        updateQuery.$set[`documents.$[doc].remarks`] = remarks;
      }
  
      // Use atomic findOneAndUpdate with array filters
      const updatedProfessional = await Professional.findOneAndUpdate(
        { _id: professionalId },
        updateQuery,
        {
          arrayFilters: [{ "doc._id": documentId }],
          new: true,
          runValidators: true
        }
      );
  
      if (!updatedProfessional) {
        throw createError(500, 'Failed to update document status');
      }
  
      // Check if all REQUIRED documents are verified
      // Focus only on required documents, ignoring optional ones
      const requiredDocuments = ['id_proof', 'address_proof'];
      
      // Check if all required documents are approved
      let allRequiredApproved = true;
      let hasRejected = false;
      
      // Loop through required documents only
      for (const docType of requiredDocuments) {
        const status = updatedProfessional.documentsStatus[docType];
        if (status === 'rejected') {
          hasRejected = true;
        }
        if (status !== 'approved') {
          allRequiredApproved = false;
        }
      }
      
      // Determine the professional's overall status
      let newStatus;
      let newOnboardingStep = updatedProfessional.onboardingStep;
      let newEmployeeId = updatedProfessional.employeeId;
  
      if (hasRejected) {
        newStatus = 'rejected';
      } else if (allRequiredApproved) {
        newStatus = 'verified';
        // If all required documents are verified, set onboarding as completed
        if (updatedProfessional.onboardingStep === 'documents') {
          newOnboardingStep = 'completed';
        }
      } else {
        newStatus = 'document_pending';
      }
  
      // Generate employee ID if verified and doesn't have one yet
      if (newStatus === 'verified' && !updatedProfessional.employeeId) {
        const year = new Date().getFullYear().toString().substr(-2);
        const count = await Professional.countDocuments();
        newEmployeeId = `PRO${year}${(count + 1).toString().padStart(4, '0')}`;
      }
  
      // Update professional status in a separate operation
      await Professional.findByIdAndUpdate(
        professionalId,
        { 
          $set: {
            status: newStatus,
            onboardingStep: newOnboardingStep,
            ...(newEmployeeId ? { employeeId: newEmployeeId } : {})
          } 
        }
      );
  
      // Send notifications asynchronously
      const notificationPromises = [
        this.emailService.sendEmail({
          template: isValid ? 'document-approved' : 'document-rejected',
          to: professional.email,
          subject: `Document ${isValid ? 'Approved' : 'Rejected'}`,
          data: {
            name: professional.name,
            documentType: document.type,
            status: documentStatus,
            remarks: remarks || '',
            employeeId: newEmployeeId || professional.employeeId || 'Pending'
          }
        })
      ];
  
      if (professional.phone) {
        notificationPromises.push(
          this.smsService.sendSMS(
            professional.phone,
            `Your ${document.type} document has been ${isValid ? 'approved' : 'rejected'}. ${
              remarks ? `Remarks: ${remarks}` : ''
            }`
          )
        );
      }
  
      if (allRequiredApproved) {
        notificationPromises.push(
          this.emailService.sendEmail({
            template: 'onboarding-complete',
            to: professional.email,
            subject: 'Onboarding Complete',
            data: {
              name: professional.name,
              employeeId: newEmployeeId || professional.employeeId || 'Pending'
            }
          })
        );
      }
  
      Promise.all(notificationPromises).catch(error => {
        logger.warn('Notification error:', error);
      });
  
      // Fetch and return the updated professional for response
      const finalProfessional = await Professional.findById(professionalId);
      return { success: true, professional: finalProfessional };
    } catch (error) {
      logger.error('Document verification error:', error);
      throw error;
    }
  }
  async getOnboardingStatus(professionalId) {
    try {
      // Use _id directly to find the professional
      const professional = await Professional.findById(professionalId);
      if (!professional) {
        throw createError(404, 'Professional not found');
      }

      const requiredDocuments = ['id_proof', 'address_proof'];
      const optionalDocuments = ['professional_certificate'];
      const allDocuments = [...requiredDocuments, ...optionalDocuments];
      
      const uploadedDocuments = professional.documents.map(doc => doc.type);
      
      // Get progress data based on onboarding step
      let progressData = {};
      switch (professional.onboardingStep) {
        case 'personal_details':
          progressData.personalDetails = {
            name: professional.name,
            email: professional.email,
            alternatePhone: professional.alternatePhone,
            address: professional.address,
            city: professional.city,
            state: professional.state,
            pincode: professional.pincode
          };
          break;
        case 'specializations':
          progressData.personalDetails = {
            name: professional.name,
            email: professional.email,
            alternatePhone: professional.alternatePhone,
            address: professional.address,
            city: professional.city,
            state: professional.state,
            pincode: professional.pincode
          };
          progressData.specializations = professional.specializations;
          break;
        case 'documents':
        case 'completed':
          progressData.personalDetails = {
            name: professional.name,
            email: professional.email,
            alternatePhone: professional.alternatePhone,
            address: professional.address,
            city: professional.city,
            state: professional.state,
            pincode: professional.pincode
          };
          progressData.specializations = professional.specializations;
          progressData.documents = {};
          
          // Add document info for each uploaded document
          professional.documents.forEach(doc => {
            if (allDocuments.includes(doc.type)) {
              progressData.documents[doc.type] = {
                uri: doc.fileUrl,
                id: doc._id,
                status: doc.status
              };
            }
          });
          break;
      }
      
      return {
        currentStatus: professional.status,
        onboardingStep: professional.onboardingStep,
        employeeId: professional.employeeId,
        progress: progressData,
        missingDocuments: requiredDocuments.filter(
          doc => !uploadedDocuments.includes(doc)
        ),
        documentStatus: professional.documentsStatus,
        pendingVerification: professional.documents
          .filter(doc => doc.status === 'pending')
          .map(doc => ({
            type: doc.type,
            uploadedAt: doc.uploadedAt
          })),
        rejectedDocuments: professional.documents
          .filter(doc => doc.status === 'rejected')
          .map(doc => ({
            type: doc.type,
            remarks: doc.remarks
          })),
        isComplete: professional.status === 'verified'
      };
    } catch (error) {
      logger.error('Status check error:', error);
      throw error;
    }
  }
}

module.exports = new ProfessionalOnboardingService();