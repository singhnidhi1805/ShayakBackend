const Professional = require('../models/professional.model');
const { sendNotification } = require('../services/notification.service');
const logger = require('../config/logger'); 

const getProfessionals =  async (req, res) => {
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
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.json({
      professionals,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit)
    });
  } catch (error) {
    logger.error('Error fetching professionals list:', error);
    res.status(500).json({ error: 'Failed to fetch professionals' });
  }
};

const getProfessionalById = async (req, res) => {
  try {
    // Check if we're looking for a professional by their userId (from auth) or their _id (from params)
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
      return res.status(404).json({ error: 'Professional not found' });
    }
    
    res.json({ professional });
  } catch (error) {
    console.error('Error fetching professional:', error);
    res.status(500).json({ error: 'Failed to fetch professional details' });
  }
};

const verifyDocument = async (req, res) => {
  try {
    // Log request for debugging
    console.log('Document verification request received:', JSON.stringify(req.body));
    
    const { professionalId, documentId, isValid, remarks } = req.body;

    // Input validation
    if (!professionalId || !documentId) {
      console.log('Missing required fields:', { professionalId, documentId });
      return res.status(400).json({
        success: false,
        error: 'Professional ID and Document ID are required'
      });
    }

    // Find the professional directly - avoid models and validation that might hang
    const professional = await mongoose.connection.collection('professionals').findOne({ 
      _id: mongoose.Types.ObjectId(professionalId) 
    });

    if (!professional) {
      console.log('Professional not found with ID:', professionalId);
      return res.status(404).json({
        success: false,
        error: 'Professional not found'
      });
    }

    console.log('Found professional:', professional._id.toString());
    
    // Check if professional has documents
    if (!professional.documents || !Array.isArray(professional.documents) || professional.documents.length === 0) {
      console.log('Professional has no documents');
      return res.status(400).json({
        success: false,
        error: 'Professional has no documents to verify'
      });
    }

    // Log all document IDs for debugging
    const docIds = professional.documents.map(doc => doc._id.toString());
    console.log('Available document IDs:', docIds);

    // Find the document using string comparison
    const documentIndex = professional.documents.findIndex(doc => 
      doc._id.toString() === documentId
    );

    if (documentIndex === -1) {
      console.log('Document not found in professional documents');
      return res.status(404).json({
        success: false,
        error: `Document not found. Available IDs: ${docIds.join(', ')}`
      });
    }

    const document = professional.documents[documentIndex];
    const documentType = document.type;
    
    console.log('Found document:', document);

    // Calculate new statuses
    const newStatus = isValid ? 'approved' : 'rejected';
    console.log('Updating document status to:', newStatus);
    
    // Create update operations
    const updateOperations = {
      // Update document status
      [`documents.${documentIndex}.status`]: newStatus,
      [`documents.${documentIndex}.verifiedAt`]: new Date(),
      [`documentsStatus.${documentType}`]: newStatus
    };
    
    // Add remarks if provided
    if (remarks) {
      updateOperations[`documents.${documentIndex}.remarks`] = remarks;
    }
    
    // Directly update the database using updateOne
    // This bypasses Mongoose validation to avoid hanging
    const result = await mongoose.connection.collection('professionals').updateOne(
      { _id: mongoose.Types.ObjectId(professionalId) },
      { $set: updateOperations }
    );
    
    console.log('Database update result:', result);
    
    // If update was successful, update the professional's status
    if (result.modifiedCount > 0) {
      // Fetch the updated professional to get current document statuses
      const updatedProfessional = await mongoose.connection.collection('professionals').findOne({ 
        _id: mongoose.Types.ObjectId(professionalId) 
      });
      
      // Define which documents are required
      const requiredDocuments = ['id_proof', 'address_proof'];
      
      // Check if all REQUIRED documents are approved
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
      let newProfessionalStatus;
      if (hasRejected) {
        newProfessionalStatus = 'rejected';
      } else if (allRequiredApproved) {
        newProfessionalStatus = 'verified';
      } else {
        newProfessionalStatus = 'document_pending';
      }
      
      console.log('Updating professional status from', updatedProfessional.status, 'to', newProfessionalStatus);
      
      // Update onboarding step if appropriate
      let onboardingStep = updatedProfessional.onboardingStep;
      if (newProfessionalStatus === 'verified' && updatedProfessional.onboardingStep === 'documents') {
        onboardingStep = 'completed';
      }
      
      // Update professional status in a separate operation
      const statusResult = await mongoose.connection.collection('professionals').updateOne(
        { _id: mongoose.Types.ObjectId(professionalId) },
        { 
          $set: {
            status: newProfessionalStatus,
            onboardingStep: onboardingStep,
            updatedAt: new Date()
          } 
        }
      );
      
      console.log('Status update result:', statusResult);
    }
    
    // Fetch final professional data for response
    const finalProfessional = await mongoose.connection.collection('professionals').findOne({ 
      _id: mongoose.Types.ObjectId(professionalId) 
    });
    
    // Return success response
    return res.status(200).json({
      success: true,
      message: `Document ${isValid ? 'approved' : 'rejected'} successfully`,
      professional: finalProfessional
    });
    
  } catch (error) {
    console.error('Error in document verification:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify document',
      message: error.message
    });
  }
};

