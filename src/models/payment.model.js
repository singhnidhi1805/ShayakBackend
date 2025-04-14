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
    sparse: true // Only apply unique constraint to non-null values 
  },
  userId: { 
    type: String, // Changed from ObjectId to String
    required: true, 
    unique: true 
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
    default: 'registration_pending' 
  },
  onboardingStep: { 
    type: String, 
    enum: ['welcome', 'personal_details', 'specializations', 'documents', 'completed'], 
    default: 'welcome' 
  },
  specializations: { 
    type: [String],
    enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'landscaping', 'moving', 'pest_control', 'appliance_repair', 'hvac', 'tiling'] 
  },
  isAvailable: { 
    type: Boolean, 
    default: false 
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
    sparse: true // Only apply the unique constraint if the field exists (not null)
  }
}, { 
  timestamps: true 
});

// Indexes
professionalSchema.index({ "currentLocation": "2dsphere" });
professionalSchema.index({ "specializations": 1 });
professionalSchema.index({ "status": 1 });
professionalSchema.index({ "isAvailable": 1 });

const Professional = mongoose.model('Professional', professionalSchema);

module.exports = Professional;
