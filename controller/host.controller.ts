import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { PrismaClient } from '@prisma/client'
import helper from '../utils/helpers'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../app'
import crypto from 'crypto'
const prisma = new PrismaClient()

const getHostedTrips = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const hostId = Number(req.query.id)
        if (!hostId) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(host) is required in params.' })
        }
        const trips = await prisma.trip.findMany({ where: { host_id: hostId }, include: { service: true, user: true } })
        return res.status(200).send({ status: 200, trips: trips, count: trips.length })
    } catch (err) {
        return res.status(400).send({ error: 'Error in getting hosted trips' })
    }
}

export const GetSpecificTripHost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{let tripId: string | number = req.params.id
    const user = req.host
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
        include: { service: true, user: true },
    })
    if (!trip) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Trip not found.' })
    }
    return res.status(200).send({ status: 200, message: 'Ok', trip })
}catch(err){
        return next(err)
    }
}

const getHostProfile = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{const hostId: string | number = req.params.id
    if (!hostId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(host) is required in params.' })
    }
    const host = await prisma.host.findUnique({ where: { id: Number(hostId) } })
    return res.status(200).send({ status: 200, host })
}catch(err){
    return next(err)
}}

const updateHostProfile = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
    const hostId: string | number = req.params.id
    const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
    const imageName = randomImageName()
    const params = {
        Bucket: process.env.BUCKET_NAME!,
        Key: imageName,
        Body: req.file?.buffer,
        ContentType: req.file?.mimetype,
    }
    const command = new PutObjectCommand(params)
    await s3.send(command)

    const imageUrl = `https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`
    if (!hostId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(host) is required in params.' })
    }

    const host = await prisma.host.update({ where: { id: Number(hostId) }, data: { ...req.body, photo: imageUrl } })
    return res.status(200).send({ status: 200, host })
    }catch(err){
        return next(err)
    }
}

const updateProfile = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{const hostId: string | number = req.params.id
    console.log(hostId);
    
    const {name, description, email} = req.body
    const google_rating = parseFloat(req.body.google_rating)
    const host = await prisma.host.update({ where: { id: Number(hostId) }, data: { name, description, email, google_rating } })
    return res.status(200).send({ updated: host })
}catch(err){
    return next(err)
}
}

const changeHostPassword = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{const hostId: string | number = req.params.id
    const { oldPassword, newPassword } = req.body
    const host = await prisma.host.findUnique({ where: { id: Number(hostId) } })
    if (!host) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Host not found.' })
    }
    const isPasswordCorrect = host.password === oldPassword
    if (!isPasswordCorrect) {
        return res.status(200).send({ status: 400, error: 'Invalid payload', error_description: 'Old password is incorrect.' })
    }
    await prisma.host.update({ where: { id: Number(hostId) }, data: { password: newPassword } })
    return res.status(200).send({ status: 200, message: 'Password changed successfully.' })
}catch(err){
    return next(err)
}
}


const hostController = { getHostedTrips, GetSpecificTripHost, getHostProfile, updateHostProfile, updateProfile, changeHostPassword }
export default hostController
