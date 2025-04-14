// src/controllers/booking.controller.js
const mongoose = require('mongoose');
const Booking = require('../models/booking.model');
const Service = require('../models/service.model');
const Professional = require('../models/professional.model');
const BookingService = require('../services/BookingService');
const NotificationService = require('../services/notification.service');
const GeospatialService = require('../services/geospatial.service');
const logger = require('../config/logger');

class BookingController {
  /**
   * Create a new booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async createBooking(req, res) {
    try {
      logger.info('Creating booking with data:', req.body);
      const { serviceId, location, scheduledDate } = req.body;

      // Basic validation
      if (!serviceId || !location?.coordinates || !scheduledDate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields'
        });
      }

      // Get service
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({
          success: false,
          message: 'Service not found'
        });
      }

      // Create booking through service
      const booking = await BookingService.createBooking(req.body, req.user._id);

      // Send response
      res.status(201).json({
        success: true,
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            scheduledDate: booking.scheduledDate,
            totalAmount: booking.totalAmount,
            service: {
              _id: service._id,
              name: service.name,
              category: service.category
            }
          }
        }
      });
    } catch (error) {
      logger.error('Booking creation error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create booking',
        error: error.message
      });
    }
  }

  /**
   * Professional accepts booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async acceptBooking(req, res) {
    try {
      const { bookingId } = req.params;
      
      if (!bookingId) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID is required'
        });
      }

      const booking = await BookingService.acceptBooking(bookingId, req.user._id);

      res.json({
        success: true,
        data: {
          booking: {
            _id: booking._id,
            status: booking.status,
            scheduledDate: booking.scheduledDate
          }
        }
      });
    } catch (error) {
      logger.error('Accept booking error:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message || 'Failed to accept booking'
      });
    }
  }

  /**
   * Get active booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getActiveBooking(req, res) {
    try {
      // Determine query based on user role
      let query = {};
      
      if (req.userRole === 'user') {
        query = {
          user: req.user._id,
          status: { $in: ['pending', 'accepted', 'in_progress'] }
        };
      } else if (req.userRole === 'professional') {
        query = {
          professional: req.user._id,
          status: { $in: ['accepted', 'in_progress'] }
        };
      }

      const booking = await Booking.findOne(query)
        .populate('service', 'name category pricing')
        .populate('professional', 'name phone')
        .populate('user', 'name phone')
        .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'No active booking found'
        });
      }

      // Format response based on user role
      let response = {
        _id: booking._id,
        service: booking.service,
        scheduledDate: booking.scheduledDate,
        status: booking.status,
        totalAmount: booking.totalAmount,
        location: booking.location,
        tracking: booking.tracking
      };

      if (req.userRole === 'user') {
        response.professional = booking.professional ? {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone
        } : null;
      } else if (req.userRole === 'professional') {
        response.user = {
          _id: booking.user._id,
          name: booking.user.name,
          phone: booking.user.phone
        };
        // Only share verification code with professional once service is in progress
        if (booking.status === 'in_progress') {
          response.verificationCode = booking.verificationCode;
        }
      }

      res.json({
        success: true,
        data: { booking: response }
      });
    } catch (error) {
      logger.error('Get active booking error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active booking',
        error: error.message
      });
    }
  }

  /**
   * Get booking history
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getBookingHistory(req, res) {
    try {
      const { page = 1, limit = 10, status } = req.query;
      
      // Build query based on user role
      let query = {};
      
      if (req.userRole === 'user') {
        query.user = req.user._id;
      } else if (req.userRole === 'professional') {
        query.professional = req.user._id;
      }

      // Add status filter if provided
      if (status && ['pending', 'accepted', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        query.status = status;
      }

      // Count total documents for pagination
      const total = await Booking.countDocuments(query);

      // Get bookings with pagination
      const bookings = await Booking.find(query)
        .populate('service', 'name category pricing')
        .populate('professional', 'name phone')
        .populate('user', 'name phone')
        .sort({ createdAt: -1 })
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));

      // Format bookings data
      const formattedBookings = bookings.map(booking => {
        const formattedBooking = {
          _id: booking._id,
          service: booking.service,
          scheduledDate: booking.scheduledDate,
          status: booking.status,
          totalAmount: booking.totalAmount,
          createdAt: booking.createdAt,
          completedAt: booking.completedAt,
          cancelledAt: booking.cancelledAt,
          rating: booking.rating
        };

        if (req.userRole === 'user') {
          formattedBooking.professional = booking.professional ? {
            _id: booking.professional._id,
            name: booking.professional.name,
            phone: booking.professional.phone
          } : null;
        } else if (req.userRole === 'professional') {
          formattedBooking.user = {
            _id: booking.user._id,
            name: booking.user.name,
            phone: booking.user.phone
          };
        }

        return formattedBooking;
      });

      return res.json({
        success: true,
        bookings: formattedBookings,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Get booking history failed:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to get booking history' 
      });
    }
  }

  /**
   * Get tracking info for a booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getTrackingInfo(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await Booking.findById(bookingId)
        .populate('professional', 'name phone currentLocation');

      if (!booking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }

      // Check authorization
      if (req.userRole === 'user' && booking.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          error: 'Not authorized to access this booking' 
        });
      } else if (req.userRole === 'professional' && booking.professional && 
                booking.professional._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          error: 'Not authorized to access this booking' 
        });
      }

      // Calculate ETA if professional is assigned
      let eta = null;
      if (booking.professional?.currentLocation) {
        if (booking.tracking && booking.tracking.eta) {
          eta = booking.tracking.eta;
        } else {
          eta = GeospatialService.estimateETA(
            booking.professional.currentLocation.coordinates,
            booking.location.coordinates
          );
        }
      }

      res.json({
        success: true,
        tracking: {
          status: booking.status,
          professionalLocation: booking.professional?.currentLocation,
          destination: booking.location,
          eta,
          startedAt: booking.tracking?.startedAt,
          arrivedAt: booking.tracking?.arrivedAt
        }
      });
    } catch (error) {
      logger.error('Get tracking info failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get tracking info' 
      });
    }
  }

  /**
   * Complete a booking with verification code
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async completeBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { verificationCode } = req.body;

      if (!verificationCode) {
        return res.status(400).json({ 
          success: false, 
          error: 'Verification code is required' 
        });
      }

      const booking = await BookingService.completeService(bookingId, req.user._id, verificationCode);

      res.json({
        success: true,
        message: 'Booking completed successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          completedAt: booking.completedAt
        }
      });
    } catch (error) {
      logger.error('Complete booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        error: error.message || 'Failed to complete booking' 
      });
    }
  }

  /**
   * Cancel a booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async cancelBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { reason } = req.body;

      const booking = await BookingService.cancelBooking(bookingId, req.user._id, req.userRole, reason);

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          cancelledAt: booking.cancelledAt
        }
      });
    } catch (error) {
      logger.error('Cancel booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        error: error.message || 'Failed to cancel booking' 
      });
    }
  }

  /**
   * Reschedule a booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async rescheduleBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { scheduledDate, reason } = req.body;

      if (!scheduledDate) {
        return res.status(400).json({ 
          success: false, 
          error: 'New scheduled date is required' 
        });
      }

      const booking = await BookingService.rescheduleBooking(bookingId, req.user._id, scheduledDate, reason);

      res.json({
        success: true,
        message: 'Booking rescheduled successfully',
        booking: {
          _id: booking._id,
          scheduledDate: booking.scheduledDate,
          reschedulingHistory: booking.reschedulingHistory
        }
      });
    } catch (error) {
      logger.error('Reschedule booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        error: error.message || 'Failed to reschedule booking' 
      });
    }
  }

  /**
   * Update ETA for a booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateETA(req, res) {
    try {
      const { bookingId } = req.params;
      const { etaMinutes, coordinates } = req.body;

      if (!etaMinutes) {
        return res.status(400).json({ 
          success: false, 
          error: 'ETA in minutes is required' 
        });
      }

      const booking = await BookingService.updateETA(bookingId, req.user._id, etaMinutes, coordinates);

      res.json({
        success: true,
        message: 'ETA updated successfully',
        booking: {
          _id: booking._id,
          tracking: booking.tracking
        }
      });
    } catch (error) {
      logger.error('Update ETA failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        error: error.message || 'Failed to update ETA' 
      });
    }
  }

  /**
   * Get booking details
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getBookingDetails(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await Booking.findById(bookingId)
        .populate('service', 'name category pricing description')
        .populate('professional', 'name phone email')
        .populate('user', 'name phone email')
        .populate('cancelledBy', 'name');

      if (!booking) {
        return res.status(404).json({ 
          success: false, 
          error: 'Booking not found' 
        });
      }

      // Check authorization
      if (req.userRole === 'user' && booking.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          error: 'Not authorized to access this booking' 
        });
      } else if (req.userRole === 'professional' && booking.professional && 
                booking.professional._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ 
          success: false, 
          error: 'Not authorized to access this booking' 
        });
      }

      // Format response
      const response = {
        _id: booking._id,
        service: booking.service,
        scheduledDate: booking.scheduledDate,
        status: booking.status,
        totalAmount: booking.totalAmount,
        location: booking.location,
        createdAt: booking.createdAt,
        completedAt: booking.completedAt,
        cancelledAt: booking.cancelledAt,
        tracking: booking.tracking,
        rating: booking.rating,
        reschedulingHistory: booking.reschedulingHistory,
        paymentStatus: booking.paymentStatus
      };

      // Add role-specific data
      if (req.userRole === 'user') {
        response.professional = booking.professional ? {
          _id: booking.professional._id,
          name: booking.professional.name,
          phone: booking.professional.phone
        } : null;
      } else if (req.userRole === 'professional') {
        response.user = {
          _id: booking.user._id,
          name: booking.user.name,
          phone: booking.user.phone
        };

        // Only share verification code with professional once service is in progress
        if (booking.status === 'in_progress') {
          response.verificationCode = booking.verificationCode;
        }
      }

      // Add cancellation info if applicable
      if (booking.status === 'cancelled' && booking.cancelledBy) {
        response.cancellationInfo = {
          cancelledAt: booking.cancelledAt,
          cancelledBy: {
            _id: booking.cancelledBy._id,
            name: booking.cancelledBy.name
          },
          reason: booking.cancellationReason
        };
      }

      res.json({
        success: true,
        booking: response
      });
    } catch (error) {
      logger.error('Get booking details failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to get booking details' 
      });
    }
  }

  /**
   * Rate a booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async rateBooking(req, res) {
    try {
      const { bookingId } = req.params;
      const { rating, review } = req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ 
          success: false, 
          error: 'Rating must be between 1 and 5' 
        });
      }

      const booking = await BookingService.rateBooking(bookingId, req.user._id, rating, review);

      res.json({
        success: true,
        message: 'Booking rated successfully',
        rating: booking.rating
      });
    } catch (error) {
      logger.error('Rate booking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        error: error.message || 'Failed to rate booking' 
      });
    }
  }

  /**
   * Start a service
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async startService(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await BookingService.startService(bookingId, req.user._id);

      res.json({
        success: true,
        message: 'Service started successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          tracking: booking.tracking
        }
      });
    } catch (error) {
      logger.error('Start service failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        error: error.message || 'Failed to start service' 
      });
    }
  }

  /**
   * Mark professional as arrived
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async professionalArrived(req, res) {
    try {
      const { bookingId } = req.params;

      const booking = await BookingService.professionalArrived(bookingId, req.user._id);

      res.json({
        success: true,
        message: 'Arrival marked successfully',
        booking: {
          _id: booking._id,
          tracking: booking.tracking
        }
      });
    } catch (error) {
      logger.error('Professional arrived marking failed:', error);
      res.status(error.message.includes('not found') ? 404 : 400).json({ 
        success: false, 
        error: error.message || 'Failed to mark arrival' 
      });
    }
  }

  /**
   * Create emergency booking
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async createEmergencyBooking(req, res) {
    try {
      const { serviceId, location } = req.body;

      if (!serviceId || !location?.coordinates) {
        return res.status(400).json({ 
          success: false, 
          error: 'Service ID and location are required' 
        });
      }

      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ 
          success: false, 
          error: 'Service not found' 
        });
      }

      // Create emergency booking
      const booking = await BookingService.createEmergencyBooking(req.body, req.user._id);

      res.status(201).json({
        success: true,
        message: 'Emergency booking created successfully',
        booking: {
          _id: booking._id,
          status: booking.status,
          isEmergency: booking.isEmergency,
          service: {
            _id: service._id,
            name: service.name,
            category: service.category
          }
        }
      });
    } catch (error) {
      logger.error('Emergency booking creation failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to create emergency booking' 
      });
    }
  }
}

module.exports = new BookingController();