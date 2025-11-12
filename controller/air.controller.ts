import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'
import dotenv from 'dotenv'
import { PrismaClient } from '@prisma/client'
dotenv.config()

const prisma = new PrismaClient()

const searchFlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const requestId = Date.now().toString();
    const userId = req.user?.id;

    console.log(`[${requestId}] FLIGHT SEARCH START - User: ${userId || 'Anonymous'}`);
    console.log(`[${requestId}] FLIGHT SEARCH REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    try{
        const body = req.body
        console.log(`[${requestId}] FLIGHT SEARCH - Making API call to EMT FlightSearch`);

        const startTime = Date.now();
        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/FlightSearch', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const endTime = Date.now();

        console.log(`[${requestId}] FLIGHT SEARCH - API call completed in ${endTime - startTime}ms`);
        console.log(`[${requestId}] FLIGHT SEARCH - Response status: ${response.status}`);

        const data = response.data
        console.log(`[${requestId}] FLIGHT SEARCH SUCCESS - Found ${data?.FlightData?.length || 0} flight options`);

        return res.status(200).json({
            data
        })
    }catch(err: any){
        console.error(`[${requestId}] FLIGHT SEARCH ERROR:`, err?.response?.data || err?.message || err);
        console.error(`[${requestId}] FLIGHT SEARCH FAILED - User: ${req.user?.id || 'Anonymous'}`);
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getPrice = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const requestId = Date.now().toString();
    const userId = req.user?.id;

    console.log(`[${requestId}] FLIGHT PRICE CHECK START - User: ${userId || 'Anonymous'}`);
    console.log(`[${requestId}] FLIGHT PRICE CHECK REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    try{
        const body = req.body
        console.log(`[${requestId}] FLIGHT PRICE CHECK - Making API call to EMT AirRePriceRQ`);

        const startTime = Date.now();
        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirRePriceRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const endTime = Date.now();

        console.log(`[${requestId}] FLIGHT PRICE CHECK - API call completed in ${endTime - startTime}ms`);
        console.log(`[${requestId}] FLIGHT PRICE CHECK - Response status: ${response.status}`);

        const data = response.data
        console.log(`[${requestId}] FLIGHT PRICE CHECK SUCCESS - Price details retrieved`);

        return res.status(200).json({
            data
        })
    }catch(err: any){
        console.error(`[${requestId}] FLIGHT PRICE CHECK ERROR:`, err?.response?.data || err?.message || err);
        console.error(`[${requestId}] FLIGHT PRICE CHECK FAILED - User: ${req.user?.id || 'Anonymous'}`);
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const seatMap = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const requestId = Date.now().toString();
    const userId = req.user?.id;

    console.log(`[${requestId}] FLIGHT SEAT MAP START - User: ${userId || 'Anonymous'}`);
    console.log(`[${requestId}] FLIGHT SEAT MAP REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    try{
        const body = req.body
        console.log(`[${requestId}] FLIGHT SEAT MAP - Making API call to EMT AirBookRQ for seat map`);

        const startTime = Date.now();
        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirBookRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const endTime = Date.now();

        console.log(`[${requestId}] FLIGHT SEAT MAP - API call completed in ${endTime - startTime}ms`);
        console.log(`[${requestId}] FLIGHT SEAT MAP - Response status: ${response.status}`);

        const data = response.data
        console.log(`[${requestId}] FLIGHT SEAT MAP SUCCESS - Seat map data retrieved`);

        return res.status(200).json({
            data
        })
    }catch(err: any){
        console.error(`[${requestId}] FLIGHT SEAT MAP ERROR:`, err?.response?.data || err?.message || err);
        console.error(`[${requestId}] FLIGHT SEAT MAP FAILED - User: ${req.user?.id || 'Anonymous'}`);
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const bookFlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const requestId = Date.now().toString();
    const userId = req.user?.id;

    console.log(`[${requestId}] FLIGHT BOOKING START - User: ${userId || 'Anonymous'}`);
    console.log(`[${requestId}] FLIGHT BOOKING REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    try{
        const body = req.body
        console.log(`[${requestId}] FLIGHT BOOKING - Making API call to EMT AirBookRQ for booking`);

        const startTime = Date.now();
        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirBookRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const endTime = Date.now();

        console.log(`[${requestId}] FLIGHT BOOKING - API call completed in ${endTime - startTime}ms`);
        console.log(`[${requestId}] FLIGHT BOOKING - Response status: ${response.status}`);

        const data = response.data

        // Log booking details if successful
        if (data && !data.Error) {
            console.log(`[${requestId}] FLIGHT BOOKING SUCCESS - TransactionId: ${data?.TransactionId || 'N/A'}`);
            console.log(`[${requestId}] FLIGHT BOOKING SUCCESS - Booking reference: ${data?.BookingReference || 'N/A'}`);
        } else {
            console.warn(`[${requestId}] FLIGHT BOOKING WARNING - Possible error in response:`, data?.Error || 'Unknown error');
        }

        return res.status(200).json({
            data
        })
    }catch(err: any){
        console.error(`[${requestId}] FLIGHT BOOKING ERROR:`, err?.response?.data || err?.message || err);
        console.error(`[${requestId}] FLIGHT BOOKING FAILED - User: ${req.user?.id || 'Anonymous'}`);
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getBookingDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const requestId = Date.now().toString();
    const userId = req.user?.id;

    console.log(`[${requestId}] GET BOOKING DETAILS START - User: ${userId || 'Anonymous'}`);
    console.log(`[${requestId}] GET BOOKING DETAILS REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    try{
        const body = req.body
        console.log(`[${requestId}] GET BOOKING DETAILS - Making API call to EMT flightbookingdetailv1`);

        const startTime = Date.now();
        const response = await axios.post('http://stagingapi.easemytrip.com/cancellationjson/api/flightbookingdetailv1', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const endTime = Date.now();

        console.log(`[${requestId}] GET BOOKING DETAILS - API call completed in ${endTime - startTime}ms`);
        console.log(`[${requestId}] GET BOOKING DETAILS - Response status: ${response.status}`);

        const data = response.data

        // Log booking status details
        const passengerCount = data?.passengerDetails?.length || 0;
        const bookingStatus = data?.passengerDetails?.[0]?.status || 'Unknown';
        console.log(`[${requestId}] GET BOOKING DETAILS SUCCESS - ${passengerCount} passengers, Status: ${bookingStatus}`);

        if (data?.transactionScreenId) {
            console.log(`[${requestId}] GET BOOKING DETAILS SUCCESS - TransactionId: ${data.transactionScreenId}`);
        }

        return res.status(200).json({
            data
        })
    }catch(err: any){
        console.error(`[${requestId}] GET BOOKING DETAILS ERROR:`, err?.response?.data || err?.message || err);
        console.error(`[${requestId}] GET BOOKING DETAILS FAILED - User: ${req.user?.id || 'Anonymous'}`);
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getAuthKeyForCancellation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const requestId = Date.now().toString();
    const userId = req.user?.id;

    console.log(`[${requestId}] GET AUTH KEY FOR CANCELLATION START - User: ${userId || 'Anonymous'}`);
    console.log(`[${requestId}] GET AUTH KEY REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    try{
        const body = req.body;
        console.log(`[${requestId}] GET AUTH KEY - Making API call to EMT GetAuthKey`);

        const startTime = Date.now();
        const response = await axios.post('https://stagingapi.easemytrip.com/cancellationjson/api/GetAuthKey', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const endTime = Date.now();

        console.log(`[${requestId}] GET AUTH KEY - API call completed in ${endTime - startTime}ms`);
        console.log(`[${requestId}] GET AUTH KEY - Response status: ${response.status}`);

        const data = response.data

        if (data && data.AuthKey) {
            console.log(`[${requestId}] GET AUTH KEY SUCCESS - Auth key retrieved`);
        } else {
            console.warn(`[${requestId}] GET AUTH KEY WARNING - No auth key in response`);
        }

        return res.status(200).json({
            data
        })
    }catch(err: any){
        console.error(`[${requestId}] GET AUTH KEY ERROR:`, err?.response?.data || err?.message || err);
        console.error(`[${requestId}] GET AUTH KEY FAILED - User: ${req.user?.id || 'Anonymous'}`);
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

// const getFlightBookingDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
//     try{
//         const body = req.body;
//         const response = await axios.post('http://stagingapi.easemytrip.com/cancellationjson/api/flightbookingdetailv1', body, {
//             headers: {
//                 'Content-Type': 'application/json',
//             },
//         })
//         const data = response.data
//         return res.status(200).json({
//             data
//         })
//     }catch(err){
//         console.log(err);
//     }
// }

const cancelFlightBooking = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const requestId = Date.now().toString();
    const userId = req.user?.id;

    console.log(`[${requestId}] FLIGHT CANCELLATION START - User: ${userId || 'Anonymous'}`);
    console.log(`[${requestId}] FLIGHT CANCELLATION REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    try{
        const body = req.body;
        console.log(`[${requestId}] FLIGHT CANCELLATION - Making API call to EMT cancelv1`);

        const startTime = Date.now();
        const response = await axios.post('http://stagingapi.easemytrip.com/cancellationjson/api/cancelv1', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const endTime = Date.now();

        console.log(`[${requestId}] FLIGHT CANCELLATION - API call completed in ${endTime - startTime}ms`);
        console.log(`[${requestId}] FLIGHT CANCELLATION - Response status: ${response.status}`);

        const data = response.data

        // Log cancellation details
        if (data && !data.error) {
            console.log(`[${requestId}] FLIGHT CANCELLATION SUCCESS - Cancellation processed`);
            if (data.cancellationId) {
                console.log(`[${requestId}] FLIGHT CANCELLATION SUCCESS - Cancellation ID: ${data.cancellationId}`);
                await prisma.flightBooking.update({
                    where: { id: body.bookingId },
                    data: {
                        cancellationId: data.cancellationId as string,
                        bookingStatus: 'CANCELLED',
                        status: 'CANCELLED',

                        updatedAt: new Date()
                    }
                });
            }
        } else {
            console.warn(`[${requestId}] FLIGHT CANCELLATION WARNING - Error in response:`, data?.error || 'Unknown error');
        }

        return res.status(200).json({
            data
        })
    }catch(err: any){
        console.error(`[${requestId}] FLIGHT CANCELLATION ERROR:`, err?.response?.data || err?.message || err);
        console.error(`[${requestId}] FLIGHT CANCELLATION FAILED - User: ${req.user?.id || 'Anonymous'}`);
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const checkFlightBookingStatus = async () => {
    const cronJobId = Date.now().toString();

    try {
        console.log(`[${cronJobId}] CRON JOB: Checking flight booking statuses - Started at ${new Date().toISOString()}`);

        // Get all PENDING flight bookings
        const pendingBookings = await prisma.flightBooking.findMany({
            where: {
                bookingStatus: 'PENDING'
            },
            select: {
                id: true,
                userId: true,
                vendorPayload: true,
                createdAt: true
            }
        });

        console.log(`[${cronJobId}] CRON JOB: Found ${pendingBookings.length} pending flight bookings`);

        if (pendingBookings.length === 0) {
            console.log(`[${cronJobId}] CRON JOB: No pending bookings to check.`);
            return;
        }

        let processedCount = 0;
        let confirmedCount = 0;
        let errorCount = 0;

        for (const booking of pendingBookings) {
            const bookingStartTime = Date.now();
            const bookingRequestId = `${cronJobId}-${booking.id}`;

            try {
                console.log(`[${bookingRequestId}] Checking booking ${booking.id} for user ${booking.userId}`);

                // Extract TransactionId from vendorPayload
                const vendorPayload = booking.vendorPayload as any;
                const transactionId = vendorPayload?.TransactionId;

                if (!transactionId) {
                    console.warn(`[${bookingRequestId}] No TransactionId found for booking ${booking.id} - skipping`);
                    continue;
                }

                console.log(`[${bookingRequestId}] Calling EMT API for TransactionId: ${transactionId}`);

                // Call the booking details API
                const apiStartTime = Date.now();
                const response = await axios.post('https://stagingapi.easemytrip.com/cancellationjson/api/flightbookingdetail', {
                    "Authentication": {
                        "Password": "EMT@uytrFYTREt",
                        "UserName": "EMTB2B"
                    },
                    "transactionScreenId": transactionId
                }, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 30000 // 30 second timeout
                });
                const apiEndTime = Date.now();

                console.log(`[${bookingRequestId}] EMT API call completed in ${apiEndTime - apiStartTime}ms, status: ${response.status}`);

                const bookingDetails = response.data;

                // Log passenger details
                const passengerCount = bookingDetails?.passengerDetails?.length || 0;
                console.log(`[${bookingRequestId}] Booking has ${passengerCount} passengers`);

                // Check if all passengers have confirmed status
                const passengerStatuses = bookingDetails.passengerDetails?.map((p: any) => p.status) || [];
                const allPassengersConfirmed = passengerStatuses.every((status: string) => status === 'Confirmed');

                console.log(`[${bookingRequestId}] Passenger statuses: [${passengerStatuses.join(', ')}]`);
                console.log(`[${bookingRequestId}] All passengers confirmed: ${allPassengersConfirmed}`);

                if (allPassengersConfirmed) {
                    console.log(`[${bookingRequestId}] ✅ Booking ${booking.id} is now CONFIRMED - updating database`);

                    // Update booking status in database
                    const updateStartTime = Date.now();
                    await prisma.flightBooking.update({
                        where: { id: booking.id },
                        data: {
                            bookingStatus: 'CONFIRMED',
                            vendorResponse: bookingDetails,
                            updatedAt: new Date()
                        }
                    });
                    const updateEndTime = Date.now();

                    console.log(`[${bookingRequestId}] ✅ Database updated successfully in ${updateEndTime - updateStartTime}ms`);
                    confirmedCount++;
                } else {
                    console.log(`[${bookingRequestId}] ⏳ Booking ${booking.id} is still PENDING`);
                }

                processedCount++;

            } catch (bookingError: any) {
                errorCount++;
                console.error(`[${bookingRequestId}] ❌ Error checking booking ${booking.id}:`, bookingError?.response?.data || bookingError?.message || bookingError);
                // Continue with next booking instead of failing the entire process
            }

            const bookingEndTime = Date.now();
            console.log(`[${bookingRequestId}] Booking ${booking.id} processed in ${bookingEndTime - bookingStartTime}ms`);
        }

        console.log(`[${cronJobId}] CRON JOB COMPLETED:`);
        console.log(`[${cronJobId}] - Total bookings processed: ${processedCount}`);
        console.log(`[${cronJobId}] - Bookings confirmed: ${confirmedCount}`);
        console.log(`[${cronJobId}] - Errors encountered: ${errorCount}`);
        console.log(`[${cronJobId}] - Completed at ${new Date().toISOString()}`);

    } catch (error) {
        console.error(`[${cronJobId}] CRON JOB FAILED:`, error);
    }
}

const airController = {
    searchFlight,
    getPrice,
    seatMap,
    bookFlight,
    getBookingDetails,
    getAuthKeyForCancellation,
    // getFlightBookingDetails,
    cancelFlightBooking,
    checkFlightBookingStatus
}

export default airController