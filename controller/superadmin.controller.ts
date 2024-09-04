import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const getAllUsers = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, username: true, phone: true, trips: true },
        })
        return res.status(200).send({ status: 200, users: users, count: users.length })
    } catch (err) {
        return res.status(400).send({ error: 'Error in getting users' })
    }
}

const createVendor = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { name, username, phone, password } = req.body
        const alreadyExists = await prisma.host.findFirst({ where: { OR: [{ username }, { phone }] } })
        if (alreadyExists) return res.status(400).send({ error: 'Vendor already exists' })
        const vendor = await prisma.host.create({
            data: { name, username, phone, password },
            select: { name: true, username: true, phone: true },
        })
        return res.status(200).send({ status: 200, vendor: vendor })
    } catch (err) {
        return res.status(400).send({ error: 'Error in creating vendor' })
    }
}

const getAllVendors = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const vendors = await prisma.host.findMany({
            select: {
                id: true,
                email: true,
                username: true,
                phone: true,
                trips: true,
                services: true,
                customTrips: true,
                photo: true,
                verified: true,
                submitted: true
            },
        })
        return res.status(200).send({ status: 200, vendors: vendors, count: vendors.length })
    } catch (err) {
        return res.status(400).send({ error: 'Error in getting vendors' })
    }
}

export const deleteVendor = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const host_id = req.params.host_id

    if (isNaN(Number(host_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid Query Parameters' })
    }
    try {
        const vendor = await prisma.host.delete({ where: { id: Number(host_id) } })
        return res.status(200).send({ status: 200, vendor: vendor })
    } catch (err) {
        return next(err)
    }
}


export const hostServices = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const host_id = req.params.host_id

    if (isNaN(Number(host_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid Query Parameters' })
    }
    try {
        const services = await prisma.service.findMany({
            where: {
                host_id: { equals: Number(host_id) },
                type: { not: 2 },
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', services: services, count: services.length })
    } catch (err) {
        return next(err)
    }
}

export const hostTrips = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const host_id = req.params.host_id

    if (isNaN(Number(host_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid Query Parameters' })
    }
    try {
        const trips = await prisma.trip.findMany({
            where: {
                host_id: { equals: Number(host_id) },
            },
            include: {
                user: true,
                service: true,
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', trips: trips, count: trips.length })
    } catch (err) {
        return next(err)
    }
}
export const userTrips = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user_id = req.params.user_id

    if (isNaN(Number(user_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid Query Parameters' })
    }
    try {
        const trips = await prisma.trip.findMany({
            where: {
                user_id: { equals: Number(user_id) },
            },
            include: {
                user: true,
                service: true,
                host: true,
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', trips: trips, count: trips.length })
    } catch (err) {
        return next(err)
    }
}

const getKycDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { user_id } = req.body
    if (!user_id) return res.status(400).send({ error: 'User id is required' })
    if (isNaN(Number(user_id))) return res.status(400).send({ error: 'Invalid user id' })

    try {
        const user = await prisma.user.findFirst({ where: { id: user_id } })
        const kyc_status = user?.kycStatus
        const kycDetails = await prisma.kYC.findFirst({ where: { user_id: user_id } })
        if (!kycDetails) return res.status(200).send({ message: 'Kyc details not submitted', kyc_status: kyc_status })
        return res.status(200).send({ message: 'ok', kycDetails, kyc_status: kyc_status })
    } catch (err) {
        return res.status(400).send({ error: 'Error in getting kyc details' })
    }
}

const handleKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { user_id, kycStatus } = req.body
    if (!user_id) return res.status(400).send({ error: 'User id is required' })
    if (isNaN(Number(user_id))) return res.status(400).send({ error: 'Invalid user id' })
    try {
        const kycDetails = await prisma.kYC.findFirst({ where: { user_id: user_id } })
        if (!kycDetails) return res.status(200).send({ message: 'Kyc details not submitted' })
        const kyc = await prisma.user.update({ where: { id: user_id }, data: { kycStatus: kycStatus } })
        if (kycStatus === -1) {
            await prisma.user.update({ where: { id: user_id }, data: { kycStatus: kycStatus } })
            await prisma.kYC.delete({ where: { user_id: user_id } })
        }
        return res.status(200).send({ message: 'ok' })
    } catch (err) {
        return next(err)
    }
}

const getServiceOptions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const serviceOptions = await prisma.serviceOptions.findMany({})
        return res.status(200).send({ status: 200, serviceOptions: serviceOptions })
    } catch (err) {
        return res.status(400).send({ error: 'Error in getting service options' })
    }
}

const addServiceOption = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { name } = req.body
        const serviceOption = await prisma.serviceOptions.create({ data: { name } })
        return res.status(200).send({ status: 200, serviceOption: serviceOption })
    } catch (err) {
        return res.status(400).send({ error: 'Error in adding service option' })
    }
}

const deleteServiceOption = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id
        const serviceOption = await prisma.serviceOptions.delete({ where: { id: Number(id) } })
        return res.status(200).send({ status: 200, serviceOption: serviceOption })
    } catch (err) {
        return res.status(400).send({ error: 'Error in deleting service option' })
    }
}

const getAllVendorKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const kycList = await prisma.vendorKyc.findMany({include:{
            host: true
        }})
        return res.status(200).send({kycList})
    }catch(err){
        return next(err)
    }
}

const getSpecificVendorKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const {host_id} = req.body
        const kyc = await prisma.vendorKyc.findUnique({where: {host_id: host_id},include:{
            host: true
        }})
        return res.status(200).send({kyc})
    }catch(err){
        return next(err)
    }
}

const acceptKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const {host_id} = req.body
        if(!host_id){
            return res.status(400).send({message: "host id is required"})
        }
        const accepted = await prisma.host.update({
            where: {id: host_id},
            data: {
                verified: true
            }
        })
        return res.status(200).send({message: "Vendor verified successfully"})
    }catch(err){
        return next(err)
    }
}

const rejectKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const {host_id} = req.body
        if(!host_id){
            return res.status(400).send({message: "host id is required"})
        }
        await prisma.vendorKyc.delete({where: {host_id: host_id}})
        await prisma.host.update({where: {id: host_id}, data: {submitted: false}})
        return res.status(200).send({message: "Vendor kyc rejected successfully"})
    }catch(err){
        return next(err)
    }
}

const getNotifs = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const notifs = await prisma.kycNotification.findMany({orderBy: {created_at: 'desc'}})
        return res.status(200).send({notifs: notifs})
    }catch(err){
        return next(err)
    }
}



const superAdminController = {
    getAllUsers,
    getAllVendors,
    createVendor,
    hostServices,
    hostTrips,
    userTrips,
    getKycDetails,
    handleKyc,
    getServiceOptions,
    addServiceOption,
    deleteServiceOption,
    deleteVendor,
    getAllVendorKyc,
    getSpecificVendorKyc,
    acceptKyc,
    rejectKyc,
    getNotifs
}
export default superAdminController
