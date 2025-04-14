const mongoose = require('mongoose');
const Professional = require('../models/professional.model');
const Booking = require('../models/booking.model');
const NotificationService = require('./notification.service');
const redis = require('../config/redis');

class ProfessionalService {
  // Generate unique employee ID based on category
  async generateEmployeeId(category) {
    const year = new Date().getFullYear().toString().substr(-2);
    const prefix = category.substring(0, 3).toUpperCase();
    const count = await Professional.countDocuments({
      'serviceCategories.category': category
    });
    return `${prefix}${year}${(count + 1).toString().padStart(4, '0')}`;
  }

  // Professional onboarding
  async onboardProfessional(professionalData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { categories, ...data } = professionalData;
      
      // Create professional profile
      const professional = new Professional({
        ...data,
        status: 'pending',
        serviceCategories: await Promise.all(categories.map(async category => ({
          category: category,
          employeeId: await this.generateEmployeeId(category),
          verificationStatus: 'pending',
          isActive: false
        })))
      });

      await professional.save({ session });

      await session.commitTransaction();
      return professional;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    }
  }

  async uploadDocument(professionalId, documentType, file) {
    if (!file) throw createError(400, 'No file provided');
    
    const professional = await Professional.findById(professionalId);
    if (!professional) throw createError(404, 'Professional not found');

    const fileUrl = await uploadToS3(file, `documents/${professionalId}/${documentType}`);
    
    professional.documents.push({
      type: documentType,
      fileUrl,
      status: 'pending',
      uploadedAt: new Date()
    });

    professional.documentsStatus[documentType] = 'pending';
    await professional.save();

    await sendNotification('DOCUMENT_UPLOADED', {
      professional,
      documentType
    });

    return { success: true };
  }


  // Find nearby bookings for professional
  async findNearbyBookings(professionalId, coordinates) {
    const professional = await Professional.findById(professionalId);
    
    return await Booking.find({
      status: 'pending',
      'location.coordinates': {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: coordinates
          },
          $maxDistance: 15000 // 15km radius
        }
      },
      serviceCategory: {
        $in: professional.serviceCategories.map(sc => sc.category)
      }
    }).populate('user', 'name phone');
  }
  async validateDocument(professionalId, documentId, adminId, isValid, remarks) {
    const professional = await Professional.findById(professionalId);
    if (!professional) throw createError(404, 'Professional not found');

    const document = professional.documents.id(documentId);
    if (!document) throw createError(404, 'Document not found');

    document.status = isValid ? 'approved' : 'rejected';
    document.verifiedBy = adminId;
    document.verifiedAt = new Date();
    document.remarks = remarks;

    professional.documentsStatus[document.type] = document.status;
    
    // Update verification progress
    const totalDocuments = Object.keys(professional.documentsStatus).length;
    const verifiedDocuments = Object.values(professional.documentsStatus)
      .filter(status => status === 'approved').length;
    
    professional.verificationProgress = (verifiedDocuments / totalDocuments) * 100;

    if (professional.verificationProgress === 100) {
      professional.status = 'verified';
      await sendNotification('VERIFICATION_COMPLETED', professional);
    }

    await professional.save();
    await sendNotification('DOCUMENT_VERIFIED', {
      professional,
      document,
      isValid,
      remarks
    });

    return { success: true };
  }

  async trackPerformanceMetrics(professionalId) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const bookings = await Booking.find({
      professional: professionalId,
      createdAt: { $gte: thirtyDaysAgo }
    });

    const metrics = {
      totalBookings: bookings.length,
      completionRate: 0,
      averageRating: 0,
      responseTime: 0,
      cancelationRate: 0
    };

    if (bookings.length > 0) {
      const completed = bookings.filter(b => b.status === 'completed');
      const cancelled = bookings.filter(b => b.status === 'cancelled');
      const ratings = completed.map(b => b.rating).filter(r => r);
      
      metrics.completionRate = (completed.length / bookings.length) * 100;
      metrics.averageRating = ratings.length ? 
        ratings.reduce((a, b) => a + b) / ratings.length : 0;
      metrics.cancelationRate = (cancelled.length / bookings.length) * 100;
    }

    await Professional.findByIdAndUpdate(professionalId, {
      $set: { performanceMetrics: metrics }
    });

    return metrics;
  }

  // Update professional's real-time location
  async updateLocation(professionalId, coordinates) {
    await redis.set(
      `location:${professionalId}`,
      JSON.stringify(coordinates),
      'EX',
      300 // Expire after 5 minutes
    );

    await Professional.findByIdAndUpdate(professionalId, {
      'currentLocation.coordinates': coordinates,
      'activeStatus.lastActive': new Date()
    });
  }
}


module.exports = {
    ProfessionalService: new ProfessionalService(),

  };