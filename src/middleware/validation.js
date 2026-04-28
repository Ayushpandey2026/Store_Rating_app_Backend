const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const passwordRules = body('password')
  .isLength({ min: 8, max: 16 }).withMessage('Password must be 8-16 characters')
  .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
  .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character');

const nameRules = body('name')
  .isLength({ min: 20, max: 60 }).withMessage('Name must be 20-60 characters');

const emailRules = body('email')
  .isEmail().withMessage('Invalid email address')
  .normalizeEmail();

const addressRules = body('address')
  .optional()
  .isLength({ max: 400 }).withMessage('Address must be at most 400 characters');

const registerValidation = [nameRules, emailRules, passwordRules, addressRules, validate];
const loginValidation = [
  emailRules, 
  body('password').notEmpty().withMessage('Password is required'),
  validate
];
const updatePasswordValidation = [passwordRules, validate];

module.exports = { validate, registerValidation, loginValidation, updatePasswordValidation };
