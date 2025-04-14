const redis = require('../config/redis');
const logger = require('../config/logger');

const updateProfessionalLocation = async (professionalId, coordinates) => {
  try {
    await redis.set(
      `location:${professionalId}`,
      JSON.stringify(coordinates),
      'EX',
      300
    );

    await Professional.findOneAndUpdate(
      { userId: professionalId },
      {
        'currentLocation.coordinates': coordinates,
        'activeStatus.lastActive': new Date()
      }
    );

    return true;
  } catch (error) {
    logger.error('Error updating professional location:', error);
    throw error;
  }
};

const findNearbyProfessionals = async (coordinates, service, maxDistance = 10) => {
  try {
    const professionals = await Professional.find({
      'currentLocation': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: maxDistance * 1000
        }
      },
      'services.serviceId': service,
      'status': 'verified',
      'activeStatus.isOnline': true
    }).populate('userId', 'name email phone rating');

    return professionals;
  } catch (error) {
    logger.error('Error finding nearby professionals:', error);
    throw error;
  }
};

module.exports = {
  updateProfessionalLocation,
  findNearbyProfessionals
};