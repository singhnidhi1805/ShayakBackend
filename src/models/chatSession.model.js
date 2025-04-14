// src/models/chatSession.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatSessionSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userRole: {
    type: String,
    enum: ['user', 'professional'],
    required: true
  },
  admin: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  startedAt: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active'
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  feedback: {
    type: String
  }
}, {
  timestamps: true
});

// Create indexes for efficient queries
chatSessionSchema.index({ user: 1 });
chatSessionSchema.index({ admin: 1 });
chatSessionSchema.index({ status: 1 });
chatSessionSchema.index({ startedAt: -1 });

module.exports = mongoose.model('ChatSession', chatSessionSchema);