// src/models/chatMessage.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatMessageSchema = new Schema({
  session: {
    type: Schema.Types.ObjectId,
    ref: 'ChatSession',
    required: true
  },
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderRole: {
    type: String,
    enum: ['user', 'professional', 'admin'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  readAt: {
    type: Date
  }
});

// Create indexes for efficient queries
chatMessageSchema.index({ session: 1, sentAt: 1 });
chatMessageSchema.index({ sender: 1 });
chatMessageSchema.index({ readAt: 1 }); // For unread messages

module.exports = mongoose.model('ChatMessage', chatMessageSchema);