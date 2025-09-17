import type { Response, NextFunction } from 'express';
import { ExtendedRequest } from '../utils/middleware';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.KEY_ID!,
  key_secret: process.env.KEY_SECRET!,
});

// Helper function to confirm vendor booking with EMT
async function confirmVendorBooking(vendorPayload: any): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    console.log('Confirming vendor booking with payload', vendorPayload);
    
    const resp = await axios.post('http://hotelapita.easemytrip.com/MiHotel.svc/HotelBooking', vendorPayload, {
      headers: { 'Content-Type': 'application/json' },
    });
    console.log('EMT booking response status', resp.status, resp);
    
    const data = resp.data;
    console.log('EMT booking response', data);
    
    const isOk = data?.reservationStatusCode === 'CF'
    console.log('Vendor booking success status', isOk);
    
    return isOk ? { ok: true, data } : { ok: false, error: JSON.stringify(data) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Vendor error' };
  }
}

// Helper function to refund payment
async function refundPayment(paymentId: string, speedNote?: string) {
  try {
    const refund = await razorpay.payments.refund(paymentId, {
      notes: speedNote ? { reason: speedNote } : undefined,
    });
    return refund;
  } catch (e) {
    console.error('refundPayment error', e);
    return null;
  }
}

// Create Razorpay order for hotel booking
export const createHotelOrder = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const { amount, currency = 'INR', notes } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!amount) {
      return res.status(400).json({ message: 'Missing required field: amount' });
    }

    // 1) Create RZP order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `hotel_booking_${Date.now()}`, // Use timestamp for unique receipt
      notes: { userId: String(userId), type: 'HOTEL' },
      payment_capture: true, // auto-capture
    });

    return res.status(200).json({
      message: 'Order created',
      data: {
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        key_id: process.env.KEY_ID,
        receipt: order.receipt,
      },
    });
  } catch (err) {
    console.error('createHotelOrder error', err);
    return next(err);
  }
};

export const verifyHotelCheckout = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      bookingId,
      amount,      // <-- send amount (paise) from client if needed for validation
    } = req.body;
    console.log('received verifyHotelCheckout', req.body);
    

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    /** 1️⃣  Verify Razorpay signature */
    const hmac = crypto.createHmac('sha256', process.env.KEY_SECRET!);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expected = hmac.digest('hex');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpay_signature)
    );
    if (!isValid) {
      return res.status(400).json({ message: 'Signature mismatch' });
    }

    /** 2️⃣  Transaction: update booking, confirm vendor, save payment */
    await prisma.$transaction(async (tx) => {
      const booking = await tx.hotelBooking.findUnique({
        where: { id: Number(bookingId), userId },
      });
      console.log('Booking found for verification', booking);
      
      if (!booking) throw new Error('Booking not found');

      if (booking.status === 'CONFIRMED') return; // already done

      // Validate order & amount if available
      if (booking.rzpOrderId && booking.rzpOrderId !== razorpay_order_id) {
        throw new Error('OrderId mismatch');
      }
      if (amount && booking.amount !== amount) {
        console.log('Amount mismatch detected', { bookingAmount: booking.amount, receivedAmount: amount });
        
        // Optional: refund & abort
        await refundPayment(
          razorpay_payment_id,
          `Amount mismatch. Booking:${booking.amount}, Paid:${amount}`
        );
        await tx.hotelBooking.update({
          where: { id: booking.id },
          data: { status: 'FAILED_REFUNDED' },
        });
        console.log('Amount mismatch, refunded payment', razorpay_payment_id);
        
        return;
      }

      // Put booking in PENDING_WEBHOOK-equivalent state
      await tx.hotelBooking.update({
        where: { id: booking.id },
        data: {
          rzpPaymentId: razorpay_payment_id,
          rzpOrderId: razorpay_order_id,
          status: 'PENDING_WEBHOOK', 
        },
      });
      console.log('Booking moved to PENDING WEBHOOK state');

      /** Call EMT to finalize */
      const emtResp = await confirmVendorBooking(booking.vendorPayload);

      if (emtResp.ok) {
        console.log('Vendor booking confirmed', emtResp.data);
        await tx.hotelBooking.update({
          where: { id: booking.id },
          data: {
            status: 'CONFIRMED',
            vendorResponse: emtResp.data,
            vendorPnr:
              emtResp.data?.PNR || emtResp.data?.ConfirmationNo || null,
            vendorBookingId: emtResp.data?.BookingId || null,
          },
        });

        await tx.payment.create({
          data: {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            userId,
            status: 'CAPTURED',
            amount: booking.amount,
            currency: 'INR',
            bookingId: booking.id,
            payload: {},
          },
        });
      } else {
        const reason = emtResp.error || 'Vendor booking failed';
        const refund = await refundPayment(razorpay_payment_id, reason);
        console.log('Vendor booking failed, refunded payment', reason, refund);

        await tx.hotelBooking.update({
          where: { id: booking.id },
          data: {
            status: 'FAILED_REFUNDED',
            rzpRefundId: refund?.id || null,
            notes: reason,
          },
        });

        await tx.payment.create({
          data: {
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            userId,
            status: 'REFUNDED',
            amount: booking.amount,
            currency: 'INR',
            bookingId: booking.id,
            payload: {},
          },
        });
      }
    });

    return res
      .status(200)
      .json({ message: 'Payment verified and booking processed.' });
  } catch (err) {
    console.error('verifyHotelCheckout error', err);
    return next(err);
  }
};

