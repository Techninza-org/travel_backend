import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import helper from '../utils/helpers'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import Razorpay from 'razorpay'
import { sendTripNotif, sendTripNotification, sendVendordNotif } from '../app'

const razorpayInstance = new Razorpay({
    key_id: process.env.KEY_ID!,
    key_secret: process.env.KEY_SECRET!,
})

export const CreateTrip = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const body = req.body
        if (!helper.isValidatePaylod(body, ['destination', 'start_date', 'number_of_people', 'service_id', 'cost'])) {
            return res.status(200).send({
                status: 200,
                error: 'Invalid payload',
                error_description: 'destination, start_date, end_date, service_id, cost is required.',
            })
        }
        const {destination, start_date, end_date, number_of_people, cost, service_id} = body;
        if(!destination || typeof destination !== 'string' || destination === 'null'){
            return res.status(400).send({error: "Invalid destination"})
        }
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

        if(!cost || typeof cost !== 'number' || !Number.isInteger(cost) || cost <= 0){
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Cost should be a positive integer value',
            });
        }
        if(!service_id || typeof service_id !== 'number' || !Number.isInteger(service_id) || service_id <= 0){
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Service id should be a positive integer value',
            });
        }

        if (body.service_id === null) {
            return res.status(400).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'service_id is cant be null.',
            })
        }
        const service = await prisma.service.findFirst({ where: { id: Number(body.service_id) } })

        if (!service) {
            return res
                .status(404)
                .send({
                    status: 404,
                    error: 'Service not found',
                    error_description: 'Service not found for the given id.',
                })
        }
        if (req.body.cost > 10000000) {
            return res.status(200).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'cost should be less than 10000000.',
            })
        }
        if (service.type === 1) {
            if (service.available_seats !== null && service.available_seats < body.number_of_people) {
                return res.status(200).send({
                    status: 400,
                    error: 'Not enough seats',
                    error_description: 'Service does not have enough seats.',
                })
            }
            await prisma.service.update({
                where: { id: Number(body.service_id) },
                data: {
                    available_seats:
                        service.available_seats !== null ? service.available_seats - body.number_of_people : null,
                },
            })
        }

        try {
            const order = await razorpayInstance.orders.create({
                amount: body.cost,
                currency: 'INR',
            })
            const trip = await prisma.trip.create({
                data: {
                    destination: body.destination,
                    start_date: body.start_date,
                    end_date: body.end_date,
                    number_of_people: body.number_of_people,
                    service_id: Number(body.service_id),
                    user_id: user.id,
                    tripMembers: body.tripMembers,
                    cost: body.cost,
                    host_id: service.host_id,
                    order_id: order.id,
                    ezi_order_id: `EZI${order.id}`,
                },
            })

            await sendVendordNotif(service.host_id, `${user.username} booked a trip.`)

            return res.status(200).send({
                status: 201,
                message: 'Created',
                trip: trip,
                gateways: { order_id: order.id, amount: order.amount, currency: order.currency },
            })
        } catch (err) {
            return res.status(200).send({
                status: 500,
                error: 'order failed.',
                error_description: (err as Error)?.message,
            })
        }
    } catch (err) {
        return next(err)
    }
}

export const PaymentVerification = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
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
        const razorpay_signature = req.headers['x-razorpay-signature']
        if (!razorpay_signature) return res.status(200).send({ status: 400, message: 'x-razorpay-signature' })
        let sha256 = crypto.createHmac('sha256', process.env.KEY_SECRET!)
        sha256.update(orderId + '|' + paymentId)

        const generated_signature = sha256.digest('hex')
        // if (generated_signature === razorpay_signature) {
        //     const updatedTrip = await prisma.trip.update({
        //         where: { id: Number(tripId) },
        //         data: {
        //             is_payment_confirmed: true,
        //         },
        //     })
        //     return res.send({ status: 200, message: 'Payment confirmed.', trip: updatedTrip })
        // } else {
        //     return res
        //         .status(200)
        //         .send({ status: 400, error: 'incorrect payload', error_description: "payment couldn't be verified." })
        // }
        if (generated_signature !== razorpay_signature) {
            return res.status(400).json({ message: 'Payment verification failed.' })
        }
        const payment = await razorpayInstance.payments.fetch(paymentId)

        if (payment.status === 'captured') {
            const updatedTrip = await prisma.trip.update({
                where: { id: Number(tripId) },
                data: { is_payment_confirmed: true },
            })

            return res.status(200).json({ message: 'Payment confirmed.', trip: updatedTrip })
        } else {
            return res.status(400).json({ message: 'Payment failed or not completed.' })
        }
    } catch (err) {
        return next(err)
    }
}

