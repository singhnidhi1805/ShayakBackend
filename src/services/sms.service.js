const twilio = require('twilio');
const logger = require('../config/logger');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        to,
        from: process.env.TWILIO_PHONE_NUMBER
      });
      return result;
    } catch (error) {
      logger.error('SMS sending error:', error);
      throw error;
    }
  }
}

// module.exports = new SMSService();
module.exports = SMSService;
