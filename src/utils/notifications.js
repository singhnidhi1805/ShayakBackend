const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const Notification = require('../models/notification.model');
const User = require('../models/user.model');

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Notification titles and messages mapping
const notificationTemplates = {
  booking_request: {
    title: 'New Booking Request',
    message: (data) => `You have a new booking request for ${data.booking.service}`
  },
  booking_confirmation: {
    title: 'Booking Confirmed',
    message: (data) => `Your booking for ${data.booking.service} has been confirmed`
  },
  booking_cancelled: {
    title: 'Booking Cancelled',
    message: (data) => `Your booking for ${data.booking.service} has been cancelled`
  },
  booking_completed: {
    title: 'Booking Completed',
    message: (data) => `Your booking for ${data.booking.service} has been completed`
  },
  booking_rescheduled: {
    title: 'Booking Rescheduled',
    message: (data) => `Your booking for ${data.booking.service} has been rescheduled`
  },
  new_review: {
    title: 'New Review Received',
    message: (data) => `You received a new review for your service`
  }
};

// Get notification title and message from templates
const getNotificationContent = (type, data) => {
  const template = notificationTemplates[type];
  if (!template) {
    return {
      title: 'Notification',
      message: 'You have a new notification'
    };
  }
  return {
    title: template.title,
    message: template.message(data)
  };
};

// Generate email content
const generateEmailContent = (type, data) => {
  const { title, message } = getNotificationContent(type, data);
  return {
    subject: title,
    html: `
      <h1>${title}</h1>
      <p>${message}</p>
      ${type.startsWith('booking') ? `
        <div style="margin-top: 20px;">
          <h2>Booking Details</h2>
          <p>Service: ${data.booking.service}</p>
          <p>Date: ${new Date(data.booking.scheduledDate).toLocaleString()}</p>
          <p>Amount: $${data.booking.totalAmount}</p>
        </div>
      ` : ''}
    `
  };
};

// Send push notification
const sendPushNotification = async (deviceToken, title, message, data) => {
  try {
    if (!deviceToken) return;

    await admin.messaging().send({
      token: deviceToken,
      notification: {
        title,
        body: message
      },
      data: {
        type: data.type,
        bookingId: data.booking?._id?.toString() || '',
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    });
  } catch (error) {
    console.error('Push notification error:', error);
  }
};

// Send email notification
const sendEmailNotification = async (email, title, message, data) => {
  try {
    const emailContent = generateEmailContent(data.type, data);
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html
    });
  } catch (error) {
    console.error('Email notification error:', error);
  }
};

// Main notification sending function
const sendNotification = async (userId, type, data) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Get notification content
    const { title, message } = getNotificationContent(type, data);

    // Create notification in database
    const notification = await Notification.create({
      recipient: userId,
      type,
      title,
      message,
      data
    });

    // Send push notification if device token exists
    await sendPushNotification(user.deviceToken, title, message, {
      type,
      ...data
    });

    // Send email notification
    await sendEmailNotification(user.email, title, message, {
      type,
      ...data
    });

    return notification;
  } catch (error) {
    console.error('Notification error:', error);
    // Don't throw error to prevent blocking the main flow
    return null;
  }
};

// Mark notification as read
const markNotificationRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        recipient: userId
      },
      { read: true },
      { new: true }
    );
    return notification;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

// Get user notifications
const getUserNotifications = async (userId, query = {}) => {
  try {
    const { read, limit = 20, skip = 0 } = query;
    
    const filter = { recipient: userId };
    if (typeof read === 'boolean') {
      filter.read = read;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return notifications;
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
};

module.exports = {
  sendNotification,
  markNotificationRead,
  getUserNotifications
};