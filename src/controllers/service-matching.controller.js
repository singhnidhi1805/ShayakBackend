// src/controllers/service-matching.controller.js
const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');
const Booking = require('../models/booking.model');
const NotificationService = require('../services/notification.service');
const logger = require('../config/logger');

class ServiceMatchingController {
  /**
   * Find professionals matching a service and location
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async findMatchingProfessionals(req, res) {
    try {
      const { serviceId, location } = req.body;
      
      if (!serviceId || !location || !location.coordinates) {
        return res.status(400).json({ 
          success: false,
          error: 'Missing required fields',
          details: 'Service ID and location coordinates are required'
        });
      }

      // Find the service
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ 
          success: false,
          error: 'Service not found'
        });
      }
      
      logger.info(`Finding professionals for service: ${service.category}, Location: ${JSON.stringify(location.coordinates)}`);
      
      // Find professionals that match service category and are within radius
      const matchingProfessionals = await Professional.find({
        status: 'verified',
        specializations: service.category,
        isAvailable: true,
        'currentLocation.coordinates': { $exists: true, $ne: [0, 0] },
        currentLocation: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: location.coordinates
            },
            $maxDistance: 10000 // 10 km radius
          }
        }
      })
      .select('name phone email userId currentLocation specializations')
      .limit(10);
      
      if (matchingProfessionals.length === 0) {
        logger.warn(`No matching professionals found for service ${serviceId} at location ${JSON.stringify(location.coordinates)}`);
        
        return res.status(200).json({
          success: true,
          message: 'No matching professionals found in your area',
          professionals: []
        });
      }
      
      // Format professionals data for the response
      const formattedProfessionals = matchingProfessionals.map(prof => {
        // Calculate rough distance
        const [profLng, profLat] = prof.currentLocation.coordinates;
        const [userLng, userLat] = location.coordinates;
        
        // Using the Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(profLat - userLat);
        const dLon = this.toRad(profLng - userLng);
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(this.toRad(userLat)) * Math.cos(this.toRad(profLat)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        return {
          id: prof._id,
          name: prof.name,
          userId: prof.userId,
          specializations: prof.specializations,
          distance: Math.round(distance * 10) / 10, // Round to 1 decimal place
        };
      });
      
      // Sort by distance
      formattedProfessionals.sort((a, b) => a.distance - b.distance);
      
      res.status(200).json({
        success: true,
        message: 'Matching professionals found',
        professionals: formattedProfessionals
      });
    } catch (error) {
      logger.error('Error in finding professionals:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to find matching professionals',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Book a service with a professional
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async bookService(req, res) {
    try {
      const { serviceId, professionalId, scheduledDate, location } = req.body;
      
      if (!serviceId || !professionalId || !scheduledDate || !location) {
        return res.status(400).json({ 
          success: false,
          error: 'Missing required fields',
          details: 'Service ID, professional ID, scheduled date, and location are required'
        });
      }
      
      // Validate service and professional
      const service = await Service.findById(serviceId);
      if (!service) {
        return res.status(404).json({ 
          success: false,
          error: 'Service not found'
        });
      }
      
      const professional = await Professional.findById(professionalId);
      if (!professional) {
        return res.status(404).json({ 
          success: false,
          error: 'Professional not found'
        });
      }
      
      // Check if professional specializes in the service category
      if (!professional.specializations.includes(service.category)) {
        return res.status(400).json({
          success: false,
          error: 'Professional specialization does not match service category',
          details: `Professional does not offer ${service.category} services`
        });
      }
      
      // Check professional availability
      if (!professional.isAvailable) {
        return res.status(400).json({
          success: false,
          error: 'Professional is not available',
          details: 'Please select another professional'
        });
      }
      
      // Calculate price
      let totalAmount = 0;
      if (service.pricing.type === 'fixed') {
        totalAmount = service.pricing.amount;
      } else if (service.pricing.type === 'range') {
        totalAmount = service.pricing.minAmount;
      }
      
      // Generate verification code
      const verificationCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Create booking
      const booking = new Booking({
        user: req.user._id,
        professional: professionalId,
        service: serviceId,
        scheduledDate: new Date(scheduledDate),
        location: {
          type: 'Point',
          coordinates: location.coordinates
        },
        status: 'pending',
        totalAmount,
        verificationCode
      });
      
      const savedBooking = await booking.save();
      
      // Update professional's availability
      await Professional.findByIdAndUpdate(professionalId, {
        isAvailable: false
      });
      
      // Send notification to professional
      await NotificationService.createNotification({
        recipient: professionalId,
        type: 'booking_request',
        title: 'New Booking Request',
        message: `You have a new booking request for ${service.name}`,
        data: { bookingId: savedBooking._id }
      });
      
      res.status(201).json({
        success: true,
        message: 'Service booked successfully',
        booking: {
          id: savedBooking._id,
          service: {
            id: service._id,
            name: service.name,
            category: service.category
          },
          professional: {
            id: professional._id,
            name: professional.name
          },
          scheduledDate: savedBooking.scheduledDate,
          status: savedBooking.status,
          totalAmount: savedBooking.totalAmount
        }
      });
    } catch (error) {
      logger.error('Error in booking service:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to book service',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Helper method to convert degrees to radians
   * @param {number} value - Value in degrees
   * @returns {number} Value in radians
   */
  toRad(value) {
    return value * Math.PI / 180;
  }
}

module.exports = new ServiceMatchingController();