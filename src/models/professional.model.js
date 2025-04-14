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
  // Public-facing professional ID (like "PRO12345ABC")
  userId: { 
    type: String,
    required: true,
    unique: true,
    index: true // Add index for faster lookup
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
    index: true // Add index for frequent status queries
  },
  onboardingStep: { 
    type: String, 
    enum: ['welcome', 'personal_details', 'specializations', 'documents', 'completed'], 
    default: 'welcome' 
  },
  specializations: { 
    type: [String],
    enum: ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'landscaping', 'moving', 'pest_control', 'appliance_repair', 'hvac', 'tiling'],
    index: true // Add index for filtering by specializations
  },
  isAvailable: { 
    type: Boolean, 
    default: false,
    index: true // Add index for availability filtering
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
    sparse: true, // Only apply the unique constraint if the field exists (not null)
    index: true // Add index for faster lookup by employeeId
  }
}, { 
  timestamps: true 
});

// Compound index for faster document lookups
professionalSchema.index({ "_id": 1, "documents._id": 1 });

// Optimize the 2dsphere index
professionalSchema.index({ "currentLocation": "2dsphere" });

// Add text search index for name, email and phone
professionalSchema.index(
  { name: 'text', email: 'text', phone: 'text', employeeId: 'text' },
  { name: 'professional_text_search', weights: { name: 10, employeeId: 5, email: 3, phone: 2 } }
);

// Add static method to find a professional by any type of ID
professionalSchema.statics.findByAnyId = async function(id) {
  if (!id) return null;
  
  // Try different fields one by one
  let professional = null;
  
  // Check for ObjectId format
  if (mongoose.Types.ObjectId.isValid(id)) {
    professional = await this.findById(id);
    if (professional) return professional;
  }
  
  // Try userId field (the "PRO..." string)
  professional = await this.findOne({ userId: id });
  if (professional) return professional;
  
  // Try employeeId field
  professional = await this.findOne({ employeeId: id });
  
  return professional;
};

const Professional = mongoose.model('Professional', professionalSchema);

module.exports = Professional;