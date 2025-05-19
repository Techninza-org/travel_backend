import { Router } from 'express'
import airController from '../controller/air.controller'

const flightRouter = Router()

flightRouter
    //@ts-ignore
    .post('/search', airController.searchFlight)

export default flightRouter