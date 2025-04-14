const { body } = require('express-validator');

const professionalValidation = {
  initiate: [
    body('email')
      .notEmpty()
      .withMessage('Email is required')
      .isEmail()
      .withMessage('Invalid email format')
      .trim()
      .normalizeEmail(),
    
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters')
      .matches(/^[a-zA-Z\s]+$/)
      .withMessage('Name can only contain letters and spaces')
  ],


  uploadDocument: [
    body('documentType')
      .trim()
      .notEmpty()
      .withMessage('Document type is required')
      .isIn(['id_proof', 'address_proof', 'qualification'])
      .withMessage('Invalid document type')
  ],

  verifyDocument: [
    body('professionalId')
      .trim()
      .notEmpty()
      .withMessage('Professional ID is required')
      .isMongoId()
      .withMessage('Invalid professional ID'),

    body('documentId')
      .trim()
      .notEmpty()
      .withMessage('Document ID is required')
      .isMongoId()
      .withMessage('Invalid document ID'),

    body('isValid')
      .isBoolean()
      .withMessage('isValid must be a boolean'),

    body('remarks')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Remarks cannot exceed 500 characters')
  ]
};

module.exports = professionalValidation;