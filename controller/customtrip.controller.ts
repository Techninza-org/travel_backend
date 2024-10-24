import { NextFunction, Response } from 'express'
import helper from '../utils/helpers'
import { ExtendedRequest } from '../utils/middleware'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import Razorpay from 'razorpay'
import crypto from 'node:crypto'
import { sendTripNotif, sendTripNotification } from '../app'

const razorpayInstance = new Razorpay({
    key_id: process.env.KEY_ID!,
    key_secret: process.env.KEY_SECRET!,
})

export const InitialiseCustomTrip = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const body = req.body
    if (!helper.isValidatePaylod(body, ['number_of_people', 'itinerary', 'start_date', 'end_date'])) {
        return res.status(400).send({
            error: 'Invalid payload',
            error_description: 'number of people, itinerary, start_date, end_date is required.',
        })
    }
    const { number_of_people, itinerary, start_date, end_date } = req.body
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if(!start_date || !dateRegex.test(String(start_date))){
        return res.status(400).send({error: "Invalid start date"})
    }
    if(!end_date || !dateRegex.test(String(start_date))){
        return res.status(400).send({error: "Invalid end date"})
    }
    if(number_of_people){
        if (typeof number_of_people !== 'number' || !Number.isInteger(number_of_people) || number_of_people <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Number of people should be a positive integer value',
            });
        }
    }
    try {
        const customTrip = await prisma.customTrip.create({
            data: {
                user_id: user.id,
                number_of_people: number_of_people,
                itinerary: itinerary,
                start_date: start_date,
                end_date: end_date,
                duration: itinerary.length,
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', custom_trip: customTrip })
    } catch (err: unknown) {
        return res.status(500).send({
            error: 'Internal Server Error',
            error_description: 'An error occurred while creating custom trip.',
        })
    }
}

export const deleteCustomTrip = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const customTripId = Number(req.params.id)
    if (!customTripId) {
        return res.status(400).send({ error: 'Invalid payload', error_description: 'custom trip id is required.' })
    }
    if (Number.isNaN(customTripId)) {
        return res
            .status(400)
            .send({ error: 'Invalid payload', error_description: 'custom trip id should be a number.' })
    }
    try {
        const customTrip = await prisma.customTrip.findFirst({ where: { id: customTripId } })
        if (!customTrip) {
            return res.status(404).send({ error: 'Not found', error_description: 'Custom trip not found.' })
        }
        if (customTrip.user_id !== user.id) {
            return res
                .status(403)
                .send({ error: 'Forbidden', error_description: 'You are not allowed to delete this custom trip.' })
        }
        await prisma.customTrip.delete({ where: { id: customTripId } })
        return res.status(200).send({ status: 200, message: 'Deleted', custom_trip: customTrip })
    } catch (err: unknown) {
        return res.status(500).send({
            error: 'Internal Server Error',
            error_description: 'An error occurred while deleting custom trip.',
        })
    }
}

export const AllCustomTrips = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const customTrips = await prisma.customTrip.findMany({
            where: { booked: false },
            include: {
                user: {
                    select: { username: true, phone: true, image: true },
                },
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', custom_trips: customTrips })
    } catch (err) {
        return next(err)
    }
}

export const getCustomTripById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const customTripId = Number(req.params.id)
    if (!customTripId) {
        return res.status(400).send({ error: 'Invalid payload', error_description: 'custom trip id is required.' })
    }
    try {
        const customTrip = await prisma.customTrip.findFirst({
            where: { id: customTripId },
            include: {
                user: {
                    select: { username: true, phone: true, image: true },
                },
            },
        })
        if (!customTrip) {
            return res.status(404).send({ error: 'Not found', error_description: 'Custom trip not found.' })
        }
        return res.status(200).send({ status: 200, message: 'Ok', custom_trip: customTrip })
    } catch (err: unknown) {
        return res.status(500).send({
            error: 'Internal Server Error',
            error_description: 'An error occurred while fetching custom trip.',
        })
    }
}

export const createCustomService = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const body = req.body
        if (!helper.isValidatePaylod(body, ['name', 'custom_trip_id'])) {
            ////add the other things
            return res
                .status(400)
                .send({ error: 'Invalid payload', error_description: 'name, custom_trip_id is required.' })
        }
        const {
            name,
            description,
            number_of_people,
            start_date,
            end_date,
            price,
            type,
            custom_trip_id,
            user_id,
            itinerary,
        } = req.body
        if (
            Number.isNaN(Number(custom_trip_id)) ||
            Number.isNaN(Number(user_id)) ||
            Number.isNaN(Number(number_of_people))
        ) {
            return res.status(400).send({
                error: 'Invalid payload',
                error_description: 'custom_trip_id, user_id, number_of_people should be a number.',
            })
        }
        try {
            const customTrip = await prisma.customTrip.findFirst({ where: { id: custom_trip_id } })
            if (!customTrip) {
                return res.status(404).send({ error: 'Not found', error_description: 'Custom trip not found.' })
            }
            if (customTrip.user_id !== user_id) {
                return res.status(403).send({
                    error: 'Forbidden',
                    error_description: 'You are not allowed to create service for this custom trip.',
                })
            }
            const customService = await prisma.service.create({
                data: {
                    name: name,
                    description: description,
                    number_of_people: number_of_people,
                    start_date: start_date,
                    end_date: end_date,
                    price: Number(price),
                    type: type,
                    custom_trip_id: custom_trip_id,
                    user_id: user_id,
                    itinerary: itinerary,
                    host_id: user.id,
                    duration: itinerary.length,
                },
            })
            try {
                const ezio = await prisma.user.findUnique({ where: { id: 3 } })
                const user_id = customTrip.user_id
                const registrationToken = user.registrationToken
                const payload = {
                    title: 'Bid Alert',
                    body: `An agency placed a bid for your trip.`,
                }
                sendTripNotif(3, user_id, ezio?.image ?? '', payload.title, payload.body, String(customTrip.id))
                if (registrationToken) await sendTripNotification(registrationToken, payload, String(customTrip.id))
            } catch (err) {
                return next(err)
            }
            return res.status(200).send({ status: 200, message: 'Ok', custom_service: customService })
        } catch (err: unknown) {
            return res.status(500).send({
                error: 'Internal Server Error',
                error_description: 'An error occurred while creating custom service.',
            })
        }
    } catch (err) {
        return next(err)
    }
}

