// services/twilio.service.js
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID;
const client = twilio(accountSid, authToken);

/**
 * Send OTP using Twilio Verify API
 * @param {string} phoneNumber - Phone number in E.164 format (+91xxxxxxxxxx)
 * @returns {Promise<{sessionId: string}>}
 */
const sendOtp = async (phoneNumber) => {
  try {
    // Ensure phone number is formatted correctly
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    console.log(`📱 [TWILIO] Sending OTP to: ${formattedPhone}`);

    const verification = await client.verify.v2.services(verifySid)
      .verifications.create({ 
        to: formattedPhone, 
        channel: 'sms' 
      });

    console.log(`✅ [TWILIO] OTP sent successfully. SID: ${verification.sid}`);

    return { 
      sessionId: verification.sid,
      status: verification.status
    };
  } catch (error) {
    console.error('❌ [TWILIO] Error sending OTP:', error);
    throw new Error(`Failed to send OTP: ${error.message}`);
  }
};

/**
 * Verify OTP using Twilio Verify API
 * @param {string} phoneNumber - Phone number in E.164 format (+91xxxxxxxxxx)
 * @param {string} code - OTP code to verify
 * @returns {Promise<boolean>}
 */
const verifyOtp = async (phoneNumber, code) => {
  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    console.log(`🔍 [TWILIO] Verifying OTP for: ${formattedPhone}`);

    const verificationCheck = await client.verify.v2.services(verifySid)
      .verificationChecks.create({ 
        to: formattedPhone, 
        code: code.toString() 
      });

    const isValid = verificationCheck.status === 'approved';
    
    if (isValid) {
      console.log(`✅ [TWILIO] OTP verified successfully`);
    } else {
      console.log(`❌ [TWILIO] OTP verification failed. Status: ${verificationCheck.status}`);
    }

    return isValid;
  } catch (error) {
    console.error('❌ [TWILIO] Error verifying OTP:', error);
    
    // If the error is about invalid code, return false instead of throwing
    if (error.status === 404 || error.code === 60200) {
      console.log('❌ [TWILIO] Invalid or expired OTP');
      return false;
    }
    
    throw new Error(`Failed to verify OTP: ${error.message}`);
  }
};

/**
 * Check verification status
 * @param {string} phoneNumber - Phone number in E.164 format
 * @param {string} verificationSid - Verification SID
 * @returns {Promise<object>}
 */
const checkVerificationStatus = async (phoneNumber, verificationSid) => {
  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    const verification = await client.verify.v2.services(verifySid)
      .verifications(verificationSid)
      .fetch();

    return {
      status: verification.status,
      valid: verification.valid,
      dateCreated: verification.dateCreated
    };
  } catch (error) {
    console.error('❌ [TWILIO] Error checking verification status:', error);
    throw new Error(`Failed to check verification status: ${error.message}`);
  }
};

/**
 * Cancel a verification
 * @param {string} phoneNumber - Phone number in E.164 format
 * @param {string} verificationSid - Verification SID
 * @returns {Promise<object>}
 */
const cancelVerification = async (phoneNumber, verificationSid) => {
  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    const verification = await client.verify.v2.services(verifySid)
      .verifications(verificationSid)
      .update({ status: 'canceled' });

    console.log(`✅ [TWILIO] Verification canceled: ${verification.sid}`);
    
    return {
      status: verification.status,
      sid: verification.sid
    };
  } catch (error) {
    console.error('❌ [TWILIO] Error canceling verification:', error);
    throw new Error(`Failed to cancel verification: ${error.message}`);
  }
};

module.exports = { 
  sendOtp, 
  verifyOtp,
  checkVerificationStatus,
  cancelVerification
};