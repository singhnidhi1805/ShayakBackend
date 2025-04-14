const Joi = require('joi');

const bookingValidation = {
  create: Joi.object({
    service: Joi.string().required(),
    scheduledDate: Joi.date().greater('now').required(),
    location: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      address: Joi.string().required()
    }).required(),
    notes: Joi.string().max(500)
  }),
  
  reschedule: Joi.object({
    scheduledDate: Joi.date().greater('now').required(),
    reason: Joi.string().max(200)
  })
};

const professionalValidation = {
  onboarding: Joi.object({
    categories: Joi.array().items(Joi.string()).min(1).required(),
    experience: Joi.number().min(0).required(),
    qualifications: Joi.array().items(Joi.string()),
    documents: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('id_proof', 'address_proof', 'qualification').required(),
        fileUrl: Joi.string().required()
      })
    ).min(2).required(),
    serviceArea: Joi.object({
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
      radius: Joi.number().max(15).default(15)
    }).required()
  })
};
module.exports = {
    bookingValidation,
    professionalValidation
  };