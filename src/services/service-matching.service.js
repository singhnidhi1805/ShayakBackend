const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');
const Booking = require('../models/booking.model');
const NotificationService = require('../services/notification.service');

class ServiceMatchingService {
  // Calculate distance between two coordinates
  static calculateDistance(coords1, coords2) {
    const R = 6371; // Earth's radius in kilometers
    const [lat1, lon1] = coords1;
    const [lat2, lon2] = coords2;

    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  }

  static toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  // Find professionals matching service and location
  static async findMatchingProfessionals(serviceId, location) {
    console.log(`🔵 Finding professionals for service: ${serviceId}`);

    const professionals = await Professional.find({
        specializations: { $in: [serviceId] },  // ✅ Fixed specialization match
        status: "verified",
        isOnline: true,
        isAvailable: true,
        "currentLocation.coordinates": { $exists: true, $ne: [0, 0] },
        currentLocation: {
            $near: {
                $geometry: {
                    type: "Point",
                    coordinates: location.coordinates
                },
                $maxDistance: 15000
            }
        }
    });

    console.log(`🟢 Found ${professionals.length} professionals`);
    return professionals;
}

  // Book service with emergency and standard options
  static async bookService(bookingData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, serviceId, location, scheduledDate, isEmergency } = bookingData;

        if (!userId || !serviceId || !location || !location.coordinates) {
            throw new Error('Invalid booking request');
        }

        const service = await Service.findById(serviceId);
        if (!service) {
            throw new Error('Service not found');
        }

        console.log(`Booking service: ${service.name}, User: ${userId}, Emergency: ${isEmergency}`);

        // ✅ FIX: Use `currentLocation` instead of `serviceAreas`
        const matchingProfessionals = await Professional.find({
            specializations: { $in: service.professionalTypes },
            status: 'verified',
            'currentLocation.isAvailable': true,
            'currentLocation.coordinates': { $exists: true, $ne: [0, 0] },
            currentLocation: {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: location.coordinates
                    },
                    $maxDistance: 10000
                }
            }
        });

        if (matchingProfessionals.length === 0) {
            throw new Error('No professionals available for this service');
        }

        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        const booking = new Booking({
            user: userId,
            service: serviceId,
            professional: matchingProfessionals[0]._id,
            location,
            scheduledDate,
            status: 'pending',
            verificationCode,
            totalAmount: service.pricing.basePrice,
            emergencyLevel: isEmergency ? 'high' : 'low'
        });

        await booking.save({ session });

        await session.commitTransaction();
        return booking;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
}

  // Professional actions: Accept, Reject, Reschedule
  static async handleProfessionalBookingAction(bookingId, professionalId, action) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const booking = await Booking.findById(bookingId);
      const professional = await Professional.findById(professionalId);

      if (!booking || !professional) {
        throw new Error('Booking or Professional not found');
      }

      switch (action) {
        case 'accept':
          booking.status = 'accepted';
          professional.currentBooking = {
            bookingId: booking._id,
            status: 'assigned'
          };
          break;
        case 'reject':
          booking.status = 'pending';
          // Find next available professional
          const nextProfessional = await Professional.findOne({
            specializations: { $in: booking.service.professionalTypes },
            status: 'verified',
            'currentLocation.isAvailable': true,
            _id: { $ne: professionalId }
          });

          if (nextProfessional) {
            booking.professional = nextProfessional._id;
          } else {
            booking.status = 'cancelled';
          }
          break;
        default:
          throw new Error('Invalid action');
      }

      await booking.save({ session });
      await professional.save({ session });

      // Notify user about booking status
      await NotificationService.sendPushNotification(booking.user, {
        type: 'BOOKING_STATUS_UPDATE',
        bookingId: booking._id,
        status: booking.status,
        professional: professional.name
      });

      await session.commitTransaction();
      return booking;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

module.exports = ServiceMatchingService;