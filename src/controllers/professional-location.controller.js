// src/controllers/professional-location.controller.js
const Professional = require('../models/professional.model');
const GeospatialService = require('../services/geospatial.service');
const SocketService = require('../services/socket.service');
const logger = require('../config/logger');

class ProfessionalLocationController {
  /**
   * Update professional's location
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateLocation(req, res) {
    try {
      const { latitude, longitude, accuracy, heading, speed, isAvailable } = req.body;
      
      // Validate required fields
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing coordinates',
          details: 'Latitude and longitude are required'
        });
      }
      
      // Validate coordinate ranges
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates',
          details: 'Latitude must be between -90 and 90, longitude between -180 and 180'
        });
      }
      
      // Find professional by userId
      const professional = await Professional.findOne({ userId: req.user.userId });
      
      if (!professional) {
        return res.status(404).json({
          success: false,
          error: 'Professional not found',
          details: 'Could not find professional profile for this user'
        });
      }
      
      // Update professional location
      professional.currentLocation = {
        type: 'Point',
        coordinates: [longitude, latitude]
      };
      
      // Update additional location data if provided
      if (accuracy) professional.currentLocation.accuracy = accuracy;
      if (heading) professional.currentLocation.heading = heading;
      if (speed) professional.currentLocation.speed = speed;
      
      // Update timestamp
      professional.currentLocation.timestamp = new Date();
      
      // Update availability if provided
      if (isAvailable !== undefined) {
        professional.isAvailable = isAvailable;
      }
      
      await professional.save();
      
      // Update active bookings if professional is on a job
      if (professional.currentBooking && professional.currentBooking.bookingId) {
        // Calculate ETA
        const booking = await Booking.findById(professional.currentBooking.bookingId);
        
        if (booking && booking.status === 'in_progress') {
          const eta = GeospatialService.estimateETA(
            [longitude, latitude],
            booking.location.coordinates
          );
          
          // Update booking tracking info
          booking.tracking.lastLocation = {
            type: 'Point',
            coordinates: [longitude, latitude],
            timestamp: new Date()
          };
          booking.tracking.eta = eta;
          await booking.save();
          
          // Send real-time update to user
          SocketService.sendBookingUpdate(booking._id, {
            tracking: booking.tracking
          });
        }
      }
      
      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        data: {
          currentLocation: {
            location: professional.currentLocation,
            accuracy: professional.currentLocation.accuracy,
            heading: professional.currentLocation.heading,
            speed: professional.currentLocation.speed
          },
          isAvailable: professional.isAvailable,
          lastLocationUpdate: professional.currentLocation.timestamp
        }
      });
    } catch (error) {
      logger.error('Update location error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update location',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get nearby professionals based on location
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getNearbyProfessionals(req, res) {
    try {
      const { latitude, longitude, radius = 10, specializations } = req.query;
      
      // Validate required fields
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing coordinates',
          details: 'Latitude and longitude are required'
        });
      }
      
      // Parse specializations if provided
      let specializationsArray = [];
      if (specializations) {
        specializationsArray = specializations.split(',');
      }
      
      // Find nearby professionals
      const professionals = await GeospatialService.findNearbyProfessionals(
        [parseFloat(longitude), parseFloat(latitude)],
        parseFloat(radius),
        specializationsArray
      );
      
      // Format response
      const response = professionals.map(prof => ({
        id: prof.id,
        name: prof.name,
        specializations: prof.specializations,
        distance: prof.distance, // in km
        distanceText: `${prof.distance} km`,
        estimatedArrival: this.getEstimatedArrivalText(prof.distance)
      }));
      
      res.status(200).json({
        success: true,
        message: 'Nearby professionals retrieved successfully',
        data: {
          professionals: response,
          count: response.length,
          searchRadius: parseFloat(radius)
        }
      });
    } catch (error) {
      logger.error('Get nearby professionals error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch nearby professionals',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Calculate estimated arrival time text based on distance
   * @param {number} distanceKm - Distance in kilometers
   * @returns {string} Estimated arrival time text
   */
  getEstimatedArrivalText(distanceKm) {
    // Assume average speed of 30 km/h in urban areas
    const timeInMinutes = Math.round((distanceKm / 30) * 60);
    
    if (timeInMinutes < 1) {
      return 'Less than a minute';
    } else if (timeInMinutes < 60) {
      return `About ${timeInMinutes} minutes`;
    } else {
      const hours = Math.floor(timeInMinutes / 60);
      const minutes = timeInMinutes % 60;
      
      if (minutes === 0) {
        return `About ${hours} hour${hours > 1 ? 's' : ''}`;
      } else {
        return `About ${hours} hour${hours > 1 ? 's' : ''} and ${minutes} minute${minutes > 1 ? 's' : ''}`;
      }
    }
  }
  
  /**
   * Get service areas with available professionals
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getServiceAreas(req, res) {
    try {
      // Get service areas with professional counts by specialization
      // This is an aggregate that can be useful for the front-end to show
      // availability heat map or service area coverage
      
      const { specialization } = req.query;
      
      // Base aggregation pipeline
      const pipeline = [
        {
          $match: {
            status: 'verified',
            isAvailable: true,
            'currentLocation.coordinates.0': { $ne: 0 },
            'currentLocation.coordinates.1': { $ne: 0 }
          }
        },
        {
          $project: {
            coordinates: '$currentLocation.coordinates',
            specializations: 1
          }
        }
      ];
      
      // Add specialization filter if provided
      if (specialization) {
        pipeline[0].$match.specializations = specialization;
      }
      
      // Group by geographic grid (approx 1km²)
      pipeline.push(
        {
          $group: {
            _id: {
              // Round coordinates to create grid cells (0.01 is roughly 1km)
              lng: { $round: [{ $arrayElemAt: ['$coordinates', 0] }, 2] },
              lat: { $round: [{ $arrayElemAt: ['$coordinates', 1] }, 2] }
            },
            count: { $sum: 1 },
            professionals: { $push: '$_id' }
          }
        },
        {
          $project: {
            _id: 0,
            coordinates: [ '$_id.lng', '$_id.lat' ],
            count: 1,
            professionals: { $slice: ['$professionals', 10] } // Limit to 10 professionals per area
          }
        }
      );
      
      const serviceAreas = await Professional.aggregate(pipeline);
      
      res.status(200).json({
        success: true,
        data: {
          serviceAreas,
          total: serviceAreas.length
        }
      });
    } catch (error) {
      logger.error('Get service areas error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get service areas',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new ProfessionalLocationController();