const admin = require('firebase-admin');
const User = require('../models/user.model');
const Professional = require('../models/professional.model');
const logger = require('../config/logger');

class NotificationService {
    constructor() {
        // Initialize Firebase Admin if not already initialized
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
                })
            });
        }
    }

    async sendNotification(userId, type, data) {
        try {
          // Just pass through to the existing push notification method
          return await this.sendPushNotification(userId, {
            type,
            ...data
          });
        } catch (error) {
          logger.error('Notification failed:', error);
          // Don't throw error, just log it to prevent API hanging
          return false;
        }
      }

    async sendPushNotification(userId, data) {
        try {
            // Get user's FCM token
            const user = await User.findById(userId);
            const professional = await Professional.findById(userId);
            
            const deviceToken = user?.deviceToken || professional?.deviceToken;
            
            if (!deviceToken) {
                logger.warn('No device token found for user:', userId);
                return;
            }

            // Create notification content
            const notification = this.createNotificationContent(data);

            // Send to Firebase
            await admin.messaging().send({
                token: deviceToken,
                notification: {
                    title: notification.title,
                    body: notification.body
                },
                data: {
                    type: data.type,
                    bookingId: data.bookingId?.toString() || '',
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                },
                android: {
                    priority: data.priority || 'high',
                    notification: {
                        sound: 'default',
                        channelId: 'booking_channel'
                    }
                },
                apns: {
                    payload: {
                        aps: {
                            sound: 'default',
                            badge: 1
                        }
                    }
                }
            });

            logger.info('Push notification sent successfully', {
                userId,
                type: data.type
            });

        } catch (error) {
            logger.error('Push notification failed:', error);
            throw error;
        }
    }

    createNotificationContent(data) {
        switch (data.type) {
            case 'NEW_BOOKING_REQUEST':
                return {
                    title: 'New Booking Request',
                    body: `New request for ${data.serviceName} nearby`
                };
            
            case 'BOOKING_ACCEPTED':
                return {
                    title: 'Booking Accepted',
                    body: `Your booking has been accepted by ${data.professionalName}`
                };
            
            case 'BOOKING_COMPLETED':
                return {
                    title: 'Service Completed',
                    body: 'Your service has been completed. Please rate your experience.'
                };
            
            case 'PROFESSIONAL_ARRIVED':
                return {
                    title: 'Professional Arrived',
                    body: 'Your service professional has arrived at the location.'
                };
            
            case 'PROFESSIONAL_LOCATION':
                return {
                    title: 'Professional Location Update',
                    body: `Your professional is ${data.distance}km away`
                };
            
            default:
                return {
                    title: 'Booking Update',
                    body: 'There is an update to your booking'
                };
        }
    }

    // Send notifications to multiple users
    async broadcastToNearbyProfessionals(bookingData, professionals) {
        try {
            const notifications = professionals.map(professional => 
                this.sendPushNotification(professional._id, {
                    type: 'NEW_BOOKING_REQUEST',
                    bookingId: bookingData._id,
                    serviceName: bookingData.service.name,
                    location: bookingData.location
                })
            );

            await Promise.allSettled(notifications);
            logger.info(`Broadcast sent to ${professionals.length} professionals`);
        } catch (error) {
            logger.error('Broadcast failed:', error);
            throw error;
        }
    }
}

module.exports = new NotificationService();