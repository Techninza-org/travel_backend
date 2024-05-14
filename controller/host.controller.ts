import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const getHostedTrips = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const hostId = Number(req.query.id)
    console.log(hostId)

    if (!hostId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(host) is required in params.' })
    }
    const trips = await prisma.trip.findMany({ where: { host_id: hostId }, include: { service: true, user: true } })
    return res.status(200).send({ status: 200, trips: trips, count: trips.length })
}

export const GetSpecificTripHost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
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

    const trip = await prisma.trip.findFirst({ where: { id: tripId, user_id: user.id }, include: {service: true, user: true}},)
    if (!trip) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Trip not found.' })
    }
    return res.status(200).send({ status: 200, message: 'Ok', trip })
}

const getHostProfile = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const hostId: string | number = req.params.id
    if (!hostId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(host) is required in params.' })
    }
    const host = await prisma.host.findUnique({ where: { id: Number(hostId) } })
    return res.status(200).send({ status: 200, host })
}

const updateHostProfile = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const hostId = Number(req.query.id)
    if (!hostId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(host) is required in params.' })
    }
    const host = await prisma.user.update({ where: { id: hostId }, data: req.body })
    return res.status(200).send({ status: 200, host })

}

const hostController = { getHostedTrips, GetSpecificTripHost, getHostProfile, updateHostProfile}
export default hostController