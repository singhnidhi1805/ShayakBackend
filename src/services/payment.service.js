// services/payment.service.js
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/payment.model');
const Booking = require('../models/booking.model');
const Professional = require('../models/professional.model');
const User = require('../models/user.model');
const logger = require('../config/logger');

class PaymentService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  /**
   * Initiate payment request after service completion
   */
  async initiatePayment(bookingId, paymentData) {
    console.log('🏦 [PAYMENT-SERVICE] Initiating payment for booking:', bookingId);
    
    try {
      const { serviceAmount, additionalCharges = [], paymentMethod } = paymentData;
      
      // Get booking details
      const booking = await Booking.findById(bookingId)
        .populate('user', 'name email phone')
        .populate('professional', 'name phone')
        .populate('service', 'name category pricing');
      
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.status !== 'completed') {
        throw new Error('Service must be completed before payment');
      }
      
      // Check if payment already exists
      const existingPayment = await Payment.findOne({ 
        booking: bookingId,
        status: { $in: ['completed', 'processing'] }
      });
      
      if (existingPayment) {
        throw new Error('Payment already processed for this booking');
      }
      
      // Calculate amounts
      const additionalAmount = additionalCharges.reduce((sum, charge) => sum + charge.amount, 0);
      const totalAmount = serviceAmount + additionalAmount;
      const platformCommission = totalAmount * 0.15;
      const professionalPayout = totalAmount - platformCommission;
      
      console.log('💰 [PAYMENT-SERVICE] Payment breakdown:', {
        serviceAmount,
        additionalAmount,
        totalAmount,
        platformCommission,
        professionalPayout
      });
      
      // Create payment record
      const payment = new Payment({
        booking: bookingId,
        professional: booking.professional._id,
        user: booking.user._id,
        serviceAmount,
        additionalAmount,
        totalAmount,
        platformCommission,
        professionalPayout,
        paymentMethod,
        paymentType: this.getPaymentType(paymentMethod),
        additionalCharges: additionalCharges.map(charge => ({
          ...charge,
          addedBy: booking.professional._id,
          addedAt: new Date()
        }))
      });
      
      await payment.save();
      
      // Create payment order based on method
      let paymentOrder = null;
      
      if (paymentMethod === 'online') {
        paymentOrder = await this.createRazorpayOrder(payment);
      } else if (paymentMethod === 'upi') {
        paymentOrder = await this.createUPIPaymentRequest(payment);
      } else if (paymentMethod === 'cash') {
        paymentOrder = await this.processCashPayment(payment);
      }
      
      console.log('✅ [PAYMENT-SERVICE] Payment initiated successfully');
      
      return {
        payment,
        paymentOrder,
        breakdown: {
          serviceAmount,
          additionalAmount,
          totalAmount,
          platformCommission: Math.round(platformCommission * 100) / 100,
          professionalPayout: Math.round(professionalPayout * 100) / 100
        }
      };
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Payment initiation failed:', error);
      throw error;
    }
  }
  
  /**
   * Create Razorpay order for online payment
   */
  async createRazorpayOrder(payment) {
    try {
      const order = await this.razorpay.orders.create({
        amount: Math.round(payment.totalAmount * 100), // Convert to paise
        currency: 'INR',
        receipt: `booking_${payment.booking}`,
        payment_capture: 1,
        notes: {
          booking_id: payment.booking.toString(),
          payment_id: payment._id.toString(),
          service_type: 'home_service'
        }
      });
      
      // Update payment with Razorpay order ID
      payment.razorpayOrderId = order.id;
      payment.status = 'processing';
      await payment.save();
      
      console.log('🔗 [PAYMENT-SERVICE] Razorpay order created:', order.id);
      
      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID
      };
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Razorpay order creation failed:', error);
      throw error;
    }
  }
  
  /**
   * Verify Razorpay payment
   */
  async verifyRazorpayPayment(paymentDetails) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentDetails;
      
      console.log('🔍 [PAYMENT-SERVICE] Verifying Razorpay payment:', razorpay_payment_id);
      
      // Find payment by order ID
      const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
      
      if (!payment) {
        throw new Error('Payment record not found');
      }
      
      // Verify signature
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      
      if (generatedSignature !== razorpay_signature) {
        // Record failed attempt
        payment.paymentAttempts.push({
          attemptedAt: new Date(),
          method: 'razorpay',
          status: 'failed',
          errorMessage: 'Invalid payment signature'
        });
        await payment.save();
        
        throw new Error('Invalid payment signature');
      }
      
      // Mark payment as completed
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.status = 'completed';
      payment.completedAt = new Date();
      
      await payment.save();
      
      // Update booking payment status
      await Booking.findByIdAndUpdate(payment.booking, {
        paymentStatus: 'paid'
      });
      
      console.log('✅ [PAYMENT-SERVICE] Payment verified and completed');
      
      // Process professional payout (in real app, this would be queued)
      setTimeout(() => {
        this.processProfessionalPayout(payment._id);
      }, 1000);
      
      return payment;
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Payment verification failed:', error);
      throw error;
    }
  }
  
  /**
   * Create UPI payment request
   */
  async createUPIPaymentRequest(payment) {
    try {
      // In a real implementation, you would integrate with UPI payment providers
      // For now, we'll create a UPI deep link
      
      const upiId = process.env.BUSINESS_UPI_ID || 'business@paytm';
      const amount = payment.totalAmount;
      const transactionNote = `Payment for Booking ${payment.booking}`;
      
      // Generate UPI deep link
      const upiLink = `upi://pay?pa=${upiId}&pn=YourBusinessName&tr=${payment._id}&am=${amount}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
      
      payment.status = 'processing';
      await payment.save();
      
      console.log('📱 [PAYMENT-SERVICE] UPI payment request created');
      
      return {
        upiLink,
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(upiLink)}`,
        amount: payment.totalAmount,
        businessUPI: upiId,
        transactionRef: payment._id.toString()
      };
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] UPI payment request failed:', error);
      throw error;
    }
  }
  
  /**
   * Process cash payment
   */
  async processCashPayment(payment) {
    try {
      // Mark as completed immediately for cash
      payment.cashCollected = true;
      payment.cashCollectedAt = new Date();
      payment.status = 'completed';
      payment.completedAt = new Date();
      payment.commissionStatus = 'pending';
      
      await payment.save();
      
      // Update booking payment status
      await Booking.findByIdAndUpdate(payment.booking, {
        paymentStatus: 'paid'
      });
      
      console.log('💵 [PAYMENT-SERVICE] Cash payment processed');
      
      // Schedule commission collection reminder
      setTimeout(() => {
        this.scheduleCommissionCollection(payment._id);
      }, 1000);
      
      return {
        cashAmount: payment.totalAmount,
        commissionDue: payment.platformCommission,
        commissionDueDate: payment.commissionDueDate,
        message: 'Cash payment completed. Professional needs to pay platform commission.'
      };
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Cash payment processing failed:', error);
      throw error;
    }
  }
  
  /**
   * Verify UPI payment manually
   */
  async verifyUPIPayment(paymentId, upiTransactionId) {
    try {
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        throw new Error('Payment not found');
      }
      
      if (payment.paymentMethod !== 'upi') {
        throw new Error('Invalid payment method');
      }
      
      // In a real implementation, you would verify the transaction with the UPI provider
      // For now, we'll mark it as completed
      
      payment.upiTransactionId = upiTransactionId;
      payment.status = 'completed';
      payment.completedAt = new Date();
      
      await payment.save();
      
      // Update booking payment status
      await Booking.findByIdAndUpdate(payment.booking, {
        paymentStatus: 'paid'
      });
      
      console.log('✅ [PAYMENT-SERVICE] UPI payment verified');
      
      return payment;
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] UPI payment verification failed:', error);
      throw error;
    }
  }
  
  /**
   * Add additional charges before payment
   */
  async addAdditionalCharges(bookingId, charges, professionalId) {
    try {
      console.log('➕ [PAYMENT-SERVICE] Adding additional charges to booking:', bookingId);
      
      // Validate charges
      if (!Array.isArray(charges) || charges.length === 0) {
        throw new Error('Invalid charges data');
      }
      
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }
      
      if (booking.professional.toString() !== professionalId.toString()) {
        throw new Error('Only assigned professional can add charges');
      }
      
      // Check if payment already exists
      let payment = await Payment.findOne({ booking: bookingId });
      
      if (payment && payment.status === 'completed') {
        throw new Error('Cannot add charges after payment completion');
      }
      
      // Validate charge amounts
      for (const charge of charges) {
        if (!charge.description || !charge.amount || charge.amount <= 0) {
          throw new Error('Invalid charge: description and positive amount required');
        }
      }
      
      const totalAdditionalAmount = charges.reduce((sum, charge) => sum + charge.amount, 0);
      
      console.log('💰 [PAYMENT-SERVICE] Additional charges total:', totalAdditionalAmount);
      
      return {
        charges,
        totalAdditionalAmount,
        message: 'Additional charges added successfully'
      };
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Adding charges failed:', error);
      throw error;
    }
  }
  
  /**
   * Process professional payout (after platform commission deduction)
   */
  async processProfessionalPayout(paymentId) {
    try {
      const payment = await Payment.findById(paymentId).populate('professional', 'name employeeId');
      
      if (!payment) {
        console.error('Payment not found for payout:', paymentId);
        return;
      }
      
      if (payment.paymentMethod === 'cash' && payment.commissionStatus !== 'collected') {
        console.log('⏳ [PAYMENT-SERVICE] Waiting for commission collection for cash payment');
        return;
      }
      
      // In a real implementation, you would:
      // 1. Transfer money to professional's account
      // 2. Create transaction record
      // 3. Send notification
      
      console.log('💰 [PAYMENT-SERVICE] Processing payout:', {
        professional: payment.professional.name,
        amount: payment.professionalPayout,
        paymentMethod: payment.paymentMethod
      });
      
      // This would typically integrate with a payment gateway for payouts
      // For now, we'll just log it
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Payout processing failed:', error);
    }
  }
  
  /**
   * Schedule commission collection for cash payments
   */
  async scheduleCommissionCollection(paymentId) {
    try {
      const payment = await Payment.findById(paymentId).populate('professional', 'name phone');
      
      if (!payment) {
        return;
      }
      
      // Send reminder to professional about commission due
      console.log('📅 [PAYMENT-SERVICE] Commission collection scheduled for:', {
        professional: payment.professional.name,
        amount: payment.platformCommission,
        dueDate: payment.commissionDueDate
      });
      
      // In a real app, you would:
      // 1. Send notification to professional
      // 2. Add to admin dashboard for tracking
      // 3. Set up automated reminders
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Commission scheduling failed:', error);
    }
  }
  
  /**
   * Get payment type from method
   */
  getPaymentType(method) {
    switch (method) {
      case 'online': return 'razorpay';
      case 'upi': return 'upi_direct';
      case 'cash': return 'cash_on_delivery';
      default: return 'razorpay';
    }
  }
  
  /**
   * Process refund
   */
  async processRefund(paymentId, refundAmount, reason) {
    try {
      const payment = await Payment.findById(paymentId);
      
      if (!payment) {
        throw new Error('Payment not found');
      }
      
      if (payment.status !== 'completed') {
        throw new Error('Can only refund completed payments');
      }
      
      if (refundAmount > payment.totalAmount) {
        throw new Error('Refund amount cannot exceed payment amount');
      }
      
      let refundResult = null;
      
      if (payment.paymentMethod === 'online' && payment.razorpayPaymentId) {
        // Process Razorpay refund
        refundResult = await this.razorpay.payments.refund(payment.razorpayPaymentId, {
          amount: Math.round(refundAmount * 100),
          notes: { reason }
        });
      }
      
      // Update payment record
      payment.refundDetails = {
        amount: refundAmount,
        reason,
        processedAt: new Date(),
        refundId: refundResult?.id || `REFUND_${Date.now()}`
      };
      payment.status = 'refunded';
      
      await payment.save();
      
      console.log('↩️ [PAYMENT-SERVICE] Refund processed:', refundAmount);
      
      return payment;
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Refund processing failed:', error);
      throw error;
    }
  }
  
  /**
   * Get payment summary for a booking
   */
  async getPaymentSummary(bookingId) {
    try {
      const payment = await Payment.findOne({ booking: bookingId })
        .populate('booking', 'service scheduledDate')
        .populate('professional', 'name phone')
        .populate('user', 'name phone');
      
      if (!payment) {
        return null;
      }
      
      return {
        paymentId: payment._id,
        totalAmount: payment.totalAmount,
        serviceAmount: payment.serviceAmount,
        additionalAmount: payment.additionalAmount,
        platformCommission: payment.platformCommission,
        professionalPayout: payment.professionalPayout,
        paymentMethod: payment.paymentMethod,
        status: payment.status,
        completedAt: payment.completedAt,
        additionalCharges: payment.additionalCharges,
        invoice: payment.invoice
      };
      
    } catch (error) {
      console.error('❌ [PAYMENT-SERVICE] Getting payment summary failed:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();