// // Verify Checkout payload (fast ack, not final)
// export const verifyHotelCheckout = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
//   try {
//     const {
//       razorpay_payment_id,
//       razorpay_order_id,
//       razorpay_signature,
//       bookingId,
//     } = req.body;

//     const userId = req.user?.id;

//     if (!userId) {
//       return res.status(401).json({ message: 'User not authenticated' });
//     }

//     // 1) Signature check (order|payment) using KEY_SECRET
//     const hmac = crypto.createHmac('sha256', process.env.KEY_SECRET!);
//     hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
//     const expected = hmac.digest('hex');

//     const isValid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
//     if (!isValid) {
//       return res.status(400).json({ message: 'Signature mismatch' });
//     }

//     // 2) Move booking to PENDING_WEBHOOK, store paymentId
//     await prisma.hotelBooking.update({
//       where: { id: Number(bookingId), userId: userId },
//       data: { rzpPaymentId: razorpay_payment_id, status: 'PENDING_WEBHOOK' },
//     });

//     // Optional: store a payment row for idempotency
//     await prisma.payment.create({
//       data: {
//         paymentId: razorpay_payment_id,
//         orderId: razorpay_order_id,
//         userId: userId,
//         status: 'CREATED',
//         amount: 0,
//         currency: 'INR',
//         bookingId: Number(bookingId),
//         payload: {},
//       },
//     });

//     return res.status(200).json({ message: 'Payment received. Awaiting confirmation.' });
//   } catch (err) {
//     console.error('verifyHotelCheckout error', err);
//     return next(err);
//   }
// };

// // Webhook: verify + finalize with EMT (source of truth)
// export const hotelPaymentWebhook = async (req: any, res: Response) => {
//   try {
//     const webhookSignature = req.headers['x-razorpay-signature'] as string;
//     if (!webhookSignature) return res.status(400).send('Missing signature');

//     const rawBody = req.body as Buffer;

//     const hmac = crypto.createHmac('sha256', process.env.RZP_WEBHOOK_SECRET!);
//     hmac.update(rawBody);
//     const digest = hmac.digest('hex');
//     if (digest !== webhookSignature) return res.status(400).send('Invalid webhook signature');

//     const event = JSON.parse(rawBody.toString());
//     const ev = event.event;

//     if (ev === 'payment.captured' || ev === 'order.paid') {
//       const payment = event.payload.payment?.entity;
//       const order = event.payload.order?.entity;

//       const rzpPaymentId = payment?.id;
//       const rzpOrderId = payment?.order_id || order?.id;
//       const amount = payment?.amount || order?.amount; // paise
//       const currency = payment?.currency || order?.currency || 'INR';
//       const bookingIdStr = order?.notes?.bookingId || payment?.notes?.bookingId;
//       const bookingId = Number(bookingIdStr);

//       if (!bookingId || !rzpPaymentId || !rzpOrderId) {
//         return res.status(200).send('ignored');
//       }

//       // idempotency + transactional updates
//       await prisma.$transaction(async (tx) => {
//         const booking = await tx.hotelBooking.findUnique({ where: { id: bookingId } });
//         if (!booking) return;

//         // If already confirmed, just ack
//         if (booking.status === 'CONFIRMED') return;

