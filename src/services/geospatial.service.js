// src/services/geospatial.service.js
const axios = require('axios');
const Professional = require('../models/professional.model');
const logger = require('../config/logger');

class GeospatialService {
  constructor() {
    this.geocodeApiKey = process.env.GOOGLE_MAPS_API_KEY;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @param {number} lat1 - Latitude of first point
   * @param {number} lon1 - Longitude of first point
   * @param {number} lat2 - Latitude of second point
   * @param {number} lon2 - Longitude of second point
   * @returns {number} Distance in kilometers
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
       Math.sin(dLat/2) * Math.sin(dLat/2) +
       Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
       Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Convert degrees to radians
   * @param {number} value - Value in degrees
   * @returns {number} Value in radians
   */
  toRad(value) {
    return value * Math.PI / 180;
  }

  /**
   * Geocode an address to coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<Object>} Geocoded location data
   */
  async geocodeAddress(address) {
    try {
      if (!this.geocodeApiKey) {
        throw new Error('Google Maps API key is not configured');
      }
      
      logger.info(`Geocoding address: ${address}`);
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            address: address,
            key: this.geocodeApiKey
          }
        }
      );

      if (response.data.status !== 'OK') {
        throw new Error(`Geocoding API returned status: ${response.data.status}`);
      }

      if (response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          coordinates: [
            result.geometry.location.lng,
            result.geometry.location.lat
          ],
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          addressComponents: result.address_components
        };
      }
      throw new Error('No results found');
    } catch (error) {
      logger.error(`Geocoding failed: ${error.message}`);
      throw new Error(`Geocoding failed: ${error.message}`);
    }
  }

  /**
   * Find professionals within radius of a location
   * @param {Array} coordinates - [longitude, latitude] coordinates
   * @param {number} radius - Radius in kilometers (note: controller sends in km now)
   * @param {Array} specializations - Array of specialization categories
   * @returns {Promise<Array>} Matching professionals
   */
  async findNearbyProfessionals(coordinates, radius = 10, specializations = []) {
    try {
      logger.info(`Finding professionals near [${coordinates}] within ${radius}km`);
      logger.info(`Specializations filter: ${specializations}`);
      
      // Build the base query
      const query = {
        // Allow both verified and under_review professionals (you can adjust this)
        status: { $in: ['verified', 'under_review'] },
        isAvailable: true,
        // Ensure coordinates exist and are not [0, 0]
        'currentLocation.coordinates': { 
          $exists: true, 
          $ne: [0, 0],
          $ne: null
        }
      };
      
      // Add specializations filter if provided
      if (specializations && specializations.length > 0) {
        // Clean up specializations (remove empty strings, trim whitespace)
        const cleanSpecializations = specializations
          .filter(spec => spec && spec.trim())
          .map(spec => spec.trim().toLowerCase());
        
        if (cleanSpecializations.length > 0) {
          query.specializations = { $in: cleanSpecializations };
        }
      }
      
      logger.info(`Query: ${JSON.stringify(query)}`);
      
      // Use aggregation for better performance and distance calculation
      const professionals = await Professional.aggregate([
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: coordinates
            },
            distanceField: 'calculatedDistance',
            maxDistance: radius * 1000, // Convert km to meters
            spherical: true,
            query: query
          }
        },
        {
          $project: {
            name: 1,
            phone: 1,
            email: 1,
            userId: 1,
            specializations: 1,
            currentLocation: 1,
            status: 1,
            isAvailable: 1,
            calculatedDistance: 1,
            distanceInKm: { $divide: ['$calculatedDistance', 1000] }
          }
        },
        {
          $sort: { calculatedDistance: 1 }
        },
        {
          $limit: 20
        }
      ]);
      
      logger.info(`Found ${professionals.length} professionals`);
      
      // Format the response
      return professionals.map(professional => ({
        id: professional._id,
        userId: professional.userId,
        name: professional.name,
        phone: professional.phone,
        email: professional.email,
        specializations: professional.specializations,
        status: professional.status,
        isAvailable: professional.isAvailable,
        location: professional.currentLocation,
        distance: Math.round(professional.distanceInKm * 10) / 10, // Round to 1 decimal place
        distanceInMeters: Math.round(professional.calculatedDistance)
      }));
      
    } catch (error) {
      logger.error(`Error finding nearby professionals: ${error.message}`);
      logger.error(`Stack trace: ${error.stack}`);
      throw new Error(`Failed to find nearby professionals: ${error.message}`);
    }
  }

  /**
   * Find professionals within multiple service areas
   * @param {Array} areas - Array of service areas with coordinates and radius
   * @param {Array} specializations - Array of specialization categories
   * @returns {Promise<Array>} Matching professionals
   */
  async findProfessionalsInAreas(areas, specializations = []) {
    try {
      if (!areas || !areas.length || !areas[0].coordinates) {
        throw new Error('Invalid service areas provided');
      }
      
      const baseQuery = {
        status: { $in: ['verified', 'under_review'] },
        isAvailable: true,
        'currentLocation.coordinates': { 
          $exists: true, 
          $ne: [0, 0],
          $ne: null
        }
      };
      
      if (specializations.length > 0) {
        baseQuery.specializations = { $in: specializations };
      }
      
      const professionals = await Professional.aggregate([
        {
          $match: baseQuery
        },
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: areas[0].coordinates // Primary search area
            },
            distanceField: 'distance',
            maxDistance: areas[0].radius * 1000, // Convert km to meters
            spherical: true
          }
        },
        {
          $addFields: {
            matchedAreas: {
              $size: {
                $filter: {
                  input: areas,
                  as: 'area',
                  cond: {
                    $lte: [
                      '$distance',
                      { $multiply: ['$$area.radius', 1000] }
                    ]
                  }
                }
              }
            }
          }
        },
        {
          $match: {
            matchedAreas: { $gt: 0 }
          }
        },
        {
          $sort: {
            matchedAreas: -1,
            distance: 1
          }
        },
        {
          $project: {
            _id: 1,
            name: 1,
            email: 1,
            phone: 1,
            userId: 1,
            specializations: 1,
            distance: 1,
            matchedAreas: 1
          }
        }
      ]);
      
      logger.info(`Found ${professionals.length} professionals in service areas`);
      return professionals;
    } catch (error) {
      logger.error(`Error finding professionals in areas: ${error.message}`);
      throw new Error(`Failed to find professionals in areas: ${error.message}`);
    }
  }
  
  /**
   * Estimate ETA based on distance
   * @param {Array} startCoords - [longitude, latitude] of start location
   * @param {Array} endCoords - [longitude, latitude] of end location
   * @param {number} averageSpeed - Average speed in km/h
   * @returns {number} ETA in minutes
   */
  estimateETA(startCoords, endCoords, averageSpeed = 30) {
    try {
      const distance = this.calculateDistance(
        startCoords[1], startCoords[0],
        endCoords[1], endCoords[0]
      );
      
      // Calculate time in minutes based on distance and average speed
      return Math.round((distance / averageSpeed) * 60);
    } catch (error) {
      logger.error(`Error estimating ETA: ${error.message}`);
      return null;
    }
  }
}

module.exports = new GeospatialService();