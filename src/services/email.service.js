const nodemailer = require('nodemailer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

class EmailService {
  constructor() {
    // Create a transporter
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    // Template directory
    this.templateDir = path.join(__dirname, '../templates/emails');
    
    // Base URL for admin panel
    this.adminUrl = process.env.ADMIN_URL || 'https://admin.shayakpartner.com';
  }

  /**
   * Send an email
   * @param {Object} options - Email options
   * @param {String} options.template - Template name (without .ejs extension)
   * @param {String} options.to - Recipient email
   * @param {String} options.subject - Email subject
   * @param {Object} options.data - Data to pass to the template
   * @returns {Promise} - Nodemailer send result
   */
  async sendEmail(options) {
    try {
      const { template, to, subject, data = {} } = options;
      
      if (!template || !to || !subject) {
        throw new Error('Missing required email parameters');
      }

      // Template path
      const templatePath = path.join(this.templateDir, `${template}.ejs`);
      
      // Check if template exists
      if (!fs.existsSync(templatePath)) {
        throw new Error(`Email template not found: ${templatePath}`);
      }

      // Render the HTML template
      const html = await ejs.renderFile(templatePath, {
        ...data,
        adminUrl: this.adminUrl
      });

      // Send email
      const result = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || '"Shayak Partner" <support@shayakpartner.com>',
        to,
        subject,
        html,
      });

      logger.info(`Email sent: ${result.messageId}`);
      return result;
    } catch (error) {
      logger.error('Email sending error:', error);
      throw error;
    }
  }
}

module.exports = EmailService;