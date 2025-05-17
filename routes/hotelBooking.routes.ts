import { Router } from 'express'
import hotelBookingController from '../controller/hotelbooking.controller'

const hotelBookingRouter = Router()

hotelBookingRouter
    //@ts-ignore
    .post('/search', hotelBookingController.searchHotels)
    //@ts-ignore
    .post('/hotelDetails', hotelBookingController.getHotelDetails)


export default hotelBookingRouter