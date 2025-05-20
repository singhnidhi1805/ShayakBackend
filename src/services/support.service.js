// src/services/support.service.js
const Ticket = require('../models/ticket.model');
const TicketReply = require('../models/ticketReply.model');
const FAQ = require('../models/faq.model');
const FAQCategory = require('../models/faqCategory.model');
const User = require('../models/user.model');
const Professional = require('../models/professional.model');
const Feedback = require('../models/feedback.model');
const ChatSession = require('../models/chatSession.model');
const ChatMessage = require('../models/chatMessage.model');
const NotificationService = require('./notification.service');
const { uploadToS3 } = require('../utils/fileUpload');
const logger = require('../config/logger');

class SupportService {
  /**
   * Get FAQ categories
   * @returns {Promise<Array>} FAQ categories
   */
  async getFAQCategories() {
    try {
      const categories = await FAQCategory.find({ isActive: true }).sort({ order: 1 });
      return categories;
    } catch (error) {
      logger.error('Get FAQ categories error:', error);
      throw error;
    }
  }

  /**
   * Get FAQs by category
   * @param {string} categoryId - Category ID
   * @returns {Promise<Array>} FAQs
   */
  async getFAQs(categoryId) {
    try {
      const query = { isActive: true };
      
      if (categoryId) {
        query.category = categoryId;
      }
      
      const faqs = await FAQ.find(query)
        .populate('category', 'name')
        .sort({ order: 1 });
        
      return faqs;
    } catch (error) {
      logger.error('Get FAQs error:', error);
      throw error;
    }
  }

  /**
   * Search FAQs
   * @param {string} query - Search query
   * @returns {Promise<Array>} Search results
   */
  async searchFAQs(query) {
    try {
      if (!query || query.length < 3) {
        throw new Error('Search query must be at least 3 characters');
      }
      
      const faqs = await FAQ.find({
        isActive: true,
        $or: [
          { question: { $regex: query, $options: 'i' } },
          { answer: { $regex: query, $options: 'i' } },
          { tags: { $regex: query, $options: 'i' } }
        ]
      }).populate('category', 'name');
      
      return faqs;
    } catch (error) {
      logger.error('Search FAQs error:', error);
      throw error;
    }
  }

  /**
 * Get support tickets
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Array>} Support tickets
 */
async getTickets(userId, role) {
  try {
    let query = {};
    
    // If not admin, only show user's tickets
    if (role !== 'admin') {
      if (role === 'professional') {
        // Try to find professional by userId or _id
        const professional = await Professional.findOne({
          $or: [{ userId }, { _id: userId }]
        });
        
        if (professional) {
          query.user = professional._id;
          query.userRole = 'professional';
        } else {
          throw new Error('Professional not found');
        }
      } else {
        // Regular users
        query.user = userId;
        query.userRole = 'user';
      }
    }
    
    const tickets = await Ticket.find(query)
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    
    return tickets;
  } catch (error) {
    logger.error('Get tickets error:', error);
    throw error;
  }
}


  /**
 * Get ticket details
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Ticket details
 */
async getTicketDetails(ticketId, userId, role) {
  try {
    const ticket = await Ticket.findById(ticketId)
      .populate('user', 'name email')
      .populate('assignedTo', 'name email');
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Check if user has access to this ticket
    // For professionals, we need to handle differently
    if (role === 'admin') {
      // Admin has access to all tickets
    } else if (role === 'professional') {
      // Try to find professional by userId or _id
      const professional = await Professional.findOne({ 
        $or: [{ userId }, { _id: userId }]
      });
      
      if (!professional || (ticket.userRole === 'professional' && ticket.user.toString() !== professional._id.toString())) {
        throw new Error('Not authorized to access this ticket');
      }
    } else {
      // Regular users
      if (ticket.user.toString() !== userId) {
        throw new Error('Not authorized to access this ticket');
      }
    }
    
    // Get ticket replies
    const replies = await TicketReply.find({ ticket: ticketId })
      .populate('user', 'name email role')
      .sort({ createdAt: 1 });
    
    return {
      ticket,
      replies
    };
  } catch (error) {
    logger.error('Get ticket details error:', error);
    throw error;
  }
}

