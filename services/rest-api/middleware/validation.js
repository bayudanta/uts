const Joi = require('joi');

// Skema validasi untuk registrasi
const registrationSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  teamName: Joi.string().min(2).max(50).optional() // Opsional saat registrasi
});

// Skema validasi untuk login
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Middleware
const validateRegistration = (req, res, next) => {
  const { error } = registrationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
    });
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      message: error.details[0].message,
    });
  }
  next();
};

module.exports = {
  validateRegistration,
  validateLogin
};