export const getBids = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const customTripId = Number(req.params.id)
        if (!customTripId) {
            return res.status(400).send({ error: 'Invalid payload', error_description: 'custom trip id is required.' })
        }
        try {
            const customTrip = await prisma.customTrip.findFirst({ where: { id: customTripId } })
            if (!customTrip) {
                return res.status(404).send({ error: 'Not found', error_description: 'Custom trip not found.' })
            }
            if (customTrip.user_id !== user.id) {
                return res.status(403).send({
                    error: 'Forbidden',
                    error_description: 'You are not allowed to view bids for this custom trip.',
                })
            }
            const bids = await prisma.service.findMany({
                where: { custom_trip_id: customTripId, user_id: user.id, status: 0 },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    number_of_people: true,
                    start_date: true,
                    end_date: true,
                    price: true,
                    type: true,
                    custom_trip_id: true,
                    user_id: true,
                    itinerary: true,
                    status: true,
                    host: {
                        select: { id: true, name: true, email: true, google_rating: true, photo: true },
                    },
                    duration: true,
                },
            })
            return res.status(200).send({ status: 200, message: 'Ok', bids_services: bids })
        } catch (err: unknown) {
            return res
                .status(500)
                .send({ error: 'Internal Server Error', error_description: 'An error occurred while fetching bids.' })
        }
    } catch (err) {
        return next(err)
    }
}

export const acceptBid = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const body = req.body
        if (!helper.isValidatePaylod(body, ['service_id'])) {
            return res.status(400).send({ error: 'Invalid payload', error_description: 'service_id is required.' })
        }
        const { service_id } = req.body
        if (Number.isNaN(Number(service_id))) {
            return res
                .status(400)
                .send({ error: 'Invalid payload', error_description: 'service_id should be a number.' })
        }
        try {
            const service = await prisma.service.findFirst({ where: { id: service_id } })
            if (!service) {
                return res.status(404).send({ error: 'Not found', error_description: 'Service not found.' })
            }
            if (service.price > 10000000) {
                return res.status(200).send({
                    status: 400,
                    error: 'Invalid payload',
                    error_description: 'cost should be less than 10000000.',
                })
            }
            if (service.user_id !== user.id) {
                return res.status(403).send({
                    error: 'Forbidden',
                    error_description: 'You are not allowed to accept this bid.',
                })
            }
            if (service.custom_trip_id === null) {
                return res.status(400).send({
                    error: 'Bad Request',
                    error_description: 'Invalid custom trip ID.',
                })
            }
            await prisma.service.update({ where: { id: service_id }, data: { status: 1 } })
            const trip = await prisma.customTrip.update({
                where: { id: service.custom_trip_id },
                data: {
                    booked: true,
                    service_id: service_id,
                    host_id: service.host_id,
                    cost: service.price,
                },
            })
            const order = await razorpayInstance.orders.create({
                amount: service.price * 100,
                currency: 'INR',
            })
            return res
                .status(200)
                .send({
                    status: 200,
                    message: 'accepted',
                    trip: trip,
                    gateways: { order_id: order.id, amount: order.amount, currency: order.currency },
                })
        } catch (err) {
            next(err)
        }
    } catch (err) {
        return next(err)
    }
}

export const CustomTripPaymentVerification = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const body = req.body

        if (!body)
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'paymentId, orderId is required.' })

        const { paymentId, orderId, tripId } = body
        if (!paymentId || !orderId || !tripId || Number.isNaN(Number(tripId))) {
            return res.status(200).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'paymentId, orderId ,tripId is required.',
            })
        }
        try {
            const razorpay_signature = req.headers['x-razorpay-signature']
            if (!razorpay_signature) return res.status(200).send({ status: 400, message: 'x-razorpay-signature' })
            let sha256 = crypto.createHmac('sha256', process.env.KEY_SECRET!)
            sha256.update(orderId + '|' + paymentId)

            const generated_signature = sha256.digest('hex')
            if (generated_signature === razorpay_signature) {
                const updatedTrip = await prisma.customTrip.update({
                    where: { id: Number(tripId) },
                    data: {
                        is_payment_confirmed: true,
                    },
                })
                return res.send({ status: 200, message: 'Payment confirmed.', trip: updatedTrip })
            } else {
                return res
                    .status(200)
                    .send({
                        status: 400,
                        error: 'incorrect payload',
                        error_description: "payment couldn't be verified.",
                    })
            }
        } catch (err) {
            return next(err)
        }
    } catch (err) {
        return next(err)
    }
}

const customTripController = {
    InitialiseCustomTrip,
    deleteCustomTrip,
    AllCustomTrips,
    getCustomTripById,
    createCustomService,
    getBids,
    acceptBid,
    CustomTripPaymentVerification,
}

export default customTripController
