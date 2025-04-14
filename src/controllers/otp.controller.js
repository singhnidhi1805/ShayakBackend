const admin = require('../services/firebase.service');
const User = require('../models/user.model');
const Professional = require('../models/professional.model');
const Admin = require('../models/admin.model');
const jwt = require('jsonwebtoken');

const sendOtp = async (req, res) => {
    const { phone } = req.body;
  
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }
  
    try {
      // Use Firebase Authentication to send OTP
      const phoneNumber = `+91${phone}`; // E.164 format
      const verificationId = await admin.auth().createCustomToken(phoneNumber);
  
      return res.status(200).json({
        message: 'OTP sent successfully',
        verificationId,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }
  };
const verifyOtp = async (req, res) => {
  try {
    const { phone, otp, sessionId, role } = req.body;

    if (!phone || !otp || !sessionId || !role) {
      return res.status(400).json({ error: 'Phone, OTP, sessionId, and role are required' });
    }

    // Verify OTP with Firebase
    const decodedToken = await admin.auth().verifyIdToken(sessionId);

    if (!decodedToken || decodedToken.phone_number !== phone) {
      return res.status(401).json({ error: 'Invalid OTP or session' });
    }

    // Check or create the user in the database
    let user;
    if (role === 'user') {
      user = await User.findOne({ phone });
    } else if (role === 'professional') {
      user = await Professional.findOne({ phone });
    } else if (role === 'admin') {
      user = await Admin.findOne({ phone });
    }

    if (!user) {
      if (role === 'user') {
        user = new User({ phone });
      } else if (role === 'professional') {
        user = new Professional({ phone });
      } else if (role === 'admin') {
        user = new Admin({ phone });
      }
      await user.save();
    }

    // Generate JWT for the client
    const token = jwt.sign({ userId: user._id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  sendOtp,
  verifyOtp
};
