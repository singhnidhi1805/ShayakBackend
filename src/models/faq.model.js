// src/models/faq.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const faqSchema = new Schema({
  category: {
    type: Schema.Types.ObjectId,
    ref: 'FAQCategory',
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isCommonIssue: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true
});

// Create indexes for efficient queries
faqSchema.index({ category: 1, order: 1 });
faqSchema.index({ isActive: 1, isCommonIssue: 1 });
faqSchema.index({ tags: 1 });
faqSchema.index({ 
  question: 'text', 
  answer: 'text', 
  tags: 'text' 
});

module.exports = mongoose.model('FAQ', faqSchema);