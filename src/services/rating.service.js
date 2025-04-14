class RatingService {
    static async updateProfessionalRating(professionalId) {
      try {
        const bookings = await Booking.find({
          professional: professionalId,
          status: 'completed',
          rating: { $exists: true }
        });
  
        if (!bookings.length) return null;
  
        // Calculate weighted average based on recency
        const weightedRatings = bookings.map(booking => {
          const ageInDays = (Date.now() - booking.updatedAt) / (1000 * 60 * 60 * 24);
          const weight = Math.exp(-0.1 * ageInDays); // Exponential decay
          return {
            rating: booking.rating,
            weight
          };
        });
  
        const totalWeight = weightedRatings.reduce((sum, item) => sum + item.weight, 0);
        const weightedAverage = weightedRatings.reduce(
          (sum, item) => sum + item.rating * item.weight,
          0
        ) / totalWeight;
  
        await Professional.findByIdAndUpdate(professionalId, {
          'ratings.average': Number(weightedAverage.toFixed(2)),
          'ratings.count': bookings.length
        });
  
        return weightedAverage;
      } catch (error) {
        logger.error('Error updating professional rating:', error);
        throw error;
      }
    }
  
    static async getRatingBreakdown(professionalId) {
      try {
        const bookings = await Booking.find({
          professional: professionalId,
          status: 'completed',
          rating: { $exists: true }
        });
  
        const breakdown = {
          5: 0, 4: 0, 3: 0, 2: 0, 1: 0
        };
  
        bookings.forEach(booking => {
          breakdown[booking.rating]++;
        });
  
        return {
          breakdown,
          total: bookings.length,
          average: await this.updateProfessionalRating(professionalId)
        };
      } catch (error) {
        logger.error('Error getting rating breakdown:', error);
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