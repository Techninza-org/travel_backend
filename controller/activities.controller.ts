import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'

const searchActivities = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('http://stagingactivityapi.easemytrip.com/Activity.svc/json/GetActivitiesB2C', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({data})
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const activityDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('http://stagingactivityapi.easemytrip.com/Activity.svc/json/GetActivitiesDetailsB2C', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({data})
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const activityAvailability = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('http://stagingactivityapi.easemytrip.com/Activity.svc/json/CheckProductAvailability', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        
        const data = response.data
        return res.status(200).json({data})
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const activityCreateTransaction = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('http://stagingactivityapi.easemytrip.com/Activity.svc/json/CreateTransaction', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({data})
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const activityBooking = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body

        const response = await axios.post('http://stagingactivityapi.easemytrip.com/Activity.svc/json/ActivityBooking', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({data})
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const activitiesController = {
    searchActivities,
    activityDetails,
    activityAvailability,
    activityCreateTransaction,
    activityBooking
}

export default activitiesController