//         // Defensive: order match & amount match
//         if (booking.rzpOrderId && booking.rzpOrderId !== rzpOrderId) {
//           return; // log mismatch
//         }
//         if (booking.amount !== amount) {
//           // Optional: handle mismatch (refund or flag)
//           // For safety, prefer refund
//           await refundPayment(rzpPaymentId, `Amount mismatch. Booking: ${booking.amount}, Paid: ${amount}`);
//           await tx.hotelBooking.update({
//             where: { id: bookingId },
//             data: { status: 'FAILED_REFUNDED' },
//           });
//           return;
//         }

//         // Call EMT booking *now*
//         const emtResp = await confirmVendorBooking(booking.vendorPayload);

//         if (emtResp.ok) {
//           await tx.hotelBooking.update({
//             where: { id: bookingId },
//             data: {
//               status: 'CONFIRMED',
//               vendorResponse: emtResp.data,
//               vendorPnr: emtResp.data?.PNR || emtResp.data?.ConfirmationNo || null,
//               vendorBookingId: emtResp.data?.BookingId || null,
//               rzpPaymentId,
//             },
//           });

//           // Optional: mark payment captured
//           await tx.payment.create({
//             data: {
//               paymentId: rzpPaymentId,
//               orderId: rzpOrderId,
//               userId: booking.userId,
//               status: 'CAPTURED',
//               amount,
//               currency,
//               bookingId,
//               payload: payment,
//             },
//           });
//         } else {
//           // Vendor failure → immediate refund
//           const reason = emtResp.error || 'Vendor booking failed';
//           const refund = await refundPayment(rzpPaymentId, reason);

//           await tx.hotelBooking.update({
//             where: { id: bookingId },
//             data: {
//               status: 'FAILED_REFUNDED',
//               rzpRefundId: refund?.id || null,
//               notes: reason,
//             },
//           });

//           await tx.payment.create({
//             data: {
//               paymentId: rzpPaymentId,
//               orderId: rzpOrderId,
//               userId: booking.userId,
//               status: 'REFUNDED',
//               amount,
//               currency,
//               bookingId,
//               payload: payment,
//             },
//           });
//         }
//       });
//     }

//     return res.status(200).send('ok');
//   } catch (err) {
//     console.error('hotelPaymentWebhook error', err);
//     return res.status(200).send('ok'); // Always 200 to avoid repeated retries storms unless you want retries
//   }
// };


// Get booking status
export const getBookingStatus = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const booking = await prisma.hotelBooking.findUnique({
      where: { id: Number(bookingId), userId: userId },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        vendorPnr: true,
        vendorBookingId: true,
        rzpOrderId: true,
        rzpPaymentId: true,
        rzpRefundId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      }
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    return res.status(200).json({
      message: 'Booking status retrieved',
      data: booking
    });
  } catch (err) {
    console.error('getBookingStatus error', err);
    return next(err);
  }
};

// Step 1: Create Razorpay order and verify payment
export const verifyHotelPayment = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      amount,
      currency = 'INR',
      notes
    } = req.body;
    
    console.log('received verifyHotelPayment', req.body);
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !amount) {
      return res.status(400).json({ 
        message: 'Missing required fields: razorpay_payment_id, razorpay_order_id, razorpay_signature, amount' 
      });
    }

    /** 1️⃣  Verify Razorpay signature */
    const hmac = crypto.createHmac('sha256', process.env.KEY_SECRET!);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const expected = hmac.digest('hex');
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(razorpay_signature)
    );
    if (!isValid) {
      return res.status(400).json({ message: 'Signature mismatch' });
    }

    /** 2️⃣  Get payment details from Razorpay to extract transaction ID */
    let paymentDetails;
    try {
      paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
      console.log('Razorpay payment details:', paymentDetails);
    } catch (error) {
      console.error('Error fetching payment details from Razorpay:', error);
      return res.status(400).json({ message: 'Failed to fetch payment details from Razorpay' });
    }

    /** 3️⃣  Create booking record and store payment (fast response) */
    const result = await prisma.$transaction(async (tx) => {
      // Create booking record with ORDER_CREATED status (payment verified, order created)
      const booking = await tx.hotelBooking.create({
        data: {
          userId,
          status: 'ORDER_CREATED', // Payment verified and order created
          amount: Math.round(amount * 100), // Convert to paise
          currency,
          vendorPayload: {}, // Empty for now, will be filled in confirmHotelBooking
          notes,
          vendorResponse: {},
          rzpPaymentId: razorpay_payment_id,
          rzpOrderId: razorpay_order_id,
        },
      });
      console.log('Booking created with payment verified and order created', booking);

      // Store payment record
      await tx.payment.create({
        data: {
          paymentId: razorpay_payment_id,
          orderId: razorpay_order_id,
          userId,
          status: 'CAPTURED',
          amount: booking.amount,
          currency: 'INR',
          bookingId: booking.id,
          payload: paymentDetails as any, // Type assertion for Razorpay payment object
        },
      });

      return {
        bookingId: booking.id,
        status: 'ORDER_CREATED',
        amount: booking.amount,
        currency: booking.currency,
        transactionId: paymentDetails.id, // Return transaction ID for client
        paymentDetails: {
          id: paymentDetails.id,
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          status: paymentDetails.status,
          method: paymentDetails.method,
          created_at: paymentDetails.created_at,
        },
      };
    });

    return res.status(200).json({
      message: 'Payment verified successfully. Order created.',
      data: result,
    });
  } catch (err) {
    console.error('verifyHotelPayment error', err);
    return next(err);
  }
};

