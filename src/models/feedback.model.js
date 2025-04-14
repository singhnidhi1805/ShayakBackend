// src/models/feedback.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const feedbackSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userRole: {
    type: String,
    enum: ['user', 'professional', 'admin'],
    required: true
  },
  type: {
    type: String,
    enum: ['general', 'feature', 'bug'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for efficient queries
feedbackSchema.index({ user: 1 });
feedbackSchema.index({ type: 1 });
feedbackSchema.index({ rating: 1 });
feedbackSchema.index({ submittedAt: -1 });

module.exports = mongoose.model('Feedback', feedbackSchema);