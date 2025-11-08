import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const searchFlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.id;
        const body = req.body;

        console.log('🚀 [FLIGHT SEARCH] Started', {
            userId,
            timestamp: new Date().toISOString(),
            searchParams: {
                from: body?.Origin,
                to: body?.Destination,
                date: body?.DepartureDate,
                returnDate: body?.ReturnDate,
                passengers: body?.AdultCount,
                class: body?.ClassType
            },
            requestBody: body
        });

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/FlightSearch', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data;

        console.log('✅ [FLIGHT SEARCH] Successful', {
            userId,
            timestamp: new Date().toISOString(),
            responseStatus: response.status,
            resultsCount: data?.Search?.Results?.length || 0,
            hasResults: !!(data?.Search?.Results?.length > 0)
        });

        return res.status(200).json({
            data
        })
    }catch(err){
        console.error('❌ [FLIGHT SEARCH] Error', {
            userId: req.user?.id,
            timestamp: new Date().toISOString(),
            error: err?.message || err,
            stack: err?.stack,
            responseData: err?.response?.data,
            responseStatus: err?.response?.status
        });

        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getPrice = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.id;
        const body = req.body;

        console.log('💰 [FLIGHT PRICE] Started', {
            userId,
            timestamp: new Date().toISOString(),
            priceRequestParams: {
                traceId: body?.TraceId,
                resultIndex: body?.ResultIndex,
                hasFareBreakup: !!body?.FareBreakup
            },
            requestBody: body
        });

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirRePriceRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data;

        console.log('✅ [FLIGHT PRICE] Successful', {
            userId,
            timestamp: new Date().toISOString(),
            responseStatus: response.status,
            hasPriceData: !!data,
            traceId: data?.TraceId,
            totalFare: data?.Fare?.PublishedFare || data?.Fare?.OfferedFare
        });

        return res.status(200).json({
            data
        })
    }catch(err){
        console.error('❌ [FLIGHT PRICE] Error', {
            userId: req.user?.id,
            timestamp: new Date().toISOString(),
            error: err?.message || err,
            stack: err?.stack,
            responseData: err?.response?.data,
            responseStatus: err?.response?.status
        });

        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const seatMap = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.id;
        const body = req.body;

        console.log('🪑 [FLIGHT SEATMAP] Requesting seat map', {
            userId,
            timestamp: new Date().toISOString(),
            traceId: body?.TraceId,
            resultIndex: body?.ResultIndex,
            requestBody: body
        });

        // Note: This seems to be calling AirBookRQ which might be incorrect for seat map
        // Consider updating to proper seat map API endpoint
        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirBookRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data;

        console.log('✅ [FLIGHT SEATMAP] Seat map retrieved', {
            userId,
            timestamp: new Date().toISOString(),
            responseStatus: response.status,
            hasSeatMapData: !!data,
            traceId: data?.TraceId
        });

        return res.status(200).json({
            data
        })
    }catch(err){
        console.error('❌ [FLIGHT SEATMAP] Failed to get seat map', {
            userId: req.user?.id,
            timestamp: new Date().toISOString(),
            error: err?.message || err,
            stack: err?.stack,
            responseData: err?.response?.data,
            responseStatus: err?.response?.status,
            requestBody: req.body
        });

        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const bookFlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.id;
        const body = req.body;

        console.log('🎫 [FLIGHT BOOK] Started', {
            userId,
            timestamp: new Date().toISOString(),
            bookingParams: {
                traceId: body?.TraceId,
                resultIndex: body?.ResultIndex,
                passengerCount: body?.Passenger?.length || 0,
                contactEmail: body?.Passenger?.[0]?.Email,
                contactPhone: body?.Passenger?.[0]?.ContactNo
            },
            requestBody: body
        });

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirBookRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data;

        console.log('✅ [FLIGHT BOOK] Successful', {
            userId,
            timestamp: new Date().toISOString(),
            responseStatus: response.status,
            bookingStatus: data?.Response?.ResponseStatus,
            pnr: data?.Response?.PNR,
            bookingId: data?.Response?.BookingId,
            hasResponse: !!data?.Response
        });

        return res.status(200).json({
            data
        })
    }catch(err){
        console.error('❌ [FLIGHT BOOK] Error', {
            userId: req.user?.id,
            timestamp: new Date().toISOString(),
            error: err?.message || err,
            stack: err?.stack,
            responseData: err?.response?.data,
            responseStatus: err?.response?.status
        });

        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getBookingDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.id;
        const body = req.body;

        console.log('📋 [FLIGHT BOOKING DETAILS] Started', {
            userId,
            timestamp: new Date().toISOString(),
            bookingDetailParams: {
                bookingId: body?.BookingId,
                pnr: body?.PNR,
                hasAuthKey: !!body?.AuthKey
            },
            requestBody: body
        });

        const response = await axios.post('http://stagingapi.easemytrip.com/cancellationjson/api/flightbookingdetailv1', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data;

        console.log('✅ [FLIGHT BOOKING DETAILS] Successful', {
            userId,
            timestamp: new Date().toISOString(),
            responseStatus: response.status,
            bookingStatus: data?.BookingStatus,
            pnr: data?.PNR,
            hasPassengerDetails: !!(data?.Passenger?.length > 0),
            hasFlightDetails: !!(data?.FlightDetails?.length > 0)
        });

        return res.status(200).json({
            data
        })
    }catch(err){
        console.error('❌ [FLIGHT BOOKING DETAILS] Error', {
            userId: req.user?.id,
            timestamp: new Date().toISOString(),
            error: err?.message || err,
            stack: err?.stack,
            responseData: err?.response?.data,
            responseStatus: err?.response?.status
        });

        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getAuthKeyForCancellation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const userId = req.user?.id;
        const body = req.body;

        console.log('🔑 [FLIGHT CANCELLATION] Getting auth key for cancellation', {
            userId,
            timestamp: new Date().toISOString(),
            bookingId: body?.BookingId,
            pnr: body?.PNR,
            requestBody: body
        });

        const response = await axios.post('https://stagingapi.easemytrip.com/cancellationjson/api/GetAuthKey', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = response.data;

        console.log('✅ [FLIGHT CANCELLATION] Auth key retrieved successfully', {
            userId,
            timestamp: new Date().toISOString(),
            responseStatus: response.status,
            hasAuthKey: !!data?.AuthKey,
            bookingId: data?.BookingId
        });

        return res.status(200).json({
            data
        })
    }catch(err){
        console.error('❌ [FLIGHT CANCELLATION] Failed to get auth key', {
            userId: req.user?.id,
            timestamp: new Date().toISOString(),
            error: err?.message || err,
            stack: err?.stack,
            responseData: err?.response?.data,
            responseStatus: err?.response?.status,
            requestBody: req.body
        });

        return res.status(500).json({
            message: 'Failed to get cancellation auth key',
            error: err instanceof Error ? err.message : 'Internal server error'
        });
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
    try{
        const userId = req.user?.id;
        const body = req.body;

        console.log('❌ [FLIGHT CANCELLATION] Initiating flight booking cancellation', {
            userId,
            timestamp: new Date().toISOString(),
            bookingId: body?.BookingId,
            pnr: body?.PNR,
            authKey: body?.AuthKey ? '[PRESENT]' : '[MISSING]',
            requestBody: body
        });

        const response = await axios.post('http://stagingapi.easemytrip.com/cancellationjson/api/cancelv1', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        const data = response.data;

        console.log('✅ [FLIGHT CANCELLATION] Cancellation request processed', {
            userId,
            timestamp: new Date().toISOString(),
            responseStatus: response.status,
            cancellationStatus: data?.Status,
            bookingId: data?.BookingId,
            refundAmount: data?.RefundAmount,
            hasCancellationData: !!data
        });

        return res.status(200).json({
            data
        })
    }catch(err){
        console.error('❌ [FLIGHT CANCELLATION] Cancellation request failed', {
            userId: req.user?.id,
            timestamp: new Date().toISOString(),
            error: err?.message || err,
            stack: err?.stack,
            responseData: err?.response?.data,
            responseStatus: err?.response?.status,
            requestBody: req.body
        });

        return res.status(500).json({
            message: 'Cancellation request failed',
            error: err instanceof Error ? err.message : 'Internal server error'
        });
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
    cancelFlightBooking
}

export default airController