import { Router } from 'express'
import actionController from '../controller/action.controller.'
import activitiesController from '../controller/activities.controller'

const activitiesRouter = Router()

activitiesRouter
    //@ts-ignore
    .post('/search', activitiesController.searchActivities)
    //@ts-ignore
    .post('/details', activitiesController.activityDetails)
    //@ts-ignore
    .post('/availability', activitiesController.activityAvailability)
    //@ts-ignore
    .post('/transaction', activitiesController.activityCreateTransaction)
    //@ts-ignore
    .post('/booking', activitiesController.activityBooking)

    

export default activitiesRouter