import { Router } from 'express';
import express from 'express';
import paymentsController from '../controller/payments.controller';
import middleware from '../utils/middleware';

const paymentsRouter = Router();

// Hotel booking payment routes
paymentsRouter
    //@ts-ignore
    .post('/hotel/create-order', middleware.AuthMiddleware, paymentsController.createHotelOrder)
    //@ts-ignore
    .post('/hotel/verify', middleware.AuthMiddleware, paymentsController.verifyHotelCheckout)
    //@ts-ignore
    .post('/hotel/verify-payment', middleware.AuthMiddleware, paymentsController.verifyHotelPayment)
    //@ts-ignore
    .post('/hotel/confirm-booking', middleware.AuthMiddleware, paymentsController.confirmHotelBooking)
    //@ts-ignore
    .get('/hotel/booking/:bookingId/status', middleware.AuthMiddleware, paymentsController.getBookingStatus)
    //@ts-ignore
    .post('/flight/create-order', middleware.AuthMiddleware, paymentsController.createFlightOrder)
    //@ts-ignore
    .post('/flight/verify-payment', middleware.AuthMiddleware, paymentsController.verifyFlightPayment)
    //@ts-ignore
    .post('/flight/confirm-booking', middleware.AuthMiddleware, paymentsController.confirmFlightBooking)
     //@ts-ignore
     .post('/bus/create-order', middleware.AuthMiddleware, paymentsController.createBusOrder)
     //@ts-ignore
     .post('/bus/verify-payment', middleware.AuthMiddleware, paymentsController.verifyBusPayment)
     //@ts-ignore
     .post('/bus/confirm-booking', middleware.AuthMiddleware, paymentsController.confirmBusBooking)

// Webhook route (no auth middleware, uses raw body)
// paymentsRouter.post('/hotel/webhook', express.raw({ type: '*/*' }), paymentsController.hotelPaymentWebhook);

export default paymentsRouter;
