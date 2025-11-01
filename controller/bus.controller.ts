import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

const getSourceCity = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { sourceKey, key } = req.params
        if (!sourceKey || !key) {
            return res.status(400).json({
                message: 'Please provide sourceKey and key',
            })
        }
        const requestBody = {
            sourceKey: sourceKey,
            key: key,
        }
        const response = await axios.post('http://busapi.easemytrip.com/v1/api/search/GetSourceCity/', requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const data = response.data
        return res.status(200).json({
            message: 'Source city fetched successfully',
            data: data,
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const getSearchList = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        // if (!req.body.sourceId || !req.body.key || !req.body.destinationId || !req.body.date || !req.body.isVrl || !req.body.isVolvo) {
        //     {
        //         return res.status(400).json({
        //             message: 'Please provide sourceId, key, destinationId, isVrl, isVolvo and date',
        //         })
        //     }
        // }
        // const requestBody = {
        //     sourceId: req.body.sourceId,
        //     destinationId: req.body.destinationId,
        //     key: req.body.key,
        //     date: req.body.date,
        //     isVrl: req.body.isVrl,
        //     isVolvo: req.body.isVolvo,
        // }
        // const response = await axios.post('http://busapi.easemytrip.com/api/detail/List/', requestBody, {
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        // })

        // const data = response.data
        // return res.status(200).json({
        //     message: 'Search list fetched successfully',
        //     data: data,
        // })
        const body = req.body;

        const response = await axios.post('http://busapi.easemytrip.com/v1/api/detail/List/', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            message: 'Search bus fetched successfully',
            data: response.data,
        })
    } catch (err) {
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const bindSeat = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        // const {id, seater, sleeper, engineId, key, JourneyDate, searchReq, routeid, bpId, dpId, isBpdpLayout, consessionId, singleLeady, stStatus, bustype} = req.body;
        
        // const requestBody = {
        //     id: id,
        //     seater: seater,
        //     sleeper: sleeper,
        //     engineId: engineId,
        //     key: key,
        //     JourneyDate: JourneyDate,
        //     searchReq: searchReq,
        //     routeid: routeid,
        //     bpId: bpId,
        //     dpId: dpId,
        //     isBpdpLayout: isBpdpLayout,
        //     consessionId: consessionId,
        //     singleLeady: singleLeady,
        //     stStatus: stStatus,
        //     bustype: bustype
        // }
        // const response = await axios.post('http://busapi.easemytrip.com/api/detail/SeatBind/', requestBody, {
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        // })
        // const data = response.data
        // return res.status(200).json({
        //     message: 'Seat bind fetched successfully',
        //     data: data,
        // })
        const body = req.body;

        const response = await axios.post('http://busapi.easemytrip.com/v1/api/detail/SeatBind/', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            message: 'Seat bind fetched successfully',
            data: response.data,
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const seatHold = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;

        const response = await axios.post('http://busapi.easemytrip.com/v1/api/detail/GetTentitiveId/', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            message: 'Seat hold fetched successfully',
            data: response.data,
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const makeBooking = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body;

        const response = await axios.post('http://busapi.easemytrip.com/v1/api/detail/MakeBooking', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        return res.status(200).json({
            message: 'Seat book fetched successfully',
            data: response.data,
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const cancelTicket = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const body = req.body;
        const response = await axios.post('http://busapi.easemytrip.com/v1/api/detail/CancelTicket', body, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        return res.status(200).json({
            message: 'Cancellation response fetched successfully',
            data: response.data,
        })

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message: 'Internal server error',
        });
    }
}

const busController = {
    getSourceCity,
    getSearchList,
    bindSeat,
    seatHold,
    makeBooking,
    cancelTicket,
}

export default busController
