import { Router } from 'express'
import airController from '../controller/air.controller'

const flightRouter = Router()

flightRouter
    //@ts-ignore
    .post('/search', airController.searchFlight)
    //@ts-ignore
    .post('/price', airController.getPrice)
    //@ts-ignore
    .post('/seatmap', airController.seatMap)
    //@ts-ignore
    .post('/book', airController.bookFlight)
    //@ts-ignore
    .post('/details', airController.getBookingDetails)
    //@ts-ignore
    .post('/authkey', airController.getAuthKeyForCancellation)
    //@ts-ignore
    .post('/bookingDetailsForCancellation', airController.getFlightBookingDetails)
    //@ts-ignore
    .post('/cancelflight', airController.cancelFlightBooking)

export default flightRouter