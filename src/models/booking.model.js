
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  professional: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Professional'
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: function(coordinates) {
          return coordinates.length === 2 && 
                 coordinates[0] >= -180 && coordinates[0] <= 180 &&
                 coordinates[1] >= -90 && coordinates[1] <= 90;
        },
        message: 'Coordinates must be [longitude, latitude] within valid ranges'
      }
    },
    address: {
      type: String,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  verificationCode: {
    type: String,
    required: true
  },
  
  // ========== NEW: Service Completion OTP Fields ==========
  completionOTPSession: {
    type: String,
    index: true
  },
  completionOTPSentAt: {
    type: Date
  },
  completionOTPVerifiedAt: {
    type: Date
  },
  completionOTPAttempts: {
    type: Number,
    default: 0
  },
  // ========== End New Fields ==========
  
  // Additional charges (for extra work)
  additionalCharges: [{
    description: String,
    amount: Number,
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  tracking: {
    isActive: {
      type: Boolean,
      default: false
    },
    trackingInitialized: Date,
    trackingStarted: Date,
    trackingEnded: Date,
    lastLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      timestamp: Date,
      accuracy: Number,
      heading: Number,
      speed: Number
    },
    initialETA: Number,
    eta: Number,
    initialDistance: Number,
    distance: Number,
    startedAt: Date,
    arrivedAt: Date,
    arrivalLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      timestamp: Date
    },
    liveTrackingEnabled: {
      type: Boolean,
      default: false
    },
    lastUpdate: Date,
    totalTravelTime: Number,
    averageSpeed: Number
  },
  
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    createdAt: Date
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'completed'],
    default: 'pending'
  },
  completedAt: Date,
  cancelledAt: Date,
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'cancelledByModel'
  },
  cancelledByModel: {
    type: String,
    enum: ['User', 'Professional']
  },
  cancellationReason: String,
  isEmergency: {
    type: Boolean,
    default: false
  },
  acceptedAt: Date,
  notes: String,
  reschedulingHistory: [{
    oldDate: Date,
    newDate: Date,
    rescheduledBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'rescheduledByModel'
    },
    rescheduledByModel: {
      type: String,
      enum: ['User', 'Professional']
    },
    rescheduledAt: Date,
    reason: String
  }]
}, {
  timestamps: true
});

// Indexes for better performance
bookingSchema.index({ location: '2dsphere' });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ professional: 1, status: 1 });
bookingSchema.index({ status: 1, scheduledDate: 1 });
bookingSchema.index({ 'tracking.lastLocation': '2dsphere' });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ isEmergency: -1, createdAt: 1 });
bookingSchema.index({ completionOTPSession: 1 }); // NEW INDEX

// Virtual for calculated ETA
bookingSchema.virtual('currentETA').get(function() {
  if (!this.professional?.currentLocation || !this.location?.coordinates) return null;
  
  const distance = this.calculateDistance(
    this.professional.currentLocation.coordinates[1],
    this.professional.currentLocation.coordinates[0],
    this.location.coordinates[1],
    this.location.coordinates[0]
  );
  
  return Math.round((distance / 30) * 60);
});

// Instance methods
bookingSchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

bookingSchema.methods.updateTracking = function(locationData) {
  if (!this.tracking) this.tracking = {};
  
  this.tracking.lastLocation = {
    type: 'Point',
    coordinates: locationData.coordinates,
    timestamp: new Date(),
    accuracy: locationData.accuracy || null,
    heading: locationData.heading || null,
    speed: locationData.speed || null
  };
  
  if (this.location?.coordinates) {
    const distance = this.calculateDistance(
      locationData.coordinates[1],
      locationData.coordinates[0],
      this.location.coordinates[1],
      this.location.coordinates[0]
    );
    
    this.tracking.distance = distance;
    this.tracking.eta = Math.round((distance / (locationData.speed || 30)) * 60);
  }
  
  this.tracking.lastUpdate = new Date();
  return this;
};

// Pre-save middleware
bookingSchema.pre('save', function(next) {
  if (this.location?.coordinates) {
    this.location.coordinates = this.location.coordinates.map(coord => parseFloat(coord));
  }
  
  if (this.tracking?.lastLocation?.coordinates) {
    this.tracking.lastLocation.coordinates = this.tracking.lastLocation.coordinates.map(coord => parseFloat(coord));
  }
  
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
