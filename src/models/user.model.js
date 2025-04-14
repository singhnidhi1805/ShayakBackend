const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  houseNo: {
    type: String,
    required: true
  },
  street: {
    type: String,
    required: true
  },
  landmark: String,
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  zipCode: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  addressType: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home'
  }
});

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: true
  },
  name: String,
  email: String,
  phone: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['user'],
    default: 'user'
  },
  addresses: {
    type: [addressSchema],
    validate: [arrayLimit, 'Exceeds the limit of 15 addresses']
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [77.5946, 12.9716]
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  servicePreferences: [{
    serviceCategory: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Service' 
    },
    frequency: { 
      type: String, 
      enum: ['occasional', 'regular', 'frequent'], 
      default: 'occasional' 
    }
  }],
  rating: { 
    type: Number, 
    default: 0, 
    min: 0, 
    max: 5 
  }
});

function arrayLimit(val) {
  return val.length <= 15;
}

userSchema.index({ currentLocation: '2dsphere' });

module.exports = mongoose.model('User', userSchema);
