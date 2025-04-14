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
    tracking: {
        lastLocation: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: [Number],
            timestamp: Date
        },
        eta: Number,
        startedAt: Date,
        arrivedAt: Date
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
        ref: 'User'
    },
    reschedulingHistory: [{
        oldDate: Date,
        newDate: Date,
        rescheduledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        rescheduledAt: Date
    }]
}, {
    timestamps: true
});

// Add indexes
bookingSchema.index({ location: '2dsphere' });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ professional: 1, status: 1 });
bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ status: 1 });

// Add instance methods
bookingSchema.methods.calculateETA = function() {
    if (!this.professional?.currentLocation) return null;

    const R = 6371; // Earth's radius in km
    const [lon1, lat1] = this.professional.currentLocation.coordinates;
    const [lon2, lat2] = this.location.coordinates;

    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Assume average speed of 30 km/h
    return Math.round((distance / 30) * 60); // Returns ETA in minutes
};

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;