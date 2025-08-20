import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import moment from 'moment';
import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()
import Razorpay from 'razorpay'

const razorpayInstance = new Razorpay({
    key_id: process.env.KEY_ID!,
    key_secret: process.env.KEY_SECRET!,
})

const USERNAME = "HotelAPIUserTest";
const PASSWORD = "hotelapitest6NKHbRNN4pSD9G2H";
const IPADDRESS = "110.235.232.3"
const AGENTCODE = 1

function formatDateInput(dateStr: string) {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) throw new Error("Invalid date format");
    return date.toISOString().split("T")[0];
}

const searchHotels = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const { page, city, cityName, country, checkInDate, checkOutDate, roomCount, adultCount, childCount, currency, nights } = req.body;
        // if (!page || !city || !cityName || !country || !checkInDate || !checkOutDate || !roomCount || !adultCount || !childCount || !currency || !nights) {
        //     return res.status(400).json({
        //         message: 'Please provide all required fields'
        //     });
        // }
        const dateFormat = 'YYYY-MM-DD';
        const areDatesValid = moment(checkInDate, dateFormat, true).isValid() && moment(checkOutDate, dateFormat, true).isValid();

        if (!areDatesValid) {
            return res.status(400).json({
                message: 'Invalid date format, please use YYYY-MM-DD'
            });
        }

        console.log(`CheckInDate: ${checkInDate}, CheckOutDate: ${checkOutDate}`);
        

        const requestBody = {
            PageNo: page,
            City: city,
            CityName: cityName,
            CheckInDate: formatDateInput(checkInDate),
            CheckOutDate: formatDateInput(checkOutDate),
            country: country,
            rooms: {
                Count: roomCount,
                Room: [{
                        NumberOfAdults: adultCount,   
                        Child: {
                            NumberOfChild: childCount,
                        }                     
                    }]
            },
            currency: currency,
            Nights: nights,
            Engine: 15,
            TotalHotel: 10,
            EMTAuthentication: {
                UserName: USERNAME,
                Password: PASSWORD,
                AgentCode: AGENTCODE,
                IPAddress: IPADDRESS,
            }
        }
        const response = await axios.post('https://hotelapita.easemytrip.com/MiHotel.svc/Hotellist', requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        })
        const data = response.data;
        console.log(`Response Data for search hotels: ${JSON.stringify(data)}`);
        
        return res.status(200).json({
            message: 'Hotels fetched successfully',
            data: data
        })
        
    }catch(err){
        console.error(err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
}

const getHotelDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const {hotelID, engineID, emtCommonID} = req.body;
        // if (!hotelID || !engineID || !emtCommonID) {
        //     return res.status(400).json({
        //         message: 'Please provide hotelID, emtCommonID and engineID'
        //     });
        // }
        const url = `http://hotelapita.easemytrip.com/MiHotel.svc/HotelInfo/${hotelID}/${engineID}/${emtCommonID}/${USERNAME}/${PASSWORD}/${AGENTCODE}`
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        })
        const data = response.data;
        return res.status(200).json({
            message: 'Hotel details fetched successfully',
            data: data
        })
    }catch(err){
        console.error(err);
        return res.status(500).json({
            message: 'Internal server error'
        });
    }
}

const getHotelRoomInfo = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('http://hotelapita.easemytrip.com/MiHotel.svc/GetHotelInfo', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            data: response.data,
        })

    }catch(err){
        console.log(err);
        return next(err);
    }
}

const bookHotel = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('http://hotelapita.easemytrip.com/MiHotel.svc/HotelBooking', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            data: response.data,
        })

    }catch(err){
        console.log(err);
        return next(err);
    }
}

const getBookingDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;

        const response = await axios.post('https://hotelapita.easemytrip.com/BookingDetail.svc/BookingDetailsV2', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            data: response.data,
        })
    }catch(err){
        return next(err);
    }
}

const checkHotelAvailability = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;

        const response = await axios.post('http://hotelapita.easemytrip.com/MiHotel.svc/ProductDetails', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            data: response.data,
        })
    }catch(err){
        return next(err);
    }
}

const cancelHotelBooking = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;

        const response = await axios.post('http://hotelapita.easemytrip.com/MiHotel.svc/HotelCancellation', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        console.log(`Response from hotel cancellation: ${JSON.stringify(response.data)}`);
        

        return res.status(200).json({
            data: response.data,
        })
    }catch(err){
        return next(err);
    }
}

const hotelBookingController = {
    searchHotels,
    getHotelDetails,
    bookHotel,
    getBookingDetails,
    checkHotelAvailability,
    cancelHotelBooking,
    getHotelRoomInfo
}

export default hotelBookingController