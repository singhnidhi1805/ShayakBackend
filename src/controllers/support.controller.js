// src/controllers/support.controller.js
const SupportService = require('../services/support.service');
const logger = require('../config/logger');

class SupportController {
  /**
   * Get FAQ categories
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getFAQCategories(req, res) {
    try {
      const categories = await SupportService.getFAQCategories();
      
      res.status(200).json({
        success: true,
        categories
      });
    } catch (error) {
      logger.error('Get FAQ categories error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch FAQ categories',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get FAQs by category
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getFAQs(req, res) {
    try {
      const { categoryId } = req.query;
      const faqs = await SupportService.getFAQs(categoryId);
      
      res.status(200).json({
        success: true,
        faqs
      });
    } catch (error) {
      logger.error('Get FAQs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch FAQs',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Search FAQs
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async searchFAQs(req, res) {
    try {
      const { query } = req.query;
      
      if (!query || query.length < 3) {
        return res.status(400).json({
          success: false,
          error: 'Invalid search query',
          details: 'Search query must be at least 3 characters'
        });
      }
      
      const faqs = await SupportService.searchFAQs(query);
      
      res.status(200).json({
        success: true,
        faqs,
        query
      });
    } catch (error) {
      logger.error('Search FAQs error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to search FAQs',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get support tickets
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getTickets(req, res) {
    try {
      const tickets = await SupportService.getTickets(req.user._id, req.userRole);
      
      res.status(200).json({
        success: true,
        tickets
      });
    } catch (error) {
      logger.error('Get tickets error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch support tickets',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get ticket details
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getTicketDetails(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
      }
      
      const result = await SupportService.getTicketDetails(id, req.user._id, req.userRole);
      
      res.status(200).json({
        success: true,
        ticket: result.ticket,
        replies: result.replies
      });
    } catch (error) {
      logger.error('Get ticket details error:', error);
      
      // Specific error handling
      if (error.message === 'Ticket not found') {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
      }
      
      if (error.message === 'Not authorized to access this ticket') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this ticket'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ticket details',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Create a support ticket
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async createTicket(req, res) {
    try {
      const ticket = await SupportService.createTicket(req.body, req.user._id, req.userRole);
      
      res.status(201).json({
        success: true,
        message: 'Support ticket created successfully',
        ticket
      });
    } catch (error) {
      logger.error('Create ticket error:', error);
      
      // Validation errors
      if (error.message === 'Subject and message are required') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to create support ticket',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Add reply to a ticket
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async replyToTicket(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
      }
      
      if (!message) {
        return res.status(400).json({
          success: false,
          error: 'Message is required'
        });
      }
      
      const reply = await SupportService.replyToTicket(id, message, req.user._id, req.userRole);
      
      res.status(200).json({
        success: true,
        message: 'Reply added successfully',
        reply
      });
    } catch (error) {
      logger.error('Reply to ticket error:', error);
      
      // Specific error handling
      if (error.message === 'Ticket not found') {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
      }
      
      if (error.message === 'Not authorized to reply to this ticket') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to reply to this ticket'
        });
      }
      
      if (error.message === 'Cannot reply to a closed ticket') {
        return res.status(400).json({
          success: false,
          error: 'Cannot reply to a closed ticket'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to add reply',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Close a support ticket
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async closeTicket(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
      }
      
      const ticket = await SupportService.closeTicket(id, req.user._id, req.userRole);
      
      res.status(200).json({
        success: true,
        message: 'Ticket closed successfully',
        ticket
      });
    } catch (error) {
      logger.error('Close ticket error:', error);
      
      // Specific error handling
      if (error.message === 'Ticket not found') {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
      }
      
      if (error.message === 'Not authorized to close this ticket') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to close this ticket'
        });
      }
      
      if (error.message === 'Ticket is already closed') {
        return res.status(400).json({
          success: false,
          error: 'Ticket is already closed'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to close ticket',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Reopen a support ticket
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async reopenTicket(req, res) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
      }
      
      const ticket = await SupportService.reopenTicket(id, req.user._id, req.userRole);
      
      res.status(200).json({
        success: true,
        message: 'Ticket reopened successfully',
        ticket
      });
    } catch (error) {
      logger.error('Reopen ticket error:', error);
      
      // Specific error handling
      if (error.message === 'Ticket not found') {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
      }
      
      if (error.message === 'Not authorized to reopen this ticket') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to reopen this ticket'
        });
      }
      
      if (error.message === 'Ticket is not closed') {
        return res.status(400).json({
          success: false,
          error: 'Ticket is not closed'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to reopen ticket',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Upload attachment to a ticket
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async uploadAttachment(req, res) {
    try {
      const { id } = req.params;
      const file = req.file;
      
      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
      }
      
      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'File is required'
        });
      }
      
      const attachment = await SupportService.uploadAttachment(id, file, req.user._id, req.userRole);
      
      res.status(200).json({
        success: true,
        message: 'Attachment uploaded successfully',
        attachment
      });
    } catch (error) {
      logger.error('Upload attachment error:', error);
      
      // Specific error handling
      if (error.message === 'Ticket not found') {
        return res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
      }
      
      if (error.message === 'Not authorized to upload attachment to this ticket') {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to upload attachment to this ticket'
        });
      }
      
      if (error.message === 'Cannot upload attachment to a closed ticket') {
        return res.status(400).json({
          success: false,
          error: 'Cannot upload attachment to a closed ticket'
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to upload attachment',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Get common issues and solutions
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getCommonIssues(req, res) {
    try {
      const commonIssues = await SupportService.getCommonIssues();
      
      res.status(200).json({
        success: true,
        commonIssues
      });
    } catch (error) {
      logger.error('Get common issues error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch common issues',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Send feedback about the app
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async sendFeedback(req, res) {
    try {
      const feedback = await SupportService.sendFeedback(req.body, req.user._id, req.userRole);
      
      res.status(201).json({
        success: true,
        message: 'Feedback submitted successfully',
        feedback
      });
    } catch (error) {
      logger.error('Send feedback error:', error);
      
      // Validation errors
      if (error.message === 'Type, message, and rating are required') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to submit feedback',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Check if support is available for live chat
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async checkLiveChatAvailability(req, res) {
    try {
      const availability = await SupportService.checkLiveChatAvailability();
      
      res.status(200).json({
        success: true,
        availability
      });
    } catch (error) {
      logger.error('Check live chat availability error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check live chat availability',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Initiate a live chat session
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async initiateLiveChat(req, res) {
    try {
      const chatSession = await SupportService.initiateLiveChat(req.body, req.user._id, req.userRole);
      
      res.status(201).json({
        success: true,
        message: 'Live chat session initiated successfully',
        chatSession
      });
    } catch (error) {
      logger.error('Initiate live chat error:', error);
      
      // Specific error handling
      if (error.message === 'Topic and message are required') {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: error.message
        });
      }
      
      if (error.message === 'Live chat support is not available at the moment') {
        return res.status(400).json({
          success: false,
          error: 'Live chat unavailable',
          details: error.message
        });
      }
      
      if (error.message === 'No support agents available at the moment') {
        return res.status(400).json({
          success: false,
          error: 'No support agents available',
          details: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to initiate live chat',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};
module.exports = new SupportController();
