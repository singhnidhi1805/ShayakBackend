const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SID; // Ensure you have this in .env
const client = twilio(accountSid, authToken);

// ✅ Send OTP using Twilio Verify API
const sendOtp = async (phoneNumber) => {
  try {
    // Ensure phone number is formatted correctly
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    console.log(`Sending OTP to: ${formattedPhone}`);

    const verification = await client.verify.v2.services(verifySid)
      .verifications.create({ to: formattedPhone, channel: 'sms' });

    return { sessionId: verification.sid };
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw new Error('Failed to send OTP. Please try again.');
  }
};

// ✅ Verify OTP using Twilio Verify API
const verifyOtp = async (phoneNumber, code) => {
  try {
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+91${phoneNumber}`;

    console.log(`Verifying OTP for: ${formattedPhone}`);

    const verificationCheck = await client.verify.v2.services(verifySid)
      .verificationChecks.create({ to: formattedPhone, code });

    return verificationCheck.status === 'approved';
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw new Error('Invalid OTP or expired. Please try again.');
  }
};

module.exports = { sendOtp, verifyOtp };
