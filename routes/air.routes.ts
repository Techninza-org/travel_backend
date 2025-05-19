import { Router } from 'express'
import airController from '../controller/air.controller'

const flightController = Router()

flightController
    //@ts-ignore
    .post('/search', airController.searchFlight)

export default flightController