// Step 2: Vendor booking confirmation API
export const confirmHotelBooking = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { bookingId, vendorPayload } = req.body;
    const userId = req.user?.id;
    
    console.log('received confirmHotelBooking', req.body);
    
    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    if (!bookingId || !vendorPayload) {
      return res.status(400).json({ message: 'Missing required fields: bookingId, vendorPayload' });
    }

    /** 1️⃣  Find booking and validate status */
    const booking = await prisma.hotelBooking.findUnique({
      where: { id: Number(bookingId), userId },
    });

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (booking.status !== 'ORDER_CREATED') {
      return res.status(400).json({ 
        message: `Invalid booking status: ${booking.status}. Expected: ORDER_CREATED` 
      });
    }

    /** 2️⃣  Call vendor and update booking status */
    const result = await prisma.$transaction(async (tx) => {
      // Update vendorPayload and move to PENDING_WEBHOOK (processing vendor)
      await tx.hotelBooking.update({
        where: { id: booking.id },
        data: { 
          status: 'PENDING_WEBHOOK',
          vendorPayload: vendorPayload
        },
      });

      /** Call EMT to finalize */
      const emtResp = await confirmVendorBooking(vendorPayload);

      if (emtResp.ok) {
        console.log('Vendor booking confirmed', emtResp.data);
        await tx.hotelBooking.update({
          where: { id: booking.id },
          data: {
            status: 'CONFIRMED',
            vendorResponse: emtResp.data,
            vendorPnr:
              emtResp.data?.PNR || emtResp.data?.ConfirmationNo || null,
            vendorBookingId: emtResp.data?.BookingId || null,
          },
        });

        return {
          success: true,
          bookingId: booking.id,
          status: 'CONFIRMED',
          vendorPnr: emtResp.data?.PNR || emtResp.data?.ConfirmationNo || null,
          vendorBookingId: emtResp.data?.BookingId || null,
        };
      } else {
        const reason = emtResp.error || 'Vendor booking failed';
        const refund = await refundPayment(booking.rzpPaymentId!, reason);
        console.log('Vendor booking failed, refunded payment', reason, refund);

        await tx.hotelBooking.update({
          where: { id: booking.id },
          data: {
            status: 'FAILED_REFUNDED',
            rzpRefundId: refund?.id || null,
            notes: reason,
          },
        });

        // Update payment status to refunded
        await tx.payment.updateMany({
          where: { 
            paymentId: booking.rzpPaymentId!,
            bookingId: booking.id 
          },
          data: { status: 'REFUNDED' },
        });

        return {
          success: false,
          bookingId: booking.id,
          status: 'FAILED_REFUNDED',
          reason,
          refundId: refund?.id || null,
        };
      }
    });

    if (result.success) {
      return res.status(200).json({
        message: 'Hotel booking confirmed successfully',
        data: {
          bookingId: result.bookingId,
          status: result.status,
          vendorPnr: result.vendorPnr,
          vendorBookingId: result.vendorBookingId,
        },
      });
    } else {
      return res.status(400).json({
        message: 'Hotel booking failed and payment refunded',
        data: {
          bookingId: result.bookingId,
          status: result.status,
          reason: result.reason,
          refundId: result.refundId,
        },
      });
    }
  } catch (err) {
    console.error('confirmHotelBooking error', err);
    return next(err);
  }
};

export const paymentsController = {
  createHotelOrder,
  verifyHotelCheckout,
  verifyHotelPayment,
  confirmHotelBooking,
  // hotelPaymentWebhook,
  getBookingStatus,
};

export default paymentsController;
