// middleware/validation.js
import { body, param, query, validationResult } from 'express-validator';

// Validation rules
const validationRules = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
    body('role').optional().isIn(['STUDENT', 'MANAGEMENT', 'ADMIN']),
  ],

  login: [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],

  createIssue: [
    body('title')
      .trim()
      .isLength({ min: 10, max: 100 })
      .withMessage('Title must be 10-100 characters'),
    body('description')
      .trim()
      .isLength({ min: 20, max: 500 })
      .withMessage('Description must be 20-500 characters'),
      
    body('category')
    .optional() 
    .isIn([
      'PLUMBING', 'ELECTRICAL', 'CLEANLINESS', 'INTERNET', 'FURNITURE',
      'MAINTENANCE', 'MESS_FOOD', 'MEDICAL', 'SECURITY', 'OTHER'
    ])
    .withMessage('Invalid category'),

    body('priority')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']),
    body('isPublic')
      .optional()
      .isBoolean(),
  ],

  updateStatus: [
    body('status')
      .isIn(['REPORTED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REJECTED'])
      .withMessage('Invalid status'),
    body('remarks')
      .optional()
      .trim()
      .isLength({ max: 500 }),
  ],

  assignIssue: [
    body('staffId').isMongoId().withMessage('Valid staff ID required'),
    body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY']),
    body('remarks').optional().trim().isLength({ max: 500 }),
  ],

  addComment: [
    body('comment')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Comment must be 1-500 characters'),
    body('parentId').optional().isUUID(),
  ],

  createAnnouncement: [
    body('title')
      .trim()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be 5-200 characters'),
    body('content')
      .trim()
      .notEmpty()
      .withMessage('Content is required'),
    body('category')
      .optional()
      .isIn(['MAINTENANCE', 'FOOD', 'EVENT', 'EMERGENCY', 'GENERAL']),
  ],

  createStaff: [
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('role').trim().notEmpty().withMessage('Role is required'),
    body('phone').isMobilePhone().withMessage('Valid phone number required'),
    body('email').optional().isEmail().normalizeEmail(),
  ],
};

// Validation middleware
export const validate = (validationType) => {
  return async (req, res, next) => {
    if (!validationRules[validationType]) {
      return next();
    }

    await Promise.all(
      validationRules[validationType].map(validation => validation.run(req))
    );

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map(err => ({
          field: err.path,
          message: err.msg,
        })),
      });
    }

    next();
  };
};

export { validationRules };