const Admin = require('../models/admin.model');
const jwt = require('jsonwebtoken');
const otpService = require('../services/otp.service');

exports.sendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // ✅ Check if phone number belongs to an admin
    const admin = await Admin.findOne({ phone });
    if (!admin) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // ✅ Send OTP via Twilio or Firebase
    const { sessionId } = await otpService.sendOtp(phone);

    res.json({
      message: 'OTP sent successfully',
      sessionId
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp, sessionId, role } = req.body;

    if (!phone || !otp || !sessionId || role !== 'admin') {
      return res.status(400).json({ 
        error: 'Phone, OTP, sessionId, and role are required' 
      });
    }

    // ✅ Real-time OTP verification
    const isValidOtp = await otpService.verifyOtp(phone, otp);

    if (!isValidOtp) {
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // ✅ Verify admin exists
    const admin = await Admin.findOne({ phone });
    if (!admin) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // ✅ Generate JWT token
    const token = jwt.sign(
      {
        id: admin._id,
        phone: admin.phone,
        role: 'admin'
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'OTP verified successfully',
      token,
      user: {
        ...admin.toObject(),
        role: 'admin'
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: error.message || 'OTP verification failed' });
  }
};
