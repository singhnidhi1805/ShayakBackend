const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    participants: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    messages: [{
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      content: String,
      type: {
        type: String,
        enum: ['text', 'image', 'location'],
        default: 'text'
      },
      media: String,
      location: {
        coordinates: [Number],
        address: String
      },
      readBy: [{
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        readAt: Date
      }],
      createdAt: {
        type: Date,
        default: Date.now
      }
    }],
    lastMessage: {
      content: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      createdAt: Date
    }
  });
  module.exports = mongoose.model('Chat', chatSchema);