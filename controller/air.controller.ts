import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const searchFlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/FlightSearch', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getPrice = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirRePriceRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const seatMap = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirBookRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const bookFlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/AirBookRQ', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getBookingDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('https://stagingapi.easemytrip.com/cancellationjson/api/flightbookingdetail', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getAuthKeyForCancellation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;
        const response = await axios.post('https://stagingapi.easemytrip.com/cancellationjson/api/GetAuthKey', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.log(err);
    }
}

const getFlightBookingDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;
        const response = await axios.post('http://stagingapi.easemytrip.com/cancellationjson/api/flightbookingdetailv1', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.log(err);
    }
}

const cancelFlightBooking = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;
        const response = await axios.post('http://stagingapi.easemytrip.com/cancellationjson/api/cancelv1', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const data = response.data
        return res.status(200).json({
            data
        })
    }catch(err){
        console.log(err);
    }
}

const airController = {
    searchFlight,
    getPrice,
    seatMap,
    bookFlight,
    getBookingDetails,
    getAuthKeyForCancellation,
    getFlightBookingDetails,
    cancelFlightBooking
}

export default airController