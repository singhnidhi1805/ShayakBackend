// controllers/payment.controller.js
const PaymentService = require('../services/payment.service');
const Payment = require('../models/payment.model');
const Booking = require('../models/booking.model');
const mongoose = require('mongoose');

class PaymentController {
  
  /**
   * Initiate payment after service completion
   */
  async initiatePayment(req, res) {
    console.log('🏦 [PAYMENT-API] Payment initiation request received');
    console.log('📊 [PAYMENT-API] Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const { bookingId, serviceAmount, additionalCharges = [], paymentMethod } = req.body;
      
      // Validation
      if (!bookingId || !serviceAmount || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Booking ID, service amount, and payment method are required'
        });
      }
      
      if (!['online', 'upi', 'cash'].includes(paymentMethod)) {
        return res.status(400).json({
          success: false,
          message: 'Payment method must be online, upi, or cash'
        });
      }
      
      if (serviceAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Service amount must be greater than 0'
        });
      }
      
      // Check if user is authorized for this booking
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        });
      }
      
      // Only customer or assigned professional can initiate payment
      const isAuthorized = booking.user.toString() === req.user._id.toString() ||
                          booking.professional.toString() === req.user._id.toString();
      
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to initiate payment for this booking'
        });
      }
      
      console.log('✅ [PAYMENT-API] Authorization successful');
      
      const result = await PaymentService.initiatePayment(bookingId, {
        serviceAmount,
        additionalCharges,
        paymentMethod
      });
      
      const response = {
        success: true,
        message: 'Payment initiated successfully',
        data: {
          paymentId: result.payment._id,
          bookingId,
          paymentMethod,
          breakdown: result.breakdown,
          paymentOrder: result.paymentOrder
        }
      };
      
      // Add specific instructions based on payment method
      if (paymentMethod === 'online') {
        response.data.instructions = 'Complete payment using Razorpay gateway';
        response.data.razorpayOptions = result.paymentOrder;
      } else if (paymentMethod === 'upi') {
        response.data.instructions = 'Pay using UPI app or scan QR code';
        response.data.upiDetails = result.paymentOrder;
      } else if (paymentMethod === 'cash') {
        response.data.instructions = 'Cash payment completed. Professional will pay platform commission.';
        response.data.commissionDetails = {
          amount: result.breakdown.platformCommission,
          dueDate: result.payment.commissionDueDate
        };
      }
      
      res.status(201).json(response);
      console.log('📤 [PAYMENT-API] Payment initiation response sent');
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Payment initiation failed:', error);
      
      let statusCode = 500;
      let message = 'Payment initiation failed';
      
      if (error.message.includes('not found')) {
        statusCode = 404;
      } else if (error.message.includes('already processed') || error.message.includes('must be completed')) {
        statusCode = 409;
        message = error.message;
      } else if (error.message.includes('required') || error.message.includes('invalid')) {
        statusCode = 400;
        message = error.message;
      }
      
      res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
 * Complete a booking with verification code and initiate payment
 */
