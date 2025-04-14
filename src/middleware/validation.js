const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: true
    });

    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      return res.status(400).json({ error: errorMessage });
    }

    next();
  };
};

const schemas = {
  registration: Joi.object({
    name: Joi.string().required().min(2).max(50),
    email: Joi.string().email().required(),
    password: Joi.string()
      .required()
      .min(8)
      .pattern(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .messages({
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
      }),
    phone: Joi.string()
      .required()
      .pattern(/^[0-9]{10}$/)
      .messages({
        'string.pattern.base': 'Phone number must be 10 digits'
      }),
    role: Joi.string().valid('user', 'professional').required(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required().pattern(/^[0-9]{6}$/)
    }).required()
  }),

  professionalOnboarding: Joi.object({
    specializations: Joi.array().items(Joi.string()).min(1).required(),
    experience: Joi.number().min(0).required(),
    serviceAreas: Joi.array().items(
      Joi.object({
        coordinates: Joi.array().items(Joi.number()).length(2).required(),
        radius: Joi.number().min(1).max(50).required()
      })
    ).min(1).required(),
    availability: Joi.object({
      schedule: Joi.array().items(
        Joi.object({
          day: Joi.string().valid(
            'monday', 'tuesday', 'wednesday', 'thursday',
            'friday', 'saturday', 'sunday'
          ).required(),
          slots: Joi.array().items(
            Joi.object({
              startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
              endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required()
            })
          ).min(1).required()
        })
      ).min(1).required()
    }).required(),
    bankDetails: Joi.object({
      accountHolder: Joi.string().required(),
      accountNumber: Joi.string().pattern(/^\d{9,18}$/).required(),
      bankName: Joi.string().required(),
      ifscCode: Joi.string().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required()
    }).required()
  }),

  booking: Joi.object({
    serviceId: Joi.string().required(),
    professionalId: Joi.string().required(),
    scheduledDate: Joi.date().greater('now').required(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string().required()
    }).required()
  })
};

module.exports = {
  validateRequest,
  schemas
};