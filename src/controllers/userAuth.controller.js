const jwt = require('jsonwebtoken');
const otpService = require('../services/otp.service');
const User = require('../models/user.model');
const JWT_SECRET = process.env.JWT_SECRET;

// ✅ Send OTP
const sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const { sessionId } = await otpService.sendOtp(phone);

    res.json({
      message: 'OTP sent successfully',
      sessionId
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: error.message });
  }
};

// ✅ Verify OTP and Generate Token
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, role } = req.body;

    if (!phone || !otp || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Verify OTP using Twilio
    const isValidOtp = await otpService.verifyOtp(phone, otp);

    if (!isValidOtp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // ✅ Find or create user in database
    const dbUser = await User.findOneAndUpdate(
      { phone },
      {
        phone,
        role,
        userId: generateUserId(phone),
        updatedAt: new Date()
      },
      { upsert: true, new: true }
    );

    // ✅ Generate JWT token
    const token = jwt.sign(
      {
        id: dbUser._id,
        userId: dbUser.userId,
        phone: dbUser.phone,
        role: dbUser.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'OTP verified successfully',
      token,
      user: {
        ...dbUser.toJSON(),
        userId: dbUser.userId
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'OTP verification failed', details: error.message });
  }
};

// ✅ Generate Unique User ID
function generateUserId(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  const lastSixDigits = cleanPhone.slice(-6);
  const timestamp = Date.now().toString().slice(-4);
  return `U${lastSixDigits}${timestamp}`;
}

module.exports = {
  sendOtp,
  verifyOtp
};
