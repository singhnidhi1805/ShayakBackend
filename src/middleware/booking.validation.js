// validations/booking.validation.js
const Joi = require('joi');

const bookingValidation = {
  create: Joi.object({
    service: Joi.string().required().messages({
      'string.empty': 'Service is required',
      'any.required': 'Service is required'
    }),
    scheduledDate: Joi.date()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'Scheduled date must be in the future',
        'any.required': 'Scheduled date is required'
      }),
    location: Joi.object({
      coordinates: Joi.array()
        .items(Joi.number().required())
        .length(2)
        .required()
        .messages({
          'array.length': 'Location must contain exactly 2 coordinates [longitude, latitude]',
          'array.base': 'Location coordinates must be an array',
          'any.required': 'Location coordinates are required'
        }),
      address: Joi.string().required().messages({
        'string.empty': 'Address is required',
        'any.required': 'Address is required'
      })
    }).required(),
    totalAmount: Joi.number()
      .min(0)
      .required()
      .messages({
        'number.min': 'Total amount cannot be negative',
        'any.required': 'Total amount is required'
      }),
    notes: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      }),
    isEmergency: Joi.boolean()
      .default(false)
  }),

  update: Joi.object({
    status: Joi.string()
      .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')
      .required()
      .messages({
        'any.only': 'Invalid booking status',
        'any.required': 'Status is required'
      })
  }),

  reschedule: Joi.object({
    scheduledDate: Joi.date()
      .greater('now')
      .required()
      .messages({
        'date.greater': 'New scheduled date must be in the future',
        'any.required': 'New scheduled date is required'
      }),
    reason: Joi.string()
      .max(200)
      .required()
      .messages({
        'string.empty': 'Rescheduling reason is required',
        'string.max': 'Reason cannot exceed 200 characters',
        'any.required': 'Rescheduling reason is required'
      })
  }),

  review: Joi.object({
    rating: Joi.number()
      .min(1)
      .max(5)
      .required()
      .messages({
        'number.min': 'Rating must be at least 1',
        'number.max': 'Rating cannot be more than 5',
        'any.required': 'Rating is required'
      }),
    review: Joi.string()
      .max(500)
      .optional()
      .messages({
        'string.max': 'Review cannot exceed 500 characters'
      })
  }),

  verifyCompletion: Joi.object({
    verificationCode: Joi.string()
      .length(6)
      .pattern(/^[0-9]+$/)
      .required()
      .messages({
        'string.length': 'Verification code must be 6 digits',
        'string.pattern.base': 'Verification code must contain only numbers',
        'any.required': 'Verification code is required'
      })
  }),

  emergency: Joi.object({
    service: Joi.string().required(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string().required()
    }).required(),
    description: Joi.string()
      .max(1000)
      .required()
      .messages({
        'string.max': 'Emergency description cannot exceed 1000 characters',
        'any.required': 'Emergency description is required'
      }),
    priority: Joi.string()
      .valid('high', 'critical')
      .required()
      .messages({
        'any.only': 'Invalid emergency priority level',
        'any.required': 'Priority level is required'
      })
  }),

  preferenceMatch: Joi.object({
    service: Joi.object({
      category: Joi.string().required(),
      subCategory: Joi.string().optional()
    }).required(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string().required()
    }).required(),
    preferredSchedule: Joi.object({
      date: Joi.date().greater('now').required(),
      timeSlot: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
    }).required()
  })
};

module.exports = {
  bookingValidation
};