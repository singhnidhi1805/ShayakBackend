const mongoose = require('mongoose');

const professionalSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  email: { 
    type: String, 
    required: true, 
    unique: true 
  },
  phone: { 
    type: String, 
    required: true, 
    unique: true, 
    sparse: true
  },
  userId: { 
    type: String,
    required: true,
    unique: true,
    index: true
  },
  alternatePhone: { 
    type: String 
  },
  
  address: { 
    type: String 
  },
  city: { 
    type: String 
  },
  state: { 
    type: String 
  },
  pincode: { 
    type: String 
  },
  status: { 
    type: String, 
    enum: ['registration_pending', 'document_pending', 'under_review', 'rejected', 'verified', 'suspended', 'inactive'], 
    default: 'registration_pending',
    index: true
  },
  onboardingStep: { 
    type: String, 
    enum: ['welcome', 'personal_details', 'specializations', 'documents', 'completed'], 
    default: 'welcome' 
  },
  specializations: { 
    type: [String],
    enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'landscaping', 'moving', 'pest_control', 'appliance_repair', 'hvac', 'tiling'],
    index: true
  },
  isAvailable: { 
    type: Boolean, 
    default: false,
    index: true
  },
  currentLocation: { 
    type: { 
      type: String, 
      enum: ['Point'], 
      default: 'Point' 
    }, 
    coordinates: { 
      type: [Number], 
      default: [0, 0] 
    } 
  },
  documents: [{
    type: { 
      type: String, 
      enum: ['id_proof', 'address_proof', 'professional_certificate'], 
      required: true 
    },
    s3Key: {  // Changed from fileUrl to s3Key
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
      default: 'pending' 
    },
    verifiedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    verifiedAt: Date,
    remarks: String
  }],
  documentsStatus: {
    id_proof: { 
      type: String, 
      enum: ['not_submitted', 'pending', 'approved', 'rejected'], 
      default: 'not_submitted' 
    },
    address_proof: { 
      type: String, 
      enum: ['not_submitted', 'pending', 'approved', 'rejected'], 
      default: 'not_submitted' 
    },
    professional_certificate: { 
      type: String, 
      enum: ['not_submitted', 'pending', 'approved', 'rejected'], 
      default: 'not_submitted' 
    }
  },
  employeeId: { 
    type: String, 
    unique: true, 
    sparse: true,
    index: true
  },
  workingHours: {
    startTime: {
      type: String,
      default: "09:00"
    },
    endTime: {
      type: String,
      default: "18:00"
    },
    isWorkingDay: {
      type: Boolean,
      default: true
    }
  },
  
}, { 
  timestamps: true 
});

// Compound index for faster document lookups
professionalSchema.index({ "_id": 1, "documents._id": 1 });

// Optimize the 2dsphere index
professionalSchema.index({ "currentLocation": "2dsphere" });

// Add text search index
professionalSchema.index(
  { name: 'text', email: 'text', phone: 'text', employeeId: 'text' },
  { name: 'professional_text_search', weights: { name: 10, employeeId: 5, email: 3, phone: 2 } }
);

// Static method to find a professional by any type of ID
professionalSchema.statics.findByAnyId = async function(id) {
  if (!id) return null;
  
  let professional = null;
  
  if (mongoose.Types.ObjectId.isValid(id)) {
    professional = await this.findById(id);
    if (professional) return professional;
  }
  
  professional = await this.findOne({ userId: id });
  if (professional) return professional;
  
  professional = await this.findOne({ employeeId: id });
  
  return professional;
};

const Professional = mongoose.model('Professional', professionalSchema);

module.exports = Professional;