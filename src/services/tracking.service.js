const socketIO = require('../config/socket');
const redisClient = require('../config/redis');

class TrackingService {
  static async updateProfessionalLocation(professionalId, coordinates) {
    try {
      // Store location in Redis with 5-minute expiry
      await redisClient.set(
        `location:${professionalId}`,
        JSON.stringify(coordinates),
        'EX',
        300
      );

      // Emit location update to relevant clients
      const activeBookings = await Booking.find({
        professional: professionalId,
        status: 'in_progress'
      });

      activeBookings.forEach(booking => {
        socketIO.to(`booking_${booking._id}`).emit('professional_location', {
          bookingId: booking._id,
          coordinates
        });
      });

      return true;
    } catch (error) {
      logger.error('Error updating location:', error);
      throw error;
    }
  }

  static async getProfessionalLocation(professionalId) {
    try {
      const location = await redisClient.get(`location:${professionalId}`);
      if (!location) {
        const professional = await Professional.findById(professionalId);
        return professional?.currentLocation?.coordinates;
      }
      return JSON.parse(location);
    } catch (error) {
      logger.error('Error getting location:', error);
      throw error;
    }
  }

  static async trackBookingProgress(bookingId) {
    try {
      const booking = await Booking.findById(bookingId)
        .populate('professional')
        .populate('service');

      if (!booking) throw new Error('Booking not found');

      const estimatedDuration = booking.service.duration;
      const startTime = new Date(booking.scheduledDate);
      const currentTime = new Date();
      
      const progress = Math.min(
        ((currentTime - startTime) / (estimatedDuration * 60000)) * 100,
        100
      );

      return {
        progress,
        estimatedCompletion: new Date(startTime.getTime() + estimatedDuration * 60000),
        professionalLocation: await this.getProfessionalLocation(booking.professional._id)
      };
    } catch (error) {
      logger.error('Error tracking progress:', error);
      throw error;
    }
  }
}

module.exports = {
    MatchingService,
    TrackingService,
    PaymentService,
    RatingService,
    NotificationService
  };