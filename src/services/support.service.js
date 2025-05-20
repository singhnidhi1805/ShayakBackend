// src/services/supportService.js
import api from './api';

class SupportService {
  /**
   * Get FAQ categories
   * @returns {Promise} Response with FAQ categories
   */
  async getFAQCategories() {
    try {
      const response = await api.get('/professional/support/faq-categories');
      return response.data;
    } catch (error) {
      console.error('Error fetching FAQ categories:', error);
      throw error;
    }
  }

  /**
   * Get FAQs by category
   * @param {string} categoryId - Category ID
   * @returns {Promise} Response with FAQs
   */
  async getFAQs(categoryId) {
    try {
      const response = await api.get(`/professional/support/faqs?categoryId=${categoryId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching FAQs:', error);
      throw error;
    }
  }

  /**
   * Search FAQs
   * @param {string} query - Search query
   * @returns {Promise} Response with search results
   */
  async searchFAQs(query) {
    try {
      const response = await api.get(`/professional/support/faqs/search?query=${query}`);
      return response.data;
    } catch (error) {
      console.error('Error searching FAQs:', error);
      throw error;
    }
  }

  /**
   * Get support tickets
   * @returns {Promise} Response with support tickets
   */
  async getTickets() {
    try {
      const response = await api.get('/professional/support/tickets');
      return response.data;
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      throw error;
    }
  }

  /**
   * Get ticket details
   * @param {string} ticketId - Ticket ID
   * @returns {Promise} Response with ticket details
   */
  async getTicketDetails(ticketId) {
    try {
      const response = await api.get(`/professional/support/tickets/${ticketId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      throw error;
    }
  }

  /**
   * Create a support ticket
   * @param {Object} ticketData - Ticket data
   * @returns {Promise} Response with created ticket
   */
  async createTicket(ticketData) {
    try {
      const response = await api.post('/professional/support/tickets', ticketData);
      return response.data;
    } catch (error) {
      console.error('Error creating support ticket:', error);
      throw error;
    }
  }

  /**
   * Add reply to a ticket
   * @param {string} ticketId - Ticket ID
   * @param {string} message - Reply message
   * @returns {Promise} Response with status
   */
  async replyToTicket(ticketId, message) {
    try {
      const response = await api.post(`/professional/support/tickets/${ticketId}/replies`, { message });
      return response.data;
    } catch (error) {
      console.error('Error replying to ticket:', error);
      throw error;
    }
  }

  /**
   * Close a support ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise} Response with status
   */
  async closeTicket(ticketId) {
    try {
      const response = await api.put(`/professional/support/tickets/${ticketId}/close`);
      return response.data;
    } catch (error) {
      console.error('Error closing ticket:', error);
      throw error;
    }
  }

  /**
   * Reopen a support ticket
   * @param {string} ticketId - Ticket ID
   * @returns {Promise} Response with status
   */
  async reopenTicket(ticketId) {
    try {
      const response = await api.put(`/professional/support/tickets/${ticketId}/reopen`);
      return response.data;
    } catch (error) {
      console.error('Error reopening ticket:', error);
      throw error;
    }
  }

  /**
   * Upload attachment to a ticket
   * @param {string} ticketId - Ticket ID
   * @param {Object} file - File object
   * @returns {Promise} Response with uploaded attachment
   */
  async uploadAttachment(ticketId, file) {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await api.post(`/professional/support/tickets/${ticketId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  }

  /**
   * Get common issues and solutions
   * @returns {Promise} Response with common issues and solutions
   */
  async getCommonIssues() {
    try {
      const response = await api.get('/professional/support/common-issues');
      return response.data;
    } catch (error) {
      console.error('Error fetching common issues:', error);
      throw error;
    }
  }

  /**
   * Send feedback about the app
   * @param {Object} feedbackData - Feedback data
   * @returns {Promise} Response with status
   */
  async sendFeedback(feedbackData) {
    try {
      const response = await api.post('/professional/support/feedback', feedbackData);
      return response.data;
    } catch (error) {
      console.error('Error sending feedback:', error);
      throw error;
    }
  }

  /**
   * Check if support is available for live chat
   * @returns {Promise} Response with availability status
   */
  async checkLiveChatAvailability() {
    try {
      const response = await api.get('/professional/support/live-chat/availability');
      return response.data;
    } catch (error) {
      console.error('Error checking live chat availability:', error);
      throw error;
    }
  }

  /**
   * Initiate a live chat session
   * @param {Object} chatData - Chat initialization data
   * @returns {Promise} Response with chat session data
   */
  async initiateLiveChat(chatData) {
    try {
      const response = await api.post('/professional/support/live-chat/initiate', chatData);
      return response.data;
    } catch (error) {
      console.error('Error initiating live chat:', error);
      throw error;
    }
  }
}

export default new SupportService();
