const axios = require('axios');

class GeocodingService {
  static async getCoordinates(address) {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            address,
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        }
      );

      if (response.data.results.length > 0) {
        const { lat, lng } = response.data.results[0].geometry.location;
        return [lng, lat];
      }
      throw new Error('Address not found');
    } catch (error) {
      logger.error('Geocoding error:', error);
      throw error;
    }
  }

  static async getAddress(coordinates) {
    try {
      const [lng, lat] = coordinates;
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json`,
        {
          params: {
            latlng: `${lat},${lng}`,
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        }
      );

      if (response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
      throw new Error('Coordinates not found');
    } catch (error) {
      logger.error('Reverse geocoding error:', error);
      throw error;
    }
  }
}


module.exports = {
    backupDatabase,
    EmailService,
    CacheService,
    AnalyticsService,
    Encryption,
    Validators,
    GeocodingService
  };