const Admin = require('../models/admin.model');
const Professional = require('../models/professional.model');
const Service = require('../models/service.model');
const Booking = require('../models/booking.model'); // Assuming you have this model
const logger = require('../config/logger');

const getDashboardStats = async (req, res) => {
  try {
    const [
      totalProfessionals,
      pendingVerificationCount,
      verifiedCount,
      rejectedCount,
      totalServicesCount,
      activeServicesCount
    ] = await Promise.all([
      Professional.countDocuments(),
      Professional.countDocuments({ status: 'under_review' }),
      Professional.countDocuments({ status: 'verified' }),
      Professional.countDocuments({ status: 'rejected' }),
      Service.countDocuments(),
      Service.countDocuments({ isActive: true }),
    ]);

    res.json({
      totalProfessionals,
      pendingVerification: pendingVerificationCount,
      verified: verifiedCount,
      rejected: rejectedCount,
      totalServices: totalServicesCount,
      activeServices: activeServicesCount,
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, oldPassword, newPassword } = req.body;
    const adminId = req.user.id;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    if (name) admin.name = name;
    if (email) admin.email = email;

    if (oldPassword && newPassword) {
      const isMatch = await admin.comparePassword(oldPassword);
      if (!isMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
      admin.password = newPassword;
    }

    await admin.save();

    res.json({
      message: 'Profile updated successfully',
      user: { ...admin.toObject(), role: 'admin' }
    });
  } catch (error) {
    logger.error('Error updating admin profile:', error);
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
};

const getReportData = async (req, res) => {
  try {
    const { timeFrame } = req.query;
    const reportType = req.params.reportType;
    
    const endDate = new Date();
    let startDate = new Date();
    
    switch (timeFrame) {
      case 'week': startDate.setDate(endDate.getDate() - 7); break;
      case 'month': startDate.setMonth(endDate.getMonth() - 1); break;
      case 'quarter': startDate.setMonth(endDate.getMonth() - 3); break;
      case 'year': startDate.setFullYear(endDate.getFullYear() - 1); break;
      default: startDate.setMonth(endDate.getMonth() - 1);
    }

    let reportData = {};

    if (reportType === 'professional_onboarding') {
      const totalProfessionals = await Professional.countDocuments();
      const newRegistrations = await Professional.countDocuments({ createdAt: { $gte: startDate, $lte: endDate } });
      const completedOnboarding = await Professional.countDocuments({ status: 'verified', updatedAt: { $gte: startDate, $lte: endDate } });

      reportData = { totalProfessionals, newRegistrations, completedOnboarding };
    }

    res.json(reportData);
  } catch (error) {
    logger.error(`Error generating ${req.params.reportType} report:`, error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
};

const exportReport = async (req, res) => {
  try {
    const { reportType, timeFrame } = req.params;
    
    const csvData = "placeholder,csv,data";
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${reportType}_${timeFrame}_${Date.now()}.csv`);
    
    res.send(csvData);
  } catch (error) {
    logger.error('Error exporting report:', error);
    res.status(500).json({ error: 'Failed to export report' });
  }
};

// ✅ Export the functions properly
module.exports = {
  getDashboardStats,
  updateProfile,
  getReportData,
  exportReport
};
