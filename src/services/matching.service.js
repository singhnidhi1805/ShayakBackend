const Professional = require('../models/professional.model');
const Booking = require('../models/booking.model');
const redis = require('../config/redis');
const logger = require('../config/logger');

class MatchingService {
  static async findBestMatch(bookingRequest) {
    try {
      const { serviceId, location, scheduledDate } = bookingRequest;
      
      // Find nearby available professionals
      const professionals = await Professional.find({
        status: 'verified',
        'activeStatus.isOnline': true,
        'services.serviceId': serviceId,
        'currentLocation': {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: location.coordinates
            },
            $maxDistance: 10000 // 10km radius
          }
        }
      }).populate('userId', 'name rating');

      // Score each professional
      const scoredProfessionals = await Promise.all(
        professionals.map(async (prof) => {
          const score = await this.calculateMatchScore(prof, bookingRequest);
          return { professional: prof, score };
        })
      );

      // Sort by score and return best matches
      return scoredProfessionals
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.professional);
    } catch (error) {
      logger.error('Error finding best match:', error);
      throw error;
    }
  }
  

  static async calculateMatchScore(professional, booking) {
    let score = 0;
    
    // Distance score (closer = better)
    const distance = this.calculateDistance(
      professional.currentLocation.coordinates,
      booking.location.coordinates
    );
    score += (10 - Math.min(distance, 10)) * 10; // Max 100 points

    // Rating score
    score += (professional.ratings.average || 0) * 20; // Max 100 points

    // Experience score
    score += Math.min(professional.experience, 5) * 10; // Max 50 points

    // Recent completion rate
    const completionRate = await this.getRecentCompletionRate(professional._id);
    score += completionRate * 50; // Max 50 points

    return score;
  }

  static async getRecentCompletionRate(professionalId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const bookings = await Booking.find({
      professional: professionalId,
      createdAt: { $gte: thirtyDaysAgo },
      status: { $in: ['completed', 'cancelled'] }
    });

    if (!bookings.length) return 0.5; // Default score for new professionals

    const completed = bookings.filter(b => b.status === 'completed').length;
    return completed / bookings.length;
  }

  static calculateDistance(coords1, coords2) {
    // Haversine formula implementation
    const R = 6371; // Earth's radius in km
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;
    
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  static toRad(value) {
    return value * Math.PI / 180;
  }
}
