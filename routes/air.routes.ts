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

export default flightRouter