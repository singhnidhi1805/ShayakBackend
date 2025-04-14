const jwt = require('jsonwebtoken');
const Professional = require('../models/professional.model');
const otpService = require('../services/otp.service');
const { sendEmail } = require('../services/email.service');
const { sendSMS } = require('../services/sms.service');
const createError = require('http-errors');
const mongoose = require('mongoose');

class ProfessionalAuthController {
  // ✅ Send OTP for login/signup
  async sendOtp(req, res) {
    try {
      const { phone } = req.body;

      if (!phone) {
        throw createError(400, 'Phone number is required');
      }

      // Send OTP via SMS
      const { sessionId } = await otpService.sendOtp(phone);

      res.json({
        message: 'OTP sent successfully',
        sessionId
      });
    } catch (error) {
      console.error('Send OTP error:', error);
      res.status(error.status || 500).json({ error: error.message });
    }
  }

  // ✅ Verify OTP and handle login/signup
  async verifyOtp(req, res) {
    try {
      const { phone, otp, sessionId, role } = req.body;
  
      // Validation
      if (!phone || !otp || !sessionId || !role) {
        return res.status(400).json({ error: "All fields are required" });
      }
  
      if (role !== 'professional') {
        return res.status(400).json({ error: "Invalid role" });
      }
  
      // ✅ Real-time OTP verification
      const isValidOtp = await otpService.verifyOtp(phone, otp);
  
      if (!isValidOtp) {
        return res.status(401).json({ error: "Invalid OTP" });
      }
  
      // ✅ Find or create professional
      let professional = await Professional.findOne({ phone });
      
      if (!professional) {
        // Generate a unique userId
        const generateUserId = () => {
          return 'PRO' + Date.now().toString().slice(-8) +
                 Math.random().toString(36).substring(2, 5).toUpperCase();
        };
        
        let userId = generateUserId();
        let retryCount = 0;
        const maxRetries = 3;
  
        // Try to create with a unique userId
        while (retryCount < maxRetries) {
          try {
            professional = await Professional.create({
              phone,
              userId, // Store the generated ID directly
              name: "Pending",
              email: `${phone}@placeholder.com`,
              status: 'registration_pending',
              onboardingStep: 'welcome'
              // No need for employeeId reference
            });
            break;
          } catch (err) {
            if (err.code === 11000 && err.keyPattern && err.keyPattern.userId) {
              // Regenerate userId if duplicate
              userId = generateUserId();
              retryCount++;
              continue;
            }
            throw err;
          }
        }
  
        if (!professional) {
          throw new Error('Failed to generate unique userId');
        }
      }
  
      // ✅ Generate JWT token
      const token = jwt.sign(
        {
          id: professional._id,  // Use _id directly
          userId: professional.userId,
          role: 'professional',
          phone: professional.phone
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
  
      return res.status(200).json({
        message: "OTP verified successfully",
        token,
        user: {
          _id: professional._id,  // Include _id in the response
          userId: professional.userId,
          phone: professional.phone,
          role: 'professional',
          status: professional.status,
          onboardingStep: professional.onboardingStep,
          employeeId: professional.employeeId
        }
      });
  
    } catch (error) {
      console.error('Professional verify OTP error:', error);
      return res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
  
  // ✅ Update initial profile details
  async updateProfile(req, res) {
    try {
      const { name, email } = req.body;

      if (!name || !email) {
        throw createError(400, 'Name and email are required');
      }

      const professional = await Professional.findById(req.user._id);

      if (!professional) {
        throw createError(404, 'Professional not found');
      }

      if (professional.status !== 'registration_pending') {
        throw createError(400, 'Profile already completed');
      }

      // ✅ Update profile
      professional.name = name;
      professional.email = email;
      professional.status = 'document_pending';
      professional.onboardingStep = 'personal_details'; 
      await professional.save();

      // ✅ Send welcome email
      await sendEmail({
        to: email,
        template: 'welcome-professional',
        data: { name }
      });

      // ✅ Send SMS notification
      await sendSMS(
        professional.phone,
        `Welcome ${name}! Please upload your documents to complete verification.`
      );

      res.json({
        message: 'Profile updated successfully',
        professional
      });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  }
}

module.exports = new ProfessionalAuthController();