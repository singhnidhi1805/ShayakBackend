const mongoose = require('mongoose');

const professionalDocumentSchema = new mongoose.Schema({
  professionalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  type: { 
    type: String, 
    enum: ['id_proof', 'address_proof', 'professional_certificate'], 
    required: true 
  },
  fileUrl: { 
    type: String, 
    required: true 
  },
  fileName: String,
  mimeType: String,
  fileSize: Number,
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending',
    index: true
  },
  verifiedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  verifiedAt: Date,
  remarks: String
}, {
  timestamps: true
});

// Compound index for faster queries
professionalDocumentSchema.index({ professionalId: 1, type: 1 });

// Static method to get all documents for a professional
professionalDocumentSchema.statics.getDocumentsForProfessional = async function(professionalId) {
  return await this.find({ professionalId }).sort({ uploadedAt: -1 });
};

// Static method to get document status summary for a professional
professionalDocumentSchema.statics.getDocumentStatusSummary = async function(professionalId) {
  // Get the latest document of each type
  const latestDocs = await this.aggregate([
    { $match: { professionalId: mongoose.Types.ObjectId(professionalId) } },
    { $sort: { uploadedAt: -1 } },
    { $group: {
        _id: "$type",
        status: { $first: "$status" },
        fileUrl: { $first: "$fileUrl" },
        docId: { $first: "$_id" }
      }
    }
  ]);
  
  // Create a status object
  const documentsStatus = {
    id_proof: 'not_submitted',
    address_proof: 'not_submitted',
    professional_certificate: 'not_submitted'
  };
  
  // Fill in the latest status for each document type
  latestDocs.forEach(doc => {
    documentsStatus[doc._id] = doc.status;
  });
  
  return {
    documentsStatus,
    latestDocuments: latestDocs
  };
};

const ProfessionalDocument = mongoose.model('ProfessionalDocument', professionalDocumentSchema);

module.exports = ProfessionalDocument;