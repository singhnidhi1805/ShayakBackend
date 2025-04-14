const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['booking_request', 'booking_confirmation', 'booking_cancellation', 
             'document_verification', 'payment_success', 'review_received',
             'location_update', 'service_reminder', 'promotional'],
      required: true
    },
    title: String,
    message: String,
    data: Object,
    read: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });
  
  