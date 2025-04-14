const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
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
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    required: true
  },
  payoutAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['credit_card', 'debit_card', 'upi', 'net_banking', 'wallet'],
    required: true
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay', 'paytm', 'stripe'],
    required: true
  },
  gatewayTransactionId: {
    type: String,
    required: true,
    unique: true
  },
  gatewayFee: {
    type: Number,
    default: 0
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['initiated', 'processing', 'completed', 'failed', 'refunded', 'partially_refunded'],
    default: 'initiated',
    index: true
  },
  type: {
    type: String,
    enum: ['payment', 'refund'],
    default: 'payment',
    index: true
  },
  refundReason: {
    type: String
  },
  refundedAmount: {
    type: Number,
    default: 0
  },
  refundedAt: {
    type: Date
  },
  originalTransaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  paymentReceiptUrl: {
    type: String
  },
  invoiceId: {
    type: String
  },
  notes: {
    type: String
  },
  metadata: {
    type: Object
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Create a unique transaction reference number
transactionSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next();
  }
  
  // Generate transaction ID with format: TXN-YYYYMMDD-RANDOM
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  
  this.invoiceId = `TXN-${year}${month}${day}-${random}`;
  next();
});

// Add compound index for faster transaction lookups
transactionSchema.index({ professional: 1, createdAt: -1 });
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ booking: 1, type: 1 });

// Add method to calculate platform fee
transactionSchema.methods.calculatePlatformFee = function(amount) {
  // Default platform fee is 15%
  return amount * 0.15;
};

// Add method to calculate payout amount
transactionSchema.methods.calculatePayoutAmount = function(amount) {
  // Payout amount is amount minus platform fee (15%)
  return amount * 0.85;
};

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;