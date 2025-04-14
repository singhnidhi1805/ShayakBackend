const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: [100, 'Minimum withdrawal amount is 100']
  },
  paymentMethod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PaymentMethod',
    required: true
  },
  status: {
    type: String,
    enum: ['processing', 'completed', 'failed', 'cancelled'],
    default: 'processing',
    index: true
  },
  reference: {
    type: String,
    trim: true
  },
  requestedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  failedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  remarks: {
    type: String,
    trim: true
  },
  transactionId: {
    type: String,
    trim: true
  },
  adminNotes: {
    type: String,
    trim: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  fees: {
    type: Number,
    default: 0
  },
  taxDeducted: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    get: function() {
      return this.amount - (this.fees + this.taxDeducted);
    }
  },
  withdrawalId: {
    type: String,
    unique: true
  }
}, {
  timestamps: true,
  toJSON: { getters: true }
});

// Create a unique withdrawal ID
withdrawalSchema.pre('save', function(next) {
  if (!this.isNew) {
    return next();
  }
  
  // Generate withdrawal ID with format: WTH-YYYYMMDD-RANDOM
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  
  this.withdrawalId = `WTH-${year}${month}${day}-${random}`;
  next();
});

// Add compound indexes for faster withdrawal lookups
withdrawalSchema.index({ professional: 1, status: 1 });
withdrawalSchema.index({ professional: 1, requestedAt: -1 });
withdrawalSchema.index({ status: 1, requestedAt: 1 });
withdrawalSchema.index({ paymentMethod: 1, status: 1 });

// Add static methods for status updates
withdrawalSchema.statics.markAsProcessing = async function(id, admin) {
  return this.findByIdAndUpdate(
    id,
    {
      status: 'processing',
      processedAt: new Date(),
      processedBy: admin,
      $set: { "remarks": "Your withdrawal request is being processed." }
    },
    { new: true }
  );
};

withdrawalSchema.statics.markAsCompleted = async function(id, admin, transactionId) {
  return this.findByIdAndUpdate(
    id,
    {
      status: 'completed',
      completedAt: new Date(),
      processedBy: admin,
      transactionId,
      $set: { "remarks": "Your withdrawal has been completed successfully." }
    },
    { new: true }
  );
};

withdrawalSchema.statics.markAsFailed = async function(id, admin, reason) {
  return this.findByIdAndUpdate(
    id,
    {
      status: 'failed',
      failedAt: new Date(),
      processedBy: admin,
      $set: { "remarks": reason || "Your withdrawal request could not be processed." }
    },
    { new: true }
  );
};

withdrawalSchema.statics.markAsCancelled = async function(id, reason) {
  return this.findByIdAndUpdate(
    id,
    {
      status: 'cancelled',
      cancelledAt: new Date(),
      $set: { "remarks": reason || "Your withdrawal request has been cancelled." }
    },
    { new: true }
  );
};

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;