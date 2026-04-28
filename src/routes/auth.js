const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');
const { registerValidation, loginValidation } = require('../middleware/validation');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

router.post('/register', registerValidation, authController.register);
router.post('/login', loginValidation, authController.login);
router.get('/me', authenticate, authController.getMe);
router.put('/update-password', authenticate,
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('password').isLength({ min: 8, max: 16 }).matches(/[A-Z]/).matches(/[!@#$%^&*(),.?":{}|<>]/),
  validate,
  authController.updatePassword
);

module.exports = router;
