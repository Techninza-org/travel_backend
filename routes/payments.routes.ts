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
    .get('/hotel/booking/:bookingId/status', middleware.AuthMiddleware, paymentsController.getBookingStatus);

// Webhook route (no auth middleware, uses raw body)
// paymentsRouter.post('/hotel/webhook', express.raw({ type: '*/*' }), paymentsController.hotelPaymentWebhook);

export default paymentsRouter;
