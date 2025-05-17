import { Router } from 'express'
import busController from '../controller/bus.controller'

const busRouter = Router()

busRouter
    //@ts-ignore
    .post('/source/:sourceKey/:key', busController.getSourceCity)
    //@ts-ignore
    .post('/search', busController.getSearchList)
    //@ts-ignore
    .post('/bindSeat', busController.bindSeat)
    //@ts-ignore
    .post('/holdSeat', busController.seatHold)
    //@ts-ignore
    .post('/makeBooking', busController.makeBooking)
    //@ts-ignore
    .post('/cancelTicket', busController.cancelTicket)

export default busRouter