async completeBooking(req, res) {
  console.log('✅ [BOOKING-API] Completing booking:', req.params.bookingId);
  
  try {
    const { bookingId } = req.params;
    const { verificationCode, serviceAmount, additionalCharges = [] } = req.body;

    if (!verificationCode) {
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code is required' 
      });
    }

    if (!serviceAmount || serviceAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid service amount is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking ID format'
      });
    }

    // Complete the service using existing service
    const booking = await EnhancedBookingService.completeService(bookingId, req.user._id, verificationCode);

    console.log('✅ [BOOKING-API] Booking completed successfully');

    // Prepare payment options for the user
    const totalAdditionalAmount = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
    const totalServiceAmount = serviceAmount + totalAdditionalAmount;
    const platformCommission = totalServiceAmount * 0.15;
    const professionalPayout = totalServiceAmount - platformCommission;

    const paymentBreakdown = {
      serviceAmount: serviceAmount,
      additionalAmount: totalAdditionalAmount,
      totalAmount: totalServiceAmount,
      platformCommission: Math.round(platformCommission * 100) / 100,
      professionalPayout: Math.round(professionalPayout * 100) / 100
    };

    res.json({
      success: true,
      message: 'Service completed successfully! Choose your payment method.',
      data: {
        booking: {
          _id: booking._id,
          status: booking.status,
          completedAt: booking.completedAt,
          paymentStatus: 'pending'
        },
        paymentRequired: true,
        paymentBreakdown,
        additionalCharges,
        paymentOptions: {
          online: {
            method: 'online',
            description: 'Pay securely using card/UPI via Razorpay',
            processingTime: 'Instant'
          },
          upi: {
            method: 'upi',
            description: 'Pay directly using your UPI app',
            processingTime: 'Instant'
          },
          cash: {
            method: 'cash',
            description: 'Pay cash to the professional',
            processingTime: 'Instant',
            note: 'Professional will pay 15% platform commission later'
          }
        },
        nextSteps: {
          message: 'Service completed successfully! Please choose your preferred payment method to complete the transaction.',
          actions: [
            {
              action: 'initiate_payment',
              endpoint: '/api/payments/initiate',
              description: 'Call this endpoint with your chosen payment method'
            }
          ]
        }
      }
    });
    
  } catch (error) {
    console.error('❌ [BOOKING-API] Complete booking error:', error);
    
    let statusCode = 500;
    if (error.message.includes('not found')) {
      statusCode = 404;
    } else if (error.message.includes('Invalid verification code')) {
      statusCode = 400;
    } else if (error.message.includes('not assigned')) {
      statusCode = 403;
    }
    
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to complete booking'
    });
  }
}
  
  /**
   * Add additional charges before payment
   */
  async addAdditionalCharges(req, res) {
    console.log('➕ [PAYMENT-API] Adding additional charges');
    
    try {
      const { bookingId } = req.params;
      const { charges } = req.body;
      
      if (!charges || !Array.isArray(charges)) {
        return res.status(400).json({
          success: false,
          message: 'Charges array is required'
        });
      }
      
      const result = await PaymentService.addAdditionalCharges(
        bookingId, 
        charges, 
        req.user._id
      );
      
      res.json({
        success: true,
        message: 'Additional charges added successfully',
        data: result
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Adding charges failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 :
                         error.message.includes('Only assigned') ? 403 :
                         error.message.includes('Invalid') ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Failed to add additional charges'
      });
    }
  }
  
  /**
   * Verify Razorpay payment
   */
  async verifyRazorpayPayment(req, res) {
    console.log('🔍 [PAYMENT-API] Verifying Razorpay payment');
    
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: 'Missing Razorpay payment details'
        });
      }
      
      const payment = await PaymentService.verifyRazorpayPayment({
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      });
      
      res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          paymentId: payment._id,
          status: payment.status,
          amount: payment.totalAmount,
          completedAt: payment.completedAt
        }
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Payment verification failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 :
                         error.message.includes('Invalid') ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Payment verification failed'
      });
    }
  }
  
  /**
   * Verify UPI payment
   */
  async verifyUPIPayment(req, res) {
    console.log('📱 [PAYMENT-API] Verifying UPI payment');
    
    try {
      const { paymentId } = req.params;
      const { upiTransactionId } = req.body;
      
      if (!upiTransactionId) {
        return res.status(400).json({
          success: false,
          message: 'UPI transaction ID is required'
        });
      }
      
      const payment = await PaymentService.verifyUPIPayment(paymentId, upiTransactionId);
      
      res.json({
        success: true,
        message: 'UPI payment verified successfully',
        data: {
          paymentId: payment._id,
          status: payment.status,
          amount: payment.totalAmount,
          upiTransactionId: payment.upiTransactionId
        }
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] UPI verification failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 :
                         error.message.includes('Invalid') ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'UPI payment verification failed'
      });
    }
  }
  
  /**
   * Get payment details
   */
  async getPaymentDetails(req, res) {
    try {
      const { paymentId } = req.params;
      
      const payment = await Payment.findById(paymentId)
        .populate('booking', 'service scheduledDate status')
        .populate('professional', 'name phone')
        .populate('user', 'name phone');
      
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }
      
      // Check authorization
      const isAuthorized = payment.user._id.toString() === req.user._id.toString() ||
                          payment.professional._id.toString() === req.user._id.toString() ||
                          req.userRole === 'admin';
      
      if (!isAuthorized) {
        return res.status(403).json({
          success: false,
          message: 'Not authorized to view this payment'
        });
      }
      
      res.json({
        success: true,
        data: {
          payment: {
            _id: payment._id,
            totalAmount: payment.totalAmount,
            serviceAmount: payment.serviceAmount,
            additionalAmount: payment.additionalAmount,
            platformCommission: payment.platformCommission,
            professionalPayout: payment.professionalPayout,
            paymentMethod: payment.paymentMethod,
            status: payment.status,
            completedAt: payment.completedAt,
            additionalCharges: payment.additionalCharges,
            invoice: payment.invoice,
            commissionStatus: payment.commissionStatus,
            commissionDueDate: payment.commissionDueDate
          }
        }
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Get payment details failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment details'
      });
    }
  }
  
  /**
   * Get payment summary for a booking
   */
  async getPaymentSummary(req, res) {
    try {
      const { bookingId } = req.params;
      
      const summary = await PaymentService.getPaymentSummary(bookingId);
      
      if (!summary) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found for this booking'
        });
      }
      
      res.json({
        success: true,
        data: summary
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Get payment summary failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get payment summary'
      });
    }
  }
  
  /**
   * Process refund (Admin only)
   */
  async processRefund(req, res) {
    try {
      if (req.userRole !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Only admins can process refunds'
        });
      }
      
      const { paymentId } = req.params;
      const { refundAmount, reason } = req.body;
      
      if (!refundAmount || !reason) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount and reason are required'
        });
      }
      
      const payment = await PaymentService.processRefund(paymentId, refundAmount, reason);
      
      res.json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          paymentId: payment._id,
          refundAmount: payment.refundDetails.amount,
          refundId: payment.refundDetails.refundId,
          processedAt: payment.refundDetails.processedAt
        }
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Refund processing failed:', error);
      
      const statusCode = error.message.includes('not found') ? 404 :
                         error.message.includes('cannot exceed') ? 400 :
                         error.message.includes('only refund') ? 400 : 500;
      
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Refund processing failed'
      });
    }
  }
  
  /**
   * Get professional commission dues
   */
  async getCommissionDues(req, res) {
    try {
      if (req.userRole !== 'professional') {
        return res.status(403).json({
          success: false,
          message: 'Only professionals can view commission dues'
        });
      }
      
      const dues = await Payment.find({
        professional: req.user._id,
        paymentMethod: 'cash',
        commissionStatus: 'pending',
        status: 'completed'
      }).select('totalAmount platformCommission commissionDueDate booking createdAt');
      
      const totalDue = dues.reduce((sum, payment) => sum + payment.platformCommission, 0);
      
      res.json({
        success: true,
        data: {
          totalCommissionDue: totalDue,
          pendingPayments: dues.length,
          dues: dues
        }
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Get commission dues failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get commission dues'
      });
    }
  }
  
  /**
   * Pay commission (Professional)
   */
  async payCommission(req, res) {
    try {
      if (req.userRole !== 'professional') {
        return res.status(403).json({
          success: false,
          message: 'Only professionals can pay commission'
        });
      }
      
      const { paymentIds, totalAmount } = req.body;
      
      if (!paymentIds || !Array.isArray(paymentIds)) {
        return res.status(400).json({
          success: false,
          message: 'Payment IDs array is required'
        });
      }
      
      // Update commission status for selected payments
      const result = await Payment.updateMany(
        {
          _id: { $in: paymentIds },
          professional: req.user._id,
          commissionStatus: 'pending'
        },
        {
          commissionStatus: 'collected',
          commissionCollectedAt: new Date()
        }
      );
      
      res.json({
        success: true,
        message: 'Commission payment recorded successfully',
        data: {
          paymentsUpdated: result.modifiedCount,
          totalAmount
        }
      });
      
    } catch (error) {
      console.error('❌ [PAYMENT-API] Commission payment failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to record commission payment'
      });
    }
  }
}

module.exports = new PaymentController();