 /**
 * Create a support ticket
 * @param {Object} ticketData - Ticket data
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Created ticket
 */
async createTicket(ticketData, userId, role) {
  try {
    const { subject, message, category, priority = 'medium' } = ticketData;
    
    if (!subject || !message) {
      throw new Error('Subject and message are required');
    }
    
    // Modified approach to handle both user and professional roles
    let userInfo = null;
    
    if (role === 'user') {
      userInfo = await User.findById(userId);
      if (!userInfo) {
        throw new Error('User not found');
      }
    } else if (role === 'professional') {
      // Try to find by userId field first
      userInfo = await Professional.findOne({ userId });
      
      // If not found, try to find by _id (MongoDB ID)
      if (!userInfo) {
        userInfo = await Professional.findById(userId);
      }
      
      if (!userInfo) {
        // Log additional info for debugging
        logger.error(`Professional not found. userId: ${userId}, role: ${role}`);
        throw new Error('Professional not found');
      }
    }
    
    // Generate ticket number
    const ticketCount = await Ticket.countDocuments();
    const ticketNumber = `TIC${new Date().getFullYear()}${(ticketCount + 1).toString().padStart(6, '0')}`;
    
    // Create ticket
    const ticket = new Ticket({
      ticketNumber,
      user: role === 'professional' ? userInfo._id : userId, // Use the correct ID depending on role
      subject,
      message,
      category,
      priority,
      status: 'open',
      userRole: role
    });
    
    await ticket.save();
    
    // Notify admins about new ticket
    const admins = await User.find({ role: 'admin' });
    
    for (const admin of admins) {
      await NotificationService.createNotification({
        recipient: admin._id,
        type: 'new_ticket',
        title: 'New Support Ticket',
        message: `New ticket submitted: ${subject}`,
        data: { ticketId: ticket._id }
      });
    }
    
    return ticket;
  } catch (error) {
    logger.error('Create ticket error:', error);
    throw error;
  }
}
 /**
 * Reply to a ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} message - Reply message
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Added reply
 */
async replyToTicket(ticketId, message, userId, role) {
  try {
    if (!message) {
      throw new Error('Message is required');
    }
    
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Check if user has access to this ticket
    if (role === 'admin') {
      // Admin has access to all tickets
    } else if (role === 'professional') {
      // Try to find professional by userId or _id
      const professional = await Professional.findOne({
        $or: [{ userId }, { _id: userId }]
      });
      
      if (!professional || (ticket.userRole === 'professional' && ticket.user.toString() !== professional._id.toString())) {
        throw new Error('Not authorized to reply to this ticket');
      }
      
      // Use professional's MongoDB ID for the reply
      userId = professional._id;
    } else {
      // Regular users
      if (ticket.user.toString() !== userId) {
        throw new Error('Not authorized to reply to this ticket');
      }
    }
    
    // Check if ticket is closed
    if (ticket.status === 'closed') {
      throw new Error('Cannot reply to a closed ticket');
    }
    
    // Create reply
    const reply = new TicketReply({
      ticket: ticketId,
      user: userId,
      message,
      userRole: role
    });
    
    await reply.save();
    
    // Update ticket status if it was pending
    if (ticket.status === 'pending' && role === 'admin') {
      ticket.status = 'open';
      await ticket.save();
    }
    
    // If user replied and ticket is open, change status to pending
    if (role !== 'admin' && ticket.status === 'open') {
      ticket.status = 'pending';
      await ticket.save();
    }
    
    // Notify the other party about the reply
    if (role === 'admin') {
      // Notify ticket creator
      await NotificationService.createNotification({
        recipient: ticket.user,
        type: 'ticket_reply',
        title: 'New Reply to Your Ticket',
        message: 'Support has replied to your ticket',
        data: { ticketId: ticket._id }
      });
    } else {
      // Notify admins
      const admins = await User.find({ role: 'admin' });
      
      for (const admin of admins) {
        await NotificationService.createNotification({
          recipient: admin._id,
          type: 'ticket_reply',
          title: 'New User Reply',
          message: `New reply on ticket ${ticket.ticketNumber}`,
          data: { ticketId: ticket._id }
        });
      }
    }
    
    return reply;
  } catch (error) {
    logger.error('Reply to ticket error:', error);
    throw error;
  }
}


 /**
 * Close a support ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Updated ticket
 */
async closeTicket(ticketId, userId, role) {
  try {
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Check if user has access to this ticket
    if (role === 'admin') {
      // Admin has access to all tickets
    } else if (role === 'professional') {
      // Try to find professional by userId or _id
      const professional = await Professional.findOne({
        $or: [{ userId }, { _id: userId }]
      });
      
      if (!professional || (ticket.userRole === 'professional' && ticket.user.toString() !== professional._id.toString())) {
        throw new Error('Not authorized to close this ticket');
      }
      
      // Use professional's MongoDB ID for closing
      userId = professional._id;
    } else {
      // Regular users
      if (ticket.user.toString() !== userId) {
        throw new Error('Not authorized to close this ticket');
      }
    }
    
    // Check if ticket is already closed
    if (ticket.status === 'closed') {
      throw new Error('Ticket is already closed');
    }
    
    // Update ticket status
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedBy = userId;
    
    await ticket.save();
    
    // Notify the other party about the closure
    if (role === 'admin') {
      // Notify ticket creator
      await NotificationService.createNotification({
        recipient: ticket.user,
        type: 'ticket_closed',
        title: 'Support Ticket Closed',
        message: 'Your support ticket has been closed',
        data: { ticketId: ticket._id }
      });
    } else {
      // Notify admins if assigned
      if (ticket.assignedTo) {
        await NotificationService.createNotification({
          recipient: ticket.assignedTo,
          type: 'ticket_closed',
          title: 'Support Ticket Closed',
          message: `Ticket ${ticket.ticketNumber} has been closed by the user`,
          data: { ticketId: ticket._id }
        });
      }
    }
    
    return ticket;
  } catch (error) {
    logger.error('Close ticket error:', error);
    throw error;
  }
}

