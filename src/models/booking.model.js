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
                 coordinates[0] >= -180 && coordinates[0] <= 180 && // longitude
                 coordinates[1] >= -90 && coordinates[1] <= 90;     // latitude
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
  // Enhanced tracking object
  tracking: {
    // Basic tracking info
    isActive: {
      type: Boolean,
      default: false
    },
    trackingInitialized: Date,
    trackingStarted: Date,
    trackingEnded: Date,
    
    // Professional location tracking
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
    
    // ETA and distance calculations
    initialETA: Number,        // Initial ETA when booking accepted
    eta: Number,               // Current ETA
    initialDistance: Number,   // Initial distance when booking accepted
    distance: Number,          // Current distance
    
    // Timeline events
    startedAt: Date,           // When service started
    arrivedAt: Date,           // When professional arrived
    arrivalLocation: {         // Location where professional arrived
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: [Number],
      timestamp: Date
    },
    
    // Additional tracking data
    liveTrackingEnabled: {
      type: Boolean,
      default: false
    },
    lastUpdate: Date,          // Last tracking update
    totalTravelTime: Number,   // Total travel time in minutes
    averageSpeed: Number       // Average speed during travel
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
    enum: ['pending', 'paid', 'refunded'],
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

// Virtual for calculated ETA based on current location
bookingSchema.virtual('currentETA').get(function() {
  if (!this.professional?.currentLocation || !this.location?.coordinates) return null;
  
  const distance = this.calculateDistance(
    this.professional.currentLocation.coordinates[1],
    this.professional.currentLocation.coordinates[0],
    this.location.coordinates[1],
    this.location.coordinates[0]
  );
  
  return Math.round((distance / 30) * 60); // Assuming 30 km/h average speed
});

// Instance method to calculate distance
bookingSchema.methods.calculateDistance = function(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Instance method to update tracking
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
  
  // Calculate distance and ETA
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

// Pre-save middleware to ensure location data integrity
bookingSchema.pre('save', function(next) {
  // Ensure location coordinates are numbers
  if (this.location?.coordinates) {
    this.location.coordinates = this.location.coordinates.map(coord => parseFloat(coord));
  }
  
  // Ensure tracking location coordinates are numbers
  if (this.tracking?.lastLocation?.coordinates) {
    this.tracking.lastLocation.coordinates = this.tracking.lastLocation.coordinates.map(coord => parseFloat(coord));
  }
  
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);