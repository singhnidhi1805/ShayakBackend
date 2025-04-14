// src/controllers/location.controller.js
const User = require('../models/user.model');
const GeospatialService = require('../services/geospatial.service');
const logger = require('../config/logger');

/**
 * Controller for managing user addresses and locations
 */
class LocationController {
  /**
   * Add a new address to the user's profile
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async addAddress(req, res) {
    try {
      const { houseNo, street, landmark, city, state, zipCode, isDefault, addressType } = req.body;
      
      // Basic validation
      if (!houseNo || !street || !city || !state || !zipCode) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: 'House number, street, city, state, and zip code are required'
        });
      }
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Check address limit (max 5 addresses)
      if (user.addresses && user.addresses.length >= 5) {
        return res.status(400).json({
          success: false,
          error: 'Address limit reached',
          details: 'You can only save up to 5 addresses'
        });
      }
      
      // Create address object
      const newAddress = {
        houseNo,
        street,
        landmark: landmark || '',
        city,
        state,
        zipCode,
        isDefault: isDefault || false,
        addressType: addressType || 'home',
        coordinates: null
      };
      
      // Try to geocode the address
      try {
        const fullAddress = `${houseNo} ${street}, ${city}, ${state} ${zipCode}`;
        const geocoded = await GeospatialService.geocodeAddress(fullAddress);
        
        if (geocoded && geocoded.coordinates) {
          newAddress.coordinates = geocoded.coordinates;
          newAddress.formattedAddress = geocoded.formattedAddress;
        }
      } catch (geocodeError) {
        logger.warn(`Geocoding failed for address: ${geocodeError.message}`);
        // Continue even if geocoding fails
      }
      
      // Initialize addresses array if it doesn't exist
      if (!user.addresses) {
        user.addresses = [];
      }
      
      // If this is the first address or isDefault is true, set as default
      if (user.addresses.length === 0 || newAddress.isDefault) {
        // Set all existing addresses to non-default
        if (user.addresses.length > 0) {
          user.addresses.forEach(addr => {
            addr.isDefault = false;
          });
        }
        newAddress.isDefault = true;
      }
      
      // Add new address
      user.addresses.push(newAddress);
      await user.save();
      
      res.status(200).json({
        success: true,
        message: 'Address added successfully',
        addresses: user.addresses
      });
    } catch (error) {
      logger.error('Add address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add address',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Update an existing address
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateAddress(req, res) {
    try {
      const { addressId } = req.params;
      const { houseNo, street, landmark, city, state, zipCode, isDefault, addressType } = req.body;
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user || !user.addresses) {
        return res.status(404).json({
          success: false,
          error: 'User or addresses not found'
        });
      }
      
      // Find address index
      const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
      
      if (addressIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Address not found'
        });
      }
      
      // Update address fields
      if (houseNo) user.addresses[addressIndex].houseNo = houseNo;
      if (street) user.addresses[addressIndex].street = street;
      user.addresses[addressIndex].landmark = landmark || '';
      if (city) user.addresses[addressIndex].city = city;
      if (state) user.addresses[addressIndex].state = state;
      if (zipCode) user.addresses[addressIndex].zipCode = zipCode;
      if (addressType) user.addresses[addressIndex].addressType = addressType;
      
      // Update coordinates if address changed
      if (houseNo || street || city || state || zipCode) {
        try {
          const fullAddress = `${user.addresses[addressIndex].houseNo} ${user.addresses[addressIndex].street}, ${user.addresses[addressIndex].city}, ${user.addresses[addressIndex].state} ${user.addresses[addressIndex].zipCode}`;
          const geocoded = await GeospatialService.geocodeAddress(fullAddress);
          
          if (geocoded && geocoded.coordinates) {
            user.addresses[addressIndex].coordinates = geocoded.coordinates;
            user.addresses[addressIndex].formattedAddress = geocoded.formattedAddress;
          }
        } catch (geocodeError) {
          logger.warn(`Geocoding failed for address update: ${geocodeError.message}`);
          // Continue even if geocoding fails
        }
      }
      
      // Handle default address setting
      if (isDefault) {
        // Set all other addresses to non-default
        user.addresses.forEach((addr, index) => {
          user.addresses[index].isDefault = (index === addressIndex);
        });
      }
      
      await user.save();
      
      res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        addresses: user.addresses
      });
    } catch (error) {
      logger.error('Update address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update address',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Delete an address
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async deleteAddress(req, res) {
    try {
      const { addressId } = req.params;
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user || !user.addresses) {
        return res.status(404).json({
          success: false,
          error: 'User or addresses not found'
        });
      }
      
      // Find address index
      const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
      
      if (addressIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Address not found'
        });
      }
      
      // Check if this is the default address
      const isDefault = user.addresses[addressIndex].isDefault;
      
      // Remove address
      user.addresses.splice(addressIndex, 1);
      
      // If the deleted address was default and other addresses exist, set a new default
      let newDefaultAddressId = null;
      if (isDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
        newDefaultAddressId = user.addresses[0]._id;
      }
      
      await user.save();
      
      res.status(200).json({
        success: true,
        message: 'Address deleted successfully',
        addresses: user.addresses,
        newDefaultAddressId
      });
    } catch (error) {
      logger.error('Delete address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete address',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Update user's current location
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async updateCurrentLocation(req, res) {
    try {
      const { latitude, longitude } = req.body;
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing coordinates',
          details: 'Latitude and longitude are required'
        });
      }
      
      // Validate coordinates
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          error: 'Invalid coordinates',
          details: 'Latitude must be between -90 and 90, longitude between -180 and 180'
        });
      }
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      // Update current location
      user.currentLocation = {
        type: 'Point',
        coordinates: [longitude, latitude],
        lastUpdated: new Date()
      };
      
      await user.save();
      
      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        currentLocation: user.currentLocation
      });
    } catch (error) {
      logger.error('Update current location error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update location',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get nearby professionals
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getNearbyProfessionals(req, res) {
    try {
      const { latitude, longitude, radius = 10, category } = req.query;
      
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing coordinates',
          details: 'Latitude and longitude are required'
        });
      }
      
      // Get specializations filter based on category
      let specializations = [];
      if (category) {
        specializations = [category];
      }
      
      // Find nearby professionals
      const professionals = await GeospatialService.findNearbyProfessionals(
        [parseFloat(longitude), parseFloat(latitude)], 
        parseFloat(radius),
        specializations
      );
      
      res.status(200).json({
        success: true,
        professionals,
        count: professionals.length
      });
    } catch (error) {
      logger.error('Get nearby professionals error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get nearby professionals',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Get user's addresses
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async getAddresses(req, res) {
    try {
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }
      
      res.status(200).json({
        success: true,
        addresses: user.addresses || []
      });
    } catch (error) {
      logger.error('Get addresses error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get addresses',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
  
  /**
   * Set default address
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  async setDefaultAddress(req, res) {
    try {
      const { addressId } = req.params;
      
      // Find user
      const user = await User.findById(req.user._id);
      
      if (!user || !user.addresses) {
        return res.status(404).json({
          success: false,
          error: 'User or addresses not found'
        });
      }
      
      // Find address index
      const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
      
      if (addressIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Address not found'
        });
      }
      
      // Set all addresses to non-default
      user.addresses.forEach((addr, index) => {
        user.addresses[index].isDefault = (index === addressIndex);
      });
      
      await user.save();
      
      res.status(200).json({
        success: true,
        message: 'Default address updated successfully',
        addresses: user.addresses
      });
    } catch (error) {
      logger.error('Set default address error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to set default address',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

module.exports = new LocationController();