// Separate function to update professional status
const updateProfessionalStatus = async (professionalId) => {
  try {
    const professional = await Professional.findById(professionalId);
    if (!professional) {
      throw new Error('Professional not found');
    }
    
    // Define which documents are required vs. optional
    const requiredDocuments = ['id_proof', 'address_proof'];
    const optionalDocuments = ['professional_certificate'];
    
    // Count document statuses specifically for required documents
    let hasRejected = false;
    let allRequiredApproved = true;
    
    // Check required documents first
    for (const docType of requiredDocuments) {
      const status = professional.documentsStatus[docType];
      
      // Skip if document hasn't been submitted
      if (status === 'not_submitted') {
        allRequiredApproved = false;
        continue;
      }
      
      // Normalize the status
      let normalizedStatus = status;
      if (status === 'approve') normalizedStatus = 'approved';
      if (status === 'reject') normalizedStatus = 'rejected';
      
      if (normalizedStatus === 'rejected') {
        hasRejected = true;
      }
      
      if (normalizedStatus !== 'approved') {
        allRequiredApproved = false;
      }
    }
    
    // Log for debugging
    console.log('Professional status check:', {
      professionalId,
      hasRejected,
      allRequiredApproved,
      currentStatus: professional.status,
      documentStatuses: professional.documentsStatus
    });
    
    // Determine the new status
    let newStatus = professional.status;
    let newOnboardingStep = professional.onboardingStep;
    
    if (hasRejected) {
      newStatus = 'rejected';
    } else if (allRequiredApproved) {
      // All required documents are approved - set to verified regardless of optional docs
      newStatus = 'verified';
      
      if (professional.onboardingStep === 'documents') {
        newOnboardingStep = 'completed';
      }
    } else {
      // Some required documents are pending or not submitted
      newStatus = 'document_pending';
    }
    
    // Only update if there's a change
    if (newStatus !== professional.status || newOnboardingStep !== professional.onboardingStep) {
      const result = await Professional.updateOne(
        { _id: professional._id },
        { 
          $set: { 
            status: newStatus,
            onboardingStep: newOnboardingStep
          } 
        }
      );
      
      console.log('Status update result:', result);
    }
    
    return true;
  } catch (error) {
    console.error('Error updating professional status:', error);
    throw error;
  }
};

const getProfessionalAvailability = async (req, res) => {
  try {
    const { date } = req.query;
    
    const bookings = await Booking.find({
      professional: req.params.id,
      scheduledDate: {
        $gte: new Date(date),
        $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
      },
      status: { $in: ['pending', 'confirmed'] }
    });

    const slots = [];
    for (let hour = 9; hour < 18; hour++) {
      const slotTime = new Date(date);
      slotTime.setHours(hour, 0, 0, 0);
      
      const isBooked = bookings.some(booking => {
        const bookingTime = new Date(booking.scheduledDate);
        return bookingTime.getHours() === hour;
      });

      slots.push({
        time: slotTime,
        available: !isBooked
      });
    }

    res.json(slots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const validateProfessionalDocuments = async (req, res) => {
  try {
    const { professionalId, documentId, status, remarks } = req.body;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const professional = await Professional.findOne({ userId: professionalId });
    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    const document = professional.documents.id(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    document.verified = status === 'approved';
    document.verifiedAt = new Date();
    document.verifiedBy = req.user._id;
    
    if (status === 'approved') {
      const allVerified = professional.documents.every(doc => doc.verified);
      if (allVerified) {
        professional.status = 'verified';
      }
    }

    await professional.save();

    await sendNotification(professionalId, 'document_verification', {
      status,
      remarks,
      documentType: document.type
    });

    res.json(professional);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProfessionalLocation = async (req, res) => {
  try {
    const { coordinates, isAvailable } = req.body;
    
    const professional = await Professional.findOne({ userId: req.user._id });
    if (!professional) {
      return res.status(404).json({ error: 'Professional not found' });
    }

    professional.currentLocation.coordinates = coordinates;
    professional.activeStatus.isOnline = isAvailable;
    professional.activeStatus.lastActive = new Date();
    await professional.save();

    res.json(professional);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateProfessionalProfile = async (req, res) => {
  try {
    const { specializations, experience, qualifications } = req.body;
    
    if (req.user.role !== 'professional') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const professional = await Professional.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          specializations,
          experience,
          qualifications
        }
      },
      { new: true, runValidators: true }
    ).select('-password');

    res.json(professional);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};


module.exports = {
    getProfessionals,
    getProfessionalAvailability,
    validateProfessionalDocuments,
    verifyDocument,
    updateProfessionalLocation,
    updateProfessionalProfile,
    getProfessionalById,
    updateProfessionalStatus
  };