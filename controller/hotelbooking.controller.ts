import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import moment from 'moment';
import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const searchHotels = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const { page, city, cityName, country, checkInDate, checkOutDate, roomCount, adultCount, childCount, currency, nights } = req.body;
        if (!page || !city || !cityName || !country || !checkInDate || !checkOutDate || !roomCount || !adultCount || !childCount || !currency || !nights) {
            return res.status(400).json({
                message: 'Please provide all required fields'
            });
        }
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
            CheckInDate: checkInDate,
            CheckOutDate: checkOutDate,
            country: country,
            rooms: {
                Count: roomCount,
                room: [{
                        NumberOfAdults: adultCount,   
                        Child: {
                            NumberOfChild: childCount,
                        }                     
                    }]
            },
            currency: currency,
            Nights: nights,
            Engine: 15,
            EMTAuthentication: {
                UserName: 'HotelAPIUserTest',
                Password: 'BDvRwrEwX5waYF6NKHbRNN4pSD9G2H',
                AgentCode: 1,
                IPAddress: '110.235.232.3'
            }
        }

        const requestBodyString = JSON.stringify(requestBody);
        console.log(`Request Body: ${requestBodyString}`);
        

        const response = await axios.post('https://hotelapita.easemytrip.com/MiHotel.svc/Hotellist', requestBodyString, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        })
        const data = response.data;
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

const hotelBookingController = {
    searchHotels
}

export default hotelBookingController