  /**
 * Reopen a support ticket
 * @param {string} ticketId - Ticket ID
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Updated ticket
 */
async reopenTicket(ticketId, userId, role) {
  try {
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Check if user has access to this ticket
    if (role === 'admin') {
      // Admin has access to all tickets
    } else if (role === 'professional') {
      // Try to find professional by userId or _id
      const professional = await Professional.findOne({
        $or: [{ userId }, { _id: userId }]
      });
      
      if (!professional || (ticket.userRole === 'professional' && ticket.user.toString() !== professional._id.toString())) {
        throw new Error('Not authorized to reopen this ticket');
      }
      
      // Use professional's MongoDB ID for reopening
      userId = professional._id;
    } else {
      // Regular users
      if (ticket.user.toString() !== userId) {
        throw new Error('Not authorized to reopen this ticket');
      }
    }
    
    // Check if ticket is already open
    if (ticket.status !== 'closed') {
      throw new Error('Ticket is not closed');
    }
    
    // Update ticket status
    ticket.status = role === 'admin' ? 'open' : 'pending';
    ticket.reopenedAt = new Date();
    ticket.reopenedBy = userId;
    
    await ticket.save();
    
    // Notify the other party about the reopening
    if (role === 'admin') {
      // Notify ticket creator
      await NotificationService.createNotification({
        recipient: ticket.user,
        type: 'ticket_reopened',
        title: 'Support Ticket Reopened',
        message: 'Your support ticket has been reopened',
        data: { ticketId: ticket._id }
      });
    } else {
      // Notify admins
      const admins = await User.find({ role: 'admin' });
      
      for (const admin of admins) {
        await NotificationService.createNotification({
          recipient: admin._id,
          type: 'ticket_reopened',
          title: 'Support Ticket Reopened',
          message: `Ticket ${ticket.ticketNumber} has been reopened by the user`,
          data: { ticketId: ticket._id }
        });
      }
    }
    
    return ticket;
  } catch (error) {
    logger.error('Reopen ticket error:', error);
    throw error;
  }
}
  /**
 * Upload attachment to a ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} file - File object
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Uploaded attachment
 */
async uploadAttachment(ticketId, file, userId, role) {
  try {
    if (!file) {
      throw new Error('File is required');
    }
    
    const ticket = await Ticket.findById(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Check if user has access to this ticket
    if (role === 'admin') {
      // Admin has access to all tickets
    } else if (role === 'professional') {
      // Try to find professional by userId or _id
      const professional = await Professional.findOne({
        $or: [{ userId }, { _id: userId }]
      });
      
      if (!professional || (ticket.userRole === 'professional' && ticket.user.toString() !== professional._id.toString())) {
        throw new Error('Not authorized to upload attachment to this ticket');
      }
      
      // Use professional's MongoDB ID for the attachment
      userId = professional._id;
    } else {
      // Regular users
      if (ticket.user.toString() !== userId) {
        throw new Error('Not authorized to upload attachment to this ticket');
      }
    }
    
    // Check if ticket is closed
    if (ticket.status === 'closed') {
      throw new Error('Cannot upload attachment to a closed ticket');
    }
    
    // Upload file to S3
    const fileKey = `tickets/${ticketId}/attachments/${Date.now()}_${file.originalname}`;
    const fileUrl = await uploadToS3(file, fileKey);
    
    // Create attachment
    const attachment = {
      fileName: file.originalname,
      fileUrl,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedBy: userId,
      uploadedAt: new Date()
    };
    
    // Add attachment to ticket
    ticket.attachments.push(attachment);
    await ticket.save();
    
    return attachment;
  } catch (error) {
    logger.error('Upload attachment error:', error);
    throw error;
  }
}
  /**
   * Get common issues and solutions
   * @returns {Promise<Array>} Common issues and solutions
   */
  async getCommonIssues() {
    try {
      const commonIssues = await FAQ.find({
        isActive: true,
        isCommonIssue: true
      }).populate('category', 'name');
      
      return commonIssues;
    } catch (error) {
      logger.error('Get common issues error:', error);
      throw error;
    }
  }

  /**
 * Send feedback about the app
 * @param {Object} feedbackData - Feedback data
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Saved feedback
 */
async sendFeedback(feedbackData, userId, role) {
  try {
    const { type, message, rating } = feedbackData;
    
    if (!type || !message || !rating) {
      throw new Error('Type, message, and rating are required');
    }
    
    // Handle professional users
    if (role === 'professional') {
      // Try to find professional by userId or _id
      const professional = await Professional.findOne({
        $or: [{ userId }, { _id: userId }]
      });
      
      if (professional) {
        // Use professional's MongoDB ID
        userId = professional._id;
      } else {
        throw new Error('Professional not found');
      }
    }
    
    // Create feedback
    const feedback = new Feedback({
      user: userId,
      userRole: role,
      type,
      message,
      rating,
      submittedAt: new Date()
    });
    
    await feedback.save();
    
    // Notify admins about new feedback
    const admins = await User.find({ role: 'admin' });
    
    for (const admin of admins) {
      await NotificationService.createNotification({
        recipient: admin._id,
        type: 'new_feedback',
        title: 'New App Feedback',
        message: `New ${type} feedback with rating ${rating}/5`,
        data: { feedbackId: feedback._id }
      });
    }
    
    return feedback;
  } catch (error) {
    logger.error('Send feedback error:', error);
    throw error;
  }
}

  /**
   * Check if support is available for live chat
   * @returns {Promise<Object>} Availability status
   */
  async checkLiveChatAvailability() {
    try {
      // Get current time in IST
      const now = new Date();
      const hours = now.getHours();
      const day = now.getDay(); // 0 is Sunday, 6 is Saturday
      
      // Check if current time is within support hours (9 AM to 6 PM, Monday to Friday)
      const isWithinSupportHours = hours >= 9 && hours < 18 && day >= 1 && day <= 5;
      
      // Check if any admin is online
      const onlineAdmins = await User.countDocuments({
        role: 'admin',
        isOnline: true,
        lastActive: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // Active in the last 5 minutes
      });
      
      return {
        isAvailable: isWithinSupportHours && onlineAdmins > 0,
        supportHours: {
          start: '9:00 AM',
          end: '6:00 PM',
          timezone: 'IST',
          days: 'Monday to Friday'
        },
        onlineAgents: onlineAdmins
      };
    } catch (error) {
      logger.error('Check live chat availability error:', error);
      throw error;
    }
  }

  /**
 * Initiate a live chat session
 * @param {Object} chatData - Chat initialization data
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {Promise<Object>} Chat session data
 */
async initiateLiveChat(chatData, userId, role) {
  try {
    const { topic, message } = chatData;
    
    if (!topic || !message) {
      throw new Error('Topic and message are required');
    }
    
    // Check availability
    const availability = await this.checkLiveChatAvailability();
    
    if (!availability.isAvailable) {
      throw new Error('Live chat support is not available at the moment');
    }
    
    // Get user info
    let userInfo;
    if (role === 'user') {
      userInfo = await User.findById(userId).select('name email phone');
    } else if (role === 'professional') {
      // Try to find professional by userId or _id
      userInfo = await Professional.findOne({
        $or: [{ userId }, { _id: userId }]
      }).select('name email phone');
      
      if (userInfo) {
        // Use professional's MongoDB ID
        userId = userInfo._id;
      } else {
        throw new Error('Professional not found');
      }
    }
    
    if (!userInfo) {
      throw new Error('User not found');
    }
    
    // Find available admin
    const admin = await User.findOne({
      role: 'admin',
      isOnline: true,
      lastActive: { $gt: new Date(Date.now() - 5 * 60 * 1000) } // Active in the last 5 minutes
    }).select('_id name');
    
    if (!admin) {
      throw new Error('No support agents available at the moment');
    }
    
    // Create chat session
    const chatSession = new ChatSession({
      user: userId,
      userRole: role,
      admin: admin._id,
      topic,
      startedAt: new Date(),
      status: 'active'
    });
    
    await chatSession.save();
    
    // Create initial message
    const initialMessage = new ChatMessage({
      session: chatSession._id,
      sender: userId,
      senderRole: role,
      message,
      sentAt: new Date()
    });
    
    await initialMessage.save();
    
    // Notify admin about new chat
    await NotificationService.createNotification({
      recipient: admin._id,
      type: 'new_chat',
      title: 'New Live Chat Request',
      message: `New chat request from ${userInfo.name}: ${topic}`,
      data: { chatSessionId: chatSession._id }
    });
    
    return {
      sessionId: chatSession._id,
      agent: {
        id: admin._id,
        name: admin.name
      },
      startedAt: chatSession.startedAt,
      status: chatSession.status
    };
  } catch (error) {
    logger.error('Initiate live chat error:', error);
    throw error;
  }
}
}

module.exports = new SupportService();
