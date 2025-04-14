class AnalyticsService {
    static async trackEvent(eventData) {
      try {
        const event = new AnalyticsEvent({
          type: eventData.type,
          userId: eventData.userId,
          metadata: eventData.metadata,
          timestamp: new Date()
        });
        await event.save();
  
        // Real-time processing using Redis
        await redis.publish('analytics', JSON.stringify(eventData));
      } catch (error) {
        logger.error('Analytics tracking error:', error);
      }
    }
  
    static async generateProfessionalMetrics(professionalId, timeframe) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - timeframe);
  
      const bookings = await Booking.find({
        professional: professionalId,
        createdAt: { $gte: startDate }
      });
  
      return {
        totalBookings: bookings.length,
        completedBookings: bookings.filter(b => b.status === 'completed').length,
        cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
        averageRating: this.calculateAverageRating(bookings),
        revenue: this.calculateRevenue(bookings),
        popularServices: await this.getPopularServices(bookings)
      };
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