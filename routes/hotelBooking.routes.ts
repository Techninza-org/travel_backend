import { Router } from 'express'
import hotelBookingController from '../controller/hotelbooking.controller'

const hotelBookingRouter = Router()

hotelBookingRouter
    //@ts-ignore
    .post('/search', hotelBookingController.searchHotels)
    //@ts-ignore
    .post('/hotelDetails', hotelBookingController.getHotelDetails)
    //@ts-ignore
    .post('/book', hotelBookingController.bookHotel)
    //@ts-ignore
    .post('/bookingDetails', hotelBookingController.getBookingDetails)
    //@ts-ignore
    .post('/checkAvailability', hotelBookingController.checkHotelAvailability)
    //@ts-ignore
    .post('/cancelBooking', hotelBookingController.cancelHotelBooking)
    //@ts-ignore
    .post('/roomInfo', hotelBookingController.getHotelRoomInfo)

export default hotelBookingRouter