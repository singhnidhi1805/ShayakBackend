const mongoose = require('mongoose');
const crypto = require('crypto');

const paymentMethodSchema = new mongoose.Schema({
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['bank_account', 'upi'],
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // For bank accounts
  accountNumber: {
    type: String,
    trim: true,
    // Only required for bank accounts
    validate: {
      validator: function(v) {
        return this.type !== 'bank_account' || (v && v.length >= 9 && v.length <= 18);
      },
      message: props => 'Account number is required for bank accounts and must be between 9-18 digits'
    },
    // We'll encrypt this field when saving
    set: function(value) {
      if (!value) return value;
      // Store encrypted value
      this._accountNumber = value; // Store original for validation
      // AES-256-CTR encryption
      const cipher = crypto.createCipher('aes-256-ctr', process.env.ENCRYPTION_KEY || 'default-encryption-key');
      let encrypted = cipher.update(value, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    }
  },
  // For UPI
  upiId: {
    type: String,
    trim: true,
    lowercase: true,
    // Only required for UPI
    validate: {
      validator: function(v) {
        return this.type !== 'upi' || (v && /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+$/.test(v));
      },
      message: props => 'UPI ID is required for UPI payment methods and must be in valid format'
    }
  },
  // Bank details for bank accounts
  bankName: {
    type: String,
    trim: true,
    // Only required for bank accounts
    validate: {
      validator: function(v) {
        return this.type !== 'bank_account' || !!v;
      },
      message: props => 'Bank name is required for bank accounts'
    }
  },
  ifscCode: {
    type: String,
    trim: true,
    uppercase: true,
    // Only required for bank accounts
    validate: {
      validator: function(v) {
        return this.type !== 'bank_account' || (v && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v));
      },
      message: props => 'IFSC code is required for bank accounts and must be in valid format'
    }
  },
  branchName: {
    type: String,
    trim: true
  },
  accountHolderName: {
    type: String,
    trim: true,
    // Default to the name field if not specified
    get: function() {
      return this._accountHolderName || this.name;
    },
    set: function(v) {
      this._accountHolderName = v;
      return v;
    }
  },
  isDefault: {
    type: Boolean,
    default: false,
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  verificationMethod: {
    type: String,
    enum: ['bank_transfer', 'document', 'admin', null],
    default: null
  },
  verificationReference: {
    type: String,
    trim: true
  },
  lastUsed: {
    type: Date
  },
  lastWithdrawal: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Withdrawal'
  },
  totalWithdrawals: {
    type: Number,
    default: 0
  },
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true,
  toJSON: {
    getters: true,
    transform: function(doc, ret, options) {
      // Mask account number for JSON output
      if (ret.accountNumber) {
        ret.accountNumber = '••••' + ret.accountNumber.slice(-4);
      }
      delete ret._accountNumber;
      delete ret._accountHolderName;
      return ret;
    }
  }
});

// Compound indexes
paymentMethodSchema.index({ professional: 1, isDefault: 1 });
paymentMethodSchema.index({ professional: 1, isActive: 1 });
paymentMethodSchema.index({ professional: 1, type: 1, isActive: 1 });

// Middleware to decryption for account number (internal use only)
paymentMethodSchema.methods.getDecryptedAccountNumber = function() {
  if (!this.accountNumber) return null;
  
  try {
    const decipher = crypto.createDecipher('aes-256-ctr', process.env.ENCRYPTION_KEY || 'default-encryption-key');
    let decrypted = decipher.update(this.accountNumber, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
};

// Method to get a masked account number
paymentMethodSchema.methods.getMaskedAccountNumber = function() {
  if (!this.accountNumber) return null;
  
  const decrypted = this.getDecryptedAccountNumber();
  if (!decrypted) return null;
  
  return '••••' + decrypted.slice(-4);
};

// Method to update withdrawal count
paymentMethodSchema.methods.updateWithdrawalInfo = async function(withdrawalId) {
  this.lastUsed = new Date();
  this.lastWithdrawal = withdrawalId;
  this.totalWithdrawals += 1;
  await this.save();
};

// Static method to get default payment method
paymentMethodSchema.statics.getDefaultForProfessional = async function(professionalId) {
  // Try to get the default method
  let method = await this.findOne({
    professional: professionalId,
    isDefault: true,
    isActive: true
  });
  
  // If no default found, get the most recently created active method
  if (!method) {
    method = await this.findOne({
      professional: professionalId,
      isActive: true
    }).sort({ createdAt: -1 });
  }
  
  return method;
};

const PaymentMethod = mongoose.model('PaymentMethod', paymentMethodSchema);

module.exports = PaymentMethod;