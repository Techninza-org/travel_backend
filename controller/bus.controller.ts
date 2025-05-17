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
        const response = await axios.post('http://busapi.easemytrip.com/api/search/GetSourceCity/', requestBody, {
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
        if (!req.body.sourceId || !req.body.key || !req.body.destinationId || !req.body.date || !req.body.isVrl || !req.body.isVolvo) {
            {
                return res.status(400).json({
                    message: 'Please provide sourceId, key, destinationId, isVrl, isVolvo and date',
                })
            }
        }
        const requestBody = {
            sourceId: req.body.sourceId,
            destinationId: req.body.destinationId,
            key: req.body.key,
            date: req.body.date,
            isVrl: req.body.isVrl,
            isVolvo: req.body.isVolvo,
        }
        const response = await axios.post('http://busapi.easemytrip.com/api/detail/List/', requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({
            message: 'Search list fetched successfully',
            data: data,
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
        const {id, seater, sleeper, engineId, key, JourneyDate, searchReq, routeid, bpId, dpId, isBpdpLayout, consessionId, singleLeady, stStatus, bustype} = req.body;
        
        const requestBody = {
            id: id,
            seater: seater,
            sleeper: sleeper,
            engineId: engineId,
            key: key,
            JourneyDate: JourneyDate,
            searchReq: searchReq,
            routeid: routeid,
            bpId: bpId,
            dpId: dpId,
            isBpdpLayout: isBpdpLayout,
            consessionId: consessionId,
            singleLeady: singleLeady,
            stStatus: stStatus,
            bustype: bustype
        }
        const response = await axios.post('http://busapi.easemytrip.com/api/detail/SeatBind/', requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        })
        const data = response.data
        return res.status(200).json({
            message: 'Seat bind fetched successfully',
            data: data,
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
        const {data} = req.body;
        if (!data) {
            return res.status(400).json({
                message: 'Please provide data',
            })
        }
        return res.status(200).json({
            message: 'Seat hold fetched successfully',
            data: data,
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const makeBooking = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { transactionid, key } = req.body;
    if (!transactionid || !key) {
        return res.status(400).json({
            message: 'Please provide transactionid and key',
        });
    }
    const requestBody = {
        transactionid: transactionid,
        key: key,
    };
    const response = await axios.post('http://busapi.easemytrip.com/api/detail/MakeBooking', requestBody, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
    const data = response.data;
    return res.status(200).json({
        message: 'Booking made successfully',
        data: data,
    });
}

const cancelTicket = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { ticketNo, key, canceltype, Bookid, IPAddress, Remarks } = req.body;
        if (!ticketNo || !key || !canceltype || !Bookid || !IPAddress || !Remarks) {
            return res.status(400).json({
                message: 'Please provide all required fields',
            });
        }
        const requestBody = {
            ticketNo: ticketNo,
            key: key,
            canceltype: canceltype,
            Bookid: Bookid,
            IPAddress: IPAddress,
            Remarks: Remarks,
        };
        const response = await axios.post('http://busapi.easemytrip.com/api/detail/CancelTicket', requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        });
        const data = response.data;
        return res.status(200).json({
            message: 'Ticket canceled successfully',
            data: data,
        });
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
