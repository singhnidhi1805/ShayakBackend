// src/controllers/earnings.controller.js
const Professional = require('../models/professional.model');
const Booking = require('../models/booking.model');
const Transaction = require('../models/transaction.model');
const PaymentMethod = require('../models/paymentMethod.model');
const Withdrawal = require('../models/withdrawal.model');
const { generatePdf } = require('../utils/pdf');

/**
 * Get earnings data with filter
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getEarnings = async (req, res) => {
  try {
    const { filter = 'week' } = req.query;
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    let startDate, endDate;
    const now = new Date();
    
    // Calculate start and end dates based on filter
    switch (filter) {
      case 'week':
        // Start from beginning of the week (Sunday)
        startDate = new Date(now);
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'month':
        // Start from beginning of the month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'year':
        // Start from beginning of the year
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
        
      case 'all':
        // No date filter
        startDate = null;
        endDate = null;
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid filter',
          details: 'Filter must be one of: week, month, year, all'
        });
    }
    
    // Build query
    const query = {
      professional: professional._id,
      status: 'completed'
    };
    
    if (startDate && endDate) {
      query.completedAt = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    // Get completed bookings
    const bookings = await Booking.find(query)
      .populate('service', 'name category')
      .sort({ completedAt: -1 });
    
    // Calculate total earnings
    const totalEarnings = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    
    // Get recent transactions
    const recentTransactions = bookings.slice(0, 5).map(booking => ({
      id: booking._id,
      service: booking.service.name,
      category: booking.service.category,
      amount: booking.totalAmount,
      date: booking.completedAt
    }));
    
    // Get earnings by service category
    const earningsByCategory = {};
    bookings.forEach(booking => {
      const category = booking.service.category;
      if (!earningsByCategory[category]) {
        earningsByCategory[category] = 0;
      }
      earningsByCategory[category] += booking.totalAmount;
    });
    
    // Format response
    const response = {
      totalEarnings,
      totalJobs: bookings.length,
      dateRange: {
        start: startDate,
        end: endDate
      },
      recentTransactions,
      earningsByCategory
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      error: 'Failed to get earnings data',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get detailed earnings for a specific time period
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getEarningsDetails = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'Missing dates',
        details: 'Start date and end date are required'
      });
    }
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Parse dates
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);
    parsedEndDate.setHours(23, 59, 59, 999);
    
    // Validate dates
    if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
      return res.status(400).json({
        error: 'Invalid date format',
        details: 'Dates must be in YYYY-MM-DD format'
      });
    }
    
    // Build query
    const query = {
      professional: professional._id,
      status: 'completed',
      completedAt: {
        $gte: parsedStartDate,
        $lte: parsedEndDate
      }
    };
    
    // Get completed bookings
    const bookings = await Booking.find(query)
      .populate('service', 'name category')
      .populate('user', 'name')
      .sort({ completedAt: -1 });
    
    // Format transactions
    const transactions = bookings.map(booking => ({
      id: booking._id,
      service: booking.service.name,
      category: booking.service.category,
      customer: booking.user.name,
      amount: booking.totalAmount,
      date: booking.completedAt,
      paymentStatus: booking.paymentStatus,
      hasInvoice: true // Assuming all completed bookings can generate invoice
    }));
    
    // Calculate statistics
    const totalEarnings = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const totalJobs = bookings.length;
    const averagePerJob = totalJobs > 0 ? totalEarnings / totalJobs : 0;
    
    // Group by date
    const earningsByDate = {};
    bookings.forEach(booking => {
      const date = booking.completedAt.toISOString().split('T')[0];
      if (!earningsByDate[date]) {
        earningsByDate[date] = 0;
      }
      earningsByDate[date] += booking.totalAmount;
    });
    
    // Format response
    const response = {
      dateRange: {
        start: parsedStartDate,
        end: parsedEndDate
      },
      statistics: {
        totalEarnings,
        totalJobs,
        averagePerJob
      },
      transactions,
      earningsByDate
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Get earnings details error:', error);
    res.status(500).json({
      error: 'Failed to get earnings details',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get transaction details
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getTransactionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Get booking (transaction)
    const booking = await Booking.findOne({
      _id: id,
      professional: professional._id,
      status: 'completed'
    })
      .populate('service', 'name category description pricing')
      .populate('user', 'name email phone')
      .populate({
        path: 'rating',
        select: 'score review createdAt'
      });
    
    if (!booking) {
      return res.status(404).json({
        error: 'Transaction not found',
        details: 'Could not find transaction with the provided ID'
      });
    }
    
    // Format response
    const response = {
      id: booking._id,
      service: {
        name: booking.service.name,
        category: booking.service.category,
        description: booking.service.description
      },
      customer: {
        name: booking.user.name,
        phone: booking.user.phone
      },
      amount: booking.totalAmount,
      commissionFee: booking.totalAmount * 0.15, // Assuming 15% platform fee
      netAmount: booking.totalAmount * 0.85,
      date: booking.completedAt,
      scheduledDate: booking.scheduledDate,
      paymentStatus: booking.paymentStatus,
      paymentMethod: 'Online Payment', // Default payment method
      rating: booking.rating || null,
      invoiceAvailable: true
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Get transaction details error:', error);
    res.status(500).json({
      error: 'Failed to get transaction details',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Generate invoice for a transaction
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.generateInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Get booking (transaction)
    const booking = await Booking.findOne({
      _id: id,
      professional: professional._id,
      status: 'completed'
    })
      .populate('service', 'name category description pricing')
      .populate('user', 'name email phone');
    
    if (!booking) {
      return res.status(404).json({
        error: 'Transaction not found',
        details: 'Could not find transaction with the provided ID'
      });
    }
    
    // Prepare invoice data
    const invoiceData = {
      invoiceNumber: `INV-${booking._id.toString().slice(-8)}`,
      invoiceDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)), // Due in 30 days
      professionalInfo: {
        name: professional.name,
        id: professional.userId,
        address: professional.address,
        city: professional.city,
        state: professional.state,
        pincode: professional.pincode,
        phone: professional.phone,
        email: professional.email
      },
      customerInfo: {
        name: booking.user.name,
        phone: booking.user.phone,
        email: booking.user.email
      },
      bookingInfo: {
        id: booking._id,
        date: booking.completedAt,
        service: booking.service.name,
        description: booking.service.description || 'Service provided as requested'
      },
      items: [
        {
          description: `${booking.service.name} Service`,
          quantity: 1,
          unitPrice: booking.totalAmount,
          amount: booking.totalAmount
        }
      ],
      subtotal: booking.totalAmount,
      tax: 0, // Assuming no tax
      total: booking.totalAmount,
      notes: 'Thank you for your business!'
    };
    
    // Generate PDF
    const pdfBuffer = await generatePdf(invoiceData, 'invoice');
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking._id}.pdf`);
    
    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate invoice error:', error);
    res.status(500).json({
      error: 'Failed to generate invoice',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get available balance for withdrawal
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getAvailableBalance = async (req, res) => {
  try {
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Get completed bookings with paid status
    const completedBookings = await Booking.find({
      professional: professional._id,
      status: 'completed',
      paymentStatus: 'paid'
    });
    
    // Calculate total earnings
    const totalEarnings = completedBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    
    // Get total withdrawals
    const withdrawals = await Withdrawal.find({
      professional: professional._id,
      status: { $in: ['processing', 'completed'] }
    });
    
    const totalWithdrawals = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    // Calculate available balance
    const availableBalance = totalEarnings * 0.85 - totalWithdrawals; // Assuming 15% platform fee
    
    // Get pending withdrawals
    const pendingWithdrawals = await Withdrawal.find({
      professional: professional._id,
      status: 'processing'
    });
    
    const pendingAmount = pendingWithdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    res.status(200).json({
      availableBalance: Math.max(0, availableBalance),
      pendingWithdrawals: pendingAmount,
      totalEarnings,
      platformFee: totalEarnings * 0.15,
      netEarnings: totalEarnings * 0.85,
      totalWithdrawn: totalWithdrawals
    });
  } catch (error) {
    console.error('Get available balance error:', error);
    res.status(500).json({
      error: 'Failed to get available balance',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get payment methods
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getPaymentMethods = async (req, res) => {
  try {
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Get payment methods
    const paymentMethods = await PaymentMethod.find({
      professional: professional._id,
      isActive: true
    });
    
    // Format response
    const formattedPaymentMethods = paymentMethods.map(method => ({
      id: method._id,
      type: method.type,
      name: method.name,
      accountNumber: method.accountNumber ? `xxxx${method.accountNumber.slice(-4)}` : null,
      upiId: method.upiId,
      bankName: method.bankName,
      ifscCode: method.ifscCode,
      isDefault: method.isDefault
    }));
    
    res.status(200).json({
      paymentMethods: formattedPaymentMethods
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      error: 'Failed to get payment methods',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Add payment method
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.addPaymentMethod = async (req, res) => {
  try {
    const {
      type,
      name,
      accountNumber,
      upiId,
      bankName,
      ifscCode,
      isDefault
    } = req.body;
    
    // Validate type
    if (!type || !['bank_account', 'upi'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid payment method type',
        details: 'Type must be either bank_account or upi'
      });
    }
    
    // Validate fields based on type
    if (type === 'bank_account') {
      if (!name || !accountNumber || !bankName || !ifscCode) {
        return res.status(400).json({
          error: 'Missing fields',
          details: 'Name, account number, bank name, and IFSC code are required for bank accounts'
        });
      }
    } else if (type === 'upi') {
      if (!upiId) {
        return res.status(400).json({
          error: 'Missing fields',
          details: 'UPI ID is required for UPI payment methods'
        });
      }
    }
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Create payment method
    const paymentMethod = new PaymentMethod({
      professional: professional._id,
      type,
      name: name || (type === 'upi' ? 'UPI' : 'Bank Account'),
      accountNumber,
      upiId,
      bankName,
      ifscCode,
      isDefault: !!isDefault,
      isActive: true
    });
    
    // If this is the first payment method or isDefault is true, set as default
    if (isDefault) {
      // Remove default flag from other payment methods
      await PaymentMethod.updateMany(
        {
          professional: professional._id,
          isDefault: true
        },
        {
          isDefault: false
        }
      );
    } else {
      // Check if there are any existing payment methods
      const existingMethods = await PaymentMethod.countDocuments({
        professional: professional._id,
        isActive: true
      });
      
      if (existingMethods === 0) {
        paymentMethod.isDefault = true;
      }
    }
    
    await paymentMethod.save();
    
    res.status(201).json({
      message: 'Payment method added successfully',
      paymentMethod: {
        id: paymentMethod._id,
        type: paymentMethod.type,
        name: paymentMethod.name,
        accountNumber: paymentMethod.accountNumber ? `xxxx${paymentMethod.accountNumber.slice(-4)}` : null,
        upiId: paymentMethod.upiId,
        bankName: paymentMethod.bankName,
        ifscCode: paymentMethod.ifscCode,
        isDefault: paymentMethod.isDefault
      }
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({
      error: 'Failed to add payment method',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Remove payment method
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.removePaymentMethod = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Find payment method
    const paymentMethod = await PaymentMethod.findOne({
      _id: id,
      professional: professional._id
    });
    
    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found',
        details: 'Could not find payment method with the provided ID'
      });
    }
    
    // Check if it's the default method
    if (paymentMethod.isDefault) {
      // Find another payment method to set as default
      const anotherMethod = await PaymentMethod.findOne({
        professional: professional._id,
        _id: { $ne: id },
        isActive: true
      });
      
      if (anotherMethod) {
        anotherMethod.isDefault = true;
        await anotherMethod.save();
      }
    }
    
    // Soft delete by setting isActive to false
    paymentMethod.isActive = false;
    await paymentMethod.save();
    
    res.status(200).json({
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    console.error('Remove payment method error:', error);
    res.status(500).json({
      error: 'Failed to remove payment method',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Request withdrawal
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.requestWithdrawal = async (req, res) => {
  try {
    const { amount, paymentMethodId } = req.body;
    
    if (!amount || !paymentMethodId) {
      return res.status(400).json({
        error: 'Missing fields',
        details: 'Amount and payment method ID are required'
      });
    }
    
    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount',
        details: 'Amount must be a positive number'
      });
    }
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Find payment method
    const paymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      professional: professional._id,
      isActive: true
    });
    
    if (!paymentMethod) {
      return res.status(404).json({
        error: 'Payment method not found',
        details: 'Could not find payment method with the provided ID'
      });
    }
    
    // Get available balance
    const completedBookings = await Booking.find({
      professional: professional._id,
      status: 'completed',
      paymentStatus: 'paid'
    });
    
    const totalEarnings = completedBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    
    const withdrawals = await Withdrawal.find({
      professional: professional._id,
      status: { $in: ['processing', 'completed'] }
    });
    
    const totalWithdrawals = withdrawals.reduce((sum, withdrawal) => sum + withdrawal.amount, 0);
    
    const availableBalance = totalEarnings * 0.85 - totalWithdrawals;
    
    // Check if amount is available
    if (amount > availableBalance) {
      return res.status(400).json({
        error: 'Insufficient balance',
        details: `Available balance is ${availableBalance}, which is less than the requested amount ${amount}`
      });
    }
    
    // Create withdrawal request
    const withdrawal = new Withdrawal({
      professional: professional._id,
      amount,
      paymentMethod: paymentMethodId,
      status: 'processing',
      requestedAt: new Date()
    });
    
    await withdrawal.save();
    
    res.status(201).json({
      message: 'Withdrawal request submitted successfully',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt
      }
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      error: 'Failed to request withdrawal',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get withdrawal history
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getWithdrawalHistory = async (req, res) => {
  try {
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Get withdrawals
    const withdrawals = await Withdrawal.find({
      professional: professional._id
    })
      .populate('paymentMethod')
      .sort({ requestedAt: -1 });
    
    // Format response
    const formattedWithdrawals = withdrawals.map(withdrawal => ({
      id: withdrawal._id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      paymentMethod: {
        type: withdrawal.paymentMethod.type,
        name: withdrawal.paymentMethod.name,
        accountNumber: withdrawal.paymentMethod.accountNumber ? `xxxx${withdrawal.paymentMethod.accountNumber.slice(-4)}` : null,
        upiId: withdrawal.paymentMethod.upiId
      },
      requestedAt: withdrawal.requestedAt,
      processedAt: withdrawal.processedAt,
      completedAt: withdrawal.completedAt,
      reference: withdrawal.reference
    }));
    
    res.status(200).json({
      withdrawals: formattedWithdrawals
    });
  } catch (error) {
    console.error('Get withdrawal history error:', error);
    res.status(500).json({
      error: 'Failed to get withdrawal history',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get withdrawal details
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getWithdrawalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    // Find withdrawal
    const withdrawal = await Withdrawal.findOne({
      _id: id,
      professional: professional._id
    }).populate('paymentMethod');
    
    if (!withdrawal) {
      return res.status(404).json({
        error: 'Withdrawal not found',
        details: 'Could not find withdrawal with the provided ID'
      });
    }
    
    // Format response
    const response = {
      id: withdrawal._id,
      amount: withdrawal.amount,
      status: withdrawal.status,
      paymentMethod: {
        type: withdrawal.paymentMethod.type,
        name: withdrawal.paymentMethod.name,
        accountNumber: withdrawal.paymentMethod.accountNumber ? `xxxx${withdrawal.paymentMethod.accountNumber.slice(-4)}` : null,
        upiId: withdrawal.paymentMethod.upiId,
        bankName: withdrawal.paymentMethod.bankName,
        ifscCode: withdrawal.paymentMethod.ifscCode
      },
      requestedAt: withdrawal.requestedAt,
      processedAt: withdrawal.processedAt,
      completedAt: withdrawal.completedAt,
      reference: withdrawal.reference,
      remarks: withdrawal.remarks
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Get withdrawal details error:', error);
    res.status(500).json({
      error: 'Failed to get withdrawal details',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Get earnings analytics
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
exports.getEarningsAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Find professional by userId
    const professional = await Professional.findOne({ userId: req.user.userId });
    
    if (!professional) {
      return res.status(404).json({
        error: 'Professional profile not found',
        details: 'Could not find professional profile for this user'
      });
    }
    
    let startDate, endDate, groupByFormat;
    const now = new Date();
    
    // Calculate date range based on period
    switch (period) {
      case 'week':
        // Last 7 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        endDate = new Date(now);
        groupByFormat = '%Y-%m-%d'; // Group by day
        break;
        
      case 'month':
        // Last 30 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        endDate = new Date(now);
        groupByFormat = '%Y-%m-%d'; // Group by day
        break;
        
      case 'year':
        // Last 12 months
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        endDate = new Date(now);
        groupByFormat = '%Y-%m'; // Group by month
        break;
        
      default:
        return res.status(400).json({
          error: 'Invalid period',
          details: 'Period must be one of: week, month, year'
        });
    }
    
    // Get completed bookings
    const bookings = await Booking.find({
      professional: professional._id,
      status: 'completed',
      completedAt: {
        $gte: startDate,
        $lte: endDate
      }
    }).populate('service', 'category');
    
    // Calculate earnings by date
    const earningsByDate = {};
    const servicesByCategory = {};
    const dayOfWeekCount = [0, 0, 0, 0, 0, 0, 0]; // Sun to Sat
    
    bookings.forEach(booking => {
      // Format date based on period
      let dateKey;
      if (period === 'year') {
        const month = booking.completedAt.getMonth() + 1;
        const year = booking.completedAt.getFullYear();
        dateKey = `${year}-${month.toString().padStart(2, '0')}`;
      } else {
        dateKey = booking.completedAt.toISOString().split('T')[0];
      }
      
      // Add to earnings by date
      if (!earningsByDate[dateKey]) {
        earningsByDate[dateKey] = 0;
      }
      earningsByDate[dateKey] += booking.totalAmount;
      
      // Add to services by category
      const category = booking.service.category;
      if (!servicesByCategory[category]) {
        servicesByCategory[category] = 0;
      }
      servicesByCategory[category]++;
      
      // Add to day of week count
      const dayOfWeek = booking.completedAt.getDay(); // 0 = Sunday, 6 = Saturday
      dayOfWeekCount[dayOfWeek]++;
    });
    
    // Convert earnings by date to array
    const earningsData = Object.entries(earningsByDate).map(([date, amount]) => ({
      date,
      amount
    })).sort((a, b) => a.date.localeCompare(b.date));
    
    // Convert services by category to array
    const categoriesData = Object.entries(servicesByCategory).map(([category, count]) => ({
      category,
      count
    })).sort((a, b) => b.count - a.count);
    
    // Format day of week data
    const dayOfWeekData = [
      { day: 'Sunday', count: dayOfWeekCount[0] },
      { day: 'Monday', count: dayOfWeekCount[1] },
      { day: 'Tuesday', count: dayOfWeekCount[2] },
      { day: 'Wednesday', count: dayOfWeekCount[3] },
      { day: 'Thursday', count: dayOfWeekCount[4] },
      { day: 'Friday', count: dayOfWeekCount[5] },
      { day: 'Saturday', count: dayOfWeekCount[6] }
    ];
    
    // Calculate trends
    const totalEarnings = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const totalJobs = bookings.length;
    
    // Get previous period data for comparison
    const previousStartDate = new Date(startDate);
    const previousEndDate = new Date(endDate);
    
    if (period === 'week') {
      previousStartDate.setDate(previousStartDate.getDate() - 7);
      previousEndDate.setDate(previousEndDate.getDate() - 7);
    } else if (period === 'month') {
      previousStartDate.setDate(previousStartDate.getDate() - 30);
      previousEndDate.setDate(previousEndDate.getDate() - 30);
    } else if (period === 'year') {
      previousStartDate.setFullYear(previousStartDate.getFullYear() - 1);
      previousEndDate.setFullYear(previousEndDate.getFullYear() - 1);
    }
    
    const previousBookings = await Booking.find({
      professional: professional._id,
      status: 'completed',
      completedAt: {
        $gte: previousStartDate,
        $lte: previousEndDate
      }
    });
    
    const previousEarnings = previousBookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const previousJobs = previousBookings.length;
    
    const earningsChange = previousEarnings > 0 
      ? ((totalEarnings - previousEarnings) / previousEarnings) * 100 
      : 0;
      
    const jobsChange = previousJobs > 0 
      ? ((totalJobs - previousJobs) / previousJobs) * 100 
      : 0;
    
    res.status(200).json({
      period,
      dateRange: {
        start: startDate,
        end: endDate
      },
      summary: {
        totalEarnings,
        totalJobs,
        averagePerJob: totalJobs > 0 ? totalEarnings / totalJobs : 0
      },
      trends: {
        earningsChange,
        jobsChange
      },
      charts: {
        earningsByDate: earningsData,
        servicesByCategory: categoriesData,
        bookingsByDayOfWeek: dayOfWeekData
      }
    });
  } catch (error) {
    console.error('Get earnings analytics error:', error);
    res.status(500).json({
      error: 'Failed to get earnings analytics',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};