export const GetTrips = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const trips = await prisma.trip.findMany({
            where: {
                user_id: user.id,
                is_payment_confirmed: true,
            },
            include: {
                service: true,
                host: {
                    select: {
                        name: true,
                        username: true,
                        photo: true,
                    },
                },
            },
        })
        const customs = await prisma.customTrip.findMany({
            where: {
                user_id: user.id,
                // is_payment_confirmed: true,
            },
            include: {
                service: true,
                host: {
                    select: {
                        name: true,
                        username: true,
                        photo: true,
                    },
                },
            },
        })
        const cstm = customs.map((at) => {
            //@ts-ignore
            at.type = 'custom'
            return at
        })
        const trp = trips.map((at) => {
            //@ts-ignore
            at.type = 'build'
            return at
        })

        const merged = [...trp, ...cstm]

        // console.log(merged.length)
        const finalTrips = merged.sort((a, b) => {
            // console.log(a, b);
            // @ts-ignore
            return a?.created_at?.getTime() - b?.created_at?.getTime() || -1
        })

        return res.status(200).send({ status: 200, trips: finalTrips })
    } catch (err) {
        return next(err)
    }
}

export const GetSpecificTrip = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        let tripId: string | number = req.params.id
        const user = req.user
        if (!tripId) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(trip) is required in params.' })
        }
        tripId = Number(tripId)
        if (Number.isNaN(tripId)) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(trip) should be a number.' })
        }

        const trip = await prisma.trip.findFirst({
            where: { id: tripId, user_id: user.id },
            include: {
                service: true,
                host: {
                    select: {
                        name: true,
                        username: true,
                        photo: true,
                    },
                },
            },
        })
        if (!trip) {
            return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Trip not found.' })
        }
        return res.status(200).send({ status: 200, message: 'Ok', trip })
    } catch (err) {
        return next(err)
    }
}

//todo payment return
export const cancelTrip = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const tripId = req.params.id
        const ezio = await prisma.user.findUnique({ where: { id: 3 } })
        if (!tripId) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'tripId is required.' })
        }
        const trip = await prisma.trip.findFirst({
            where: { id: Number(tripId) },
        })
        if (!trip) {
            return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Trip not found.' })
        }
        if (trip.user_id !== user.id) {
            return res
                .status(200)
                .send({
                    status: 403,
                    error: 'Forbidden',
                    error_description: 'You are not allowed to cancel this trip.',
                })
        }
        if (!trip.is_payment_confirmed) {
            return res.status(200).send({
                status: 403,
                error: 'Forbidden',
                error_description: 'Payment is not done for this trip in the first place.',
            })
        }
        const deletedTrip = await prisma.trip.update({
            where: { id: Number(tripId) },
            data: { cancelled: true },
        })
        try {
            await sendVendordNotif(trip.host_id, `${user.username} cancelled a trip.`)
            const registrationToken = user.registrationToken
            const payload = {
                title: 'Trip Update',
                body: `Your trip has been cancelled`,
            }
            sendTripNotif(3, user.id, ezio?.image ?? '', payload.title, payload.body, tripId)
            if (registrationToken) await sendTripNotification(registrationToken, payload, tripId)
        } catch (err) {
            return next(err)
        }

        return res.status(200).send({ status: 200, message: 'Trip cancelled.', trip: deletedTrip })
    } catch (err) {
        return next(err)
    }
}

const getLocations = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const trips = await prisma.trip.findMany({
            where: {
                user_id: user.id,
                is_payment_confirmed: true,
            },
        })
        const tripLocations = await Promise.all(
            trips.map(async (trip) => {
                const destination = trip.destination
                const location = await prisma.destination.findFirst({ where: { destination: destination } })
                return { tripId: trip.id, tripStatus: trip.status, type: 'build', destination: location }
            })
        )
        const customTrips = await prisma.customTrip.findMany({
            where: {
                user_id: user.id,
                is_payment_confirmed: true,
            },
        })
        const customTripLocations = await Promise.all(
            customTrips.map(async (trip) => {
                const itinerary = Array.isArray(trip.itinerary) ? trip.itinerary : []
                if (itinerary) {
                    const locations = await Promise.all(
                        itinerary.map(async (item) => {
                            //@ts-ignore
                            const destination = item?.destination
                            const location = await prisma.destination.findFirst({ where: { destination: destination } })
                            return {
                                location: destination,
                                latitude: location?.latitude,
                                longitude: location?.longitude,
                                image: location?.image,
                            }
                        })
                    )
                    return { tripId: trip.id, tripStatus: trip.status, type: 'custom', destination: locations }
                }
                return { tripId: trip.id, tripStatus: trip.status, destination: [] }
            })
        )

        const merged = [...tripLocations, ...customTripLocations]

        return res.status(200).send({ status: 200, locations: merged })
    } catch (err) {
        return next(err)
    }
}

const tripController = { CreateTrip, GetTrips, GetSpecificTrip, PaymentVerification, cancelTrip, getLocations }
export default tripController
