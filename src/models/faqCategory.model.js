// src/models/faqCategory.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const faqCategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create indexes for efficient queries
faqCategorySchema.index({ isActive: 1, order: 1 });

module.exports = mongoose.model('FAQCategory', faqCategorySchema);