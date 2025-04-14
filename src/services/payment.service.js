const Razorpay = require('razorpay');
const crypto = require('crypto');

class PaymentService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  async createPaymentOrder(booking) {
    try {
      const order = await this.razorpay.orders.create({
        amount: booking.totalAmount * 100, // Convert to smallest currency unit
        currency: 'INR',
        receipt: `booking_${booking._id}`,
        payment_capture: 1,
        notes: {
          bookingId: booking._id.toString(),
          serviceName: booking.service.name,
          customerEmail: booking.user.email
        }
      });

      const payment = new Payment({
        booking: booking._id,
        amount: booking.totalAmount,
        transactionId: order.id,
        status: 'pending'
      });
      await payment.save();

      return { order, payment };
    } catch (error) {
      logger.error('Payment order creation failed:', error);
      throw error;
    }
  }

  async verifyPayment(paymentId, orderId, signature) {
    try {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      if (generatedSignature !== signature) {
        throw new Error('Invalid payment signature');
      }

      const payment = await Payment.findOneAndUpdate(
        { transactionId: orderId },
        {
          status: 'completed',
          paymentGatewayResponse: { paymentId, signature }
        },
        { new: true }
      );

      if (!payment) throw new Error('Payment not found');

      // Update booking status
      await Booking.findByIdAndUpdate(payment.booking, {
        status: 'confirmed',
        paymentStatus: 'paid'
      });

      return payment;
    } catch (error) {
      logger.error('Payment verification failed:', error);
      throw error;
    }
  }

  async processRefund(bookingId, amount, reason) {
    try {
      const payment = await Payment.findOne({ booking: bookingId });
      if (!payment) throw new Error('Payment not found');

      const refund = await this.razorpay.refunds.create({
        payment_id: payment.paymentGatewayResponse.paymentId,
        amount: amount * 100,
        notes: {
          reason,
          bookingId
        }
      });

      payment.refundDetails = {
        amount,
        reason,
        transactionId: refund.id,
        processedAt: new Date()
      };
      payment.status = 'refunded';
      await payment.save();

      return refund;
    } catch (error) {
      logger.error('Refund processing failed:', error);
      throw error;
    }
  }
}