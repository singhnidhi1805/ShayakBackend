const mongoose = require('mongoose');

const serviceDetailSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  }
}, { _id: true });

const customizationOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true
  },
  options: [{
    type: String,
    trim: true
  }],
  additionalPrice: {
    type: Number,
    min: 0,
    default: 0
  }
}, { _id: true });

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    enum: [
      'plumbing', 
      'electrical', 
      'carpentry', 
      'cleaning', 
      'painting',
      'landscaping',
      'moving',
      'pest_control',
      'appliance_repair',
      'hvac',
      'tiling'
    ],
    index: true
  },

  image: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  pricing: {
    type: {
      type: String,
      enum: ['fixed', 'range', 'hourly'],
      required: true
    },
    amount: {
      type: Number,
      min: 0,
      default: 0
    },
    minAmount: {
      type: Number,
      min: 0,
      default: 0
    },
    maxAmount: {
      type: Number,
      min: 0,
      default: 0
    }
  },
  serviceDetails: [serviceDetailSchema],
  customizationOptions: [customizationOptionSchema],
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for better performance
serviceSchema.index({ name: 'text', description: 'text' });

// Virtual for formatted pricing
serviceSchema.virtual('formattedPrice').get(function() {
  if (this.pricing.type === 'fixed' || this.pricing.type === 'hourly') {
    return `₹${this.pricing.amount.toFixed(2)}${this.pricing.type === 'hourly' ? '/hr' : ''}`;
  } else if (this.pricing.type === 'range') {
    return `₹${this.pricing.minAmount.toFixed(2)} - ₹${this.pricing.maxAmount.toFixed(2)}`;
  }
  return 'Custom pricing';
});

const Service = mongoose.model('Service', serviceSchema);

module.exports = Service;