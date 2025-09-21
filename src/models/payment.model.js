// models/payment.model.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    index: true
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Amount breakdown
  serviceAmount: {
    type: Number,
    required: true,
    min: 0
  },
  additionalAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  platformCommission: {
    type: Number,
    required: true,
    default: function() {
      return this.totalAmount * 0.15; // 15% commission
    }
  },
  professionalPayout: {
    type: Number,
    required: true,
    default: function() {
      return this.totalAmount - this.platformCommission;
    }
  },
  
  // Payment method and details
  paymentMethod: {
    type: String,
    enum: ['online', 'cash', 'upi'],
    required: true
  },
  paymentType: {
    type: String,
    enum: ['razorpay', 'upi_direct', 'cash_on_delivery'],
    required: true
  },
  
  // Online payment details (Razorpay)
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  
  // UPI details
  upiTransactionId: String,
  upiId: String,
  
  // Cash payment details
  cashCollected: {
    type: Boolean,
    default: false
  },
  cashCollectedAt: Date,
  
  // Payment status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  
  // Commission settlement for cash payments
  commissionStatus: {
    type: String,
    enum: ['pending', 'collected', 'waived'],
    default: 'pending'
  },
  commissionDueDate: Date,
  commissionCollectedAt: Date,
  
  // Additional charges breakdown
  additionalCharges: [{
    description: String,
    amount: Number,
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Professional'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Payment attempt tracking
  paymentAttempts: [{
    attemptedAt: Date,
    method: String,
    status: String,
    errorMessage: String,
    gatewayResponse: Object
  }],
  
  // Refund details
  refundDetails: {
    amount: Number,
    reason: String,
    processedAt: Date,
    refundId: String
  },
  
  // Metadata
  invoice: {
    invoiceNumber: String,
    invoiceUrl: String,
    generatedAt: Date
  },
  
  notes: String,
  metadata: Object,
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
paymentSchema.index({ booking: 1, status: 1 });
paymentSchema.index({ professional: 1, commissionStatus: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ paymentMethod: 1, status: 1 });

// Virtual for commission calculation
paymentSchema.virtual('commissionPercentage').get(function() {
  return (this.platformCommission / this.totalAmount) * 100;
});

// Pre-save middleware to calculate amounts
paymentSchema.pre('save', function(next) {
  if (this.isModified('serviceAmount') || this.isModified('additionalAmount')) {
    this.totalAmount = this.serviceAmount + this.additionalAmount;
    this.platformCommission = this.totalAmount * 0.15;
    this.professionalPayout = this.totalAmount - this.platformCommission;
    
    // Set commission due date (7 days for cash payments)
    if (this.paymentMethod === 'cash' && !this.commissionDueDate) {
      this.commissionDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  next();
});

// Generate invoice number
paymentSchema.pre('save', function(next) {
  if (this.isNew && !this.invoice.invoiceNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    
    this.invoice.invoiceNumber = `INV-${year}${month}${day}-${random}`;
  }
  next();
});

// Static methods
paymentSchema.statics.createPaymentRequest = async function(bookingData) {
  const { booking, serviceAmount, additionalAmount = 0, paymentMethod } = bookingData;
  
  const payment = new this({
    booking: booking._id,
    professional: booking.professional,
    user: booking.user,
    serviceAmount,
    additionalAmount,
    paymentMethod,
    paymentType: paymentMethod === 'online' ? 'razorpay' : 
                 paymentMethod === 'upi' ? 'upi_direct' : 'cash_on_delivery'
  });
  
  return await payment.save();
};

// Instance methods
paymentSchema.methods.addAdditionalCharge = function(description, amount, professionalId) {
  this.additionalCharges.push({
    description,
    amount,
    addedBy: professionalId
  });
  
  this.additionalAmount += amount;
  return this.save();
};

paymentSchema.methods.markAsCompleted = function(paymentDetails = {}) {
  this.status = 'completed';
  this.completedAt = new Date();
  
  if (paymentDetails.razorpayPaymentId) {
    this.razorpayPaymentId = paymentDetails.razorpayPaymentId;
    this.razorpaySignature = paymentDetails.razorpaySignature;
  }
  
  if (paymentDetails.upiTransactionId) {
    this.upiTransactionId = paymentDetails.upiTransactionId;
  }
  
  if (this.paymentMethod === 'cash') {
    this.cashCollected = true;
    this.cashCollectedAt = new Date();
  }
  
  return this.save();
};

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;