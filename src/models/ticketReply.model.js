// src/models/ticketReply.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ticketReplySchema = new Schema({
  ticket: {
    type: Schema.Types.ObjectId,
    ref: 'Ticket',
    required: true
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  userRole: {
    type: String,
    enum: ['user', 'professional', 'admin'],
    required: true
  }
}, {
  timestamps: true
});

// Create indexes for efficient queries
ticketReplySchema.index({ ticket: 1, createdAt: 1 });
ticketReplySchema.index({ user: 1 });

module.exports = mongoose.model('TicketReply', ticketReplySchema);