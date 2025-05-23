import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import helper from '../utils/helpers'
import { PrismaClient } from '@prisma/client'
import { addMonths, parseISO } from 'date-fns'
const prisma = new PrismaClient()
import { PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import { s3 } from '../app'

export const CreateService = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const body = req.body
        if (
            !helper.isValidatePaylod(body, [
                'name',
                'description',
                'destination',
                'price',
                'offer_price',
                'host_id',
                'duration',
                'itinerary',
                'terms_and_conditions',
            ])
        ) {
            return res.status(200).send({
                status: 200,
                error: 'Invalid payload',
                error_description:
                    'name, description, destination, price, offer price, host id, duration, itinerary, terms_and_conditions is required.',
            })
        }
        if (
            isNaN(Number(body.price)) ||
            isNaN(Number(body.offer_price)) ||
            isNaN(Number(body.host_id)) ||
            isNaN(Number(body.duration))
        ) {
            return res.status(200).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'price, offer price, host id, duration should be a number.',
            })
        }

        const service = await prisma.service.create({
            data: {
                name: body.name,
                description: body.description,
                price: Number(body.price),
                images: body.images,
                offer_price: Number(body.offer_price),
                terms_and_conditions: body.terms_and_conditions,
                host_id: Number(body.host_id),
                destination: body.destination,
                services: body.services,
                duration: Number(body.duration),
                itinerary: body.itinerary,
                type: Number(body.type),
                start_date: body.start_date,
                end_date: body.end_date,
                pickups: body.pickups,
                total_seats: Number(body.total_seats),
                available_seats: Number(body.available_seats),
            },
        })

        return res.status(200).send({ status: 201, message: 'Created', service: service })
    } catch (err) {
        return next(err)
    }
}

export const GetAllServices = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const query = req.query
    const { page = 1, limit = 10 } = query
    if (isNaN(Number(page)) || isNaN(Number(limit))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid Query Parameters' })
    }
    const skip = (Number(page) - 1) * Number(limit)
    try {
        const services = await prisma.service.findMany({
            skip: skip,
            take: Number(limit),
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, message: 'Ok', services: services })
    } catch (err) {
        return next(err)
    }
}

export const getFilteredServices = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    let filteredServices = []
    const query = req.query
    const { page = 1, limit = 10, destination, start_date, seats } = query
    if (
        isNaN(Number(page)) ||
        isNaN(Number(limit)) ||
        Number(page) <= 0 ||
        Number(limit) <= 0 ||
        !Number.isInteger(Number(page)) ||
        !Number.isInteger(Number(limit))
    ) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Page and limit must be positive integers.',
        })
    }
    if (!seats || isNaN(Number(seats)) || Number(seats) <= 0 || !Number.isInteger(Number(seats))) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'seats must be positive integers.',
        })
    }
    if (!destination || typeof destination !== 'string' || destination === 'null') {
        return res.status(400).send({ error: 'Invalid destination' })
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!start_date || !dateRegex.test(String(start_date))) {
        return res.status(400).send({ error: 'Invalid start date' })
    }
    const skip = (Number(page) - 1) * Number(limit)
    try {
        const defaultServices = await GetDefaultServices(req, res, next, destination, skip, Number(limit))
        const groupServices = await getGroupServices(
            req,
            res,
            next,
            destination.trim(),
            String(start_date),
            Number(seats),
            skip,
            Number(limit)
        )
        filteredServices = [...defaultServices, ...groupServices]
        const activeServices = filteredServices
            .filter((service) => service.active === true)
            .map((service) => {
                const formattedItinerary =
                    Array.isArray(service.itinerary) ? service.itinerary.map((title: any, index: any) => {
                        const date = new Date(String(start_date)); 
                        date.setDate(date.getDate() + index);
                        return {
                            date: date.toISOString().split('T')[0], 
                            title,
                            active: date <= new Date() ? true : false,
                        };
                    }) : [];

                return {
                    ...service,
                    itinerary: formattedItinerary, 
                }
            })
        console.log(activeServices, 'services')

        return res
            .status(200)
            .send({ status: 200, message: 'Ok', services: activeServices, count: activeServices.length })
    } catch (err) {
        return next(err)
    }
}
const GetDefaultServices = async (
    req: ExtendedRequest,
    res: Response,
    next: NextFunction,
    destination: string,
    skip: number,
    limit: number
) => {
    const services = await prisma.service.findMany({
        where: {
            type: 0,
            destination: { equals: destination },
        },
        include: {
            host: {
                select: {
                    name: true,
                    photo: true,
                },
            },
        },
        skip: skip,
        take: limit,
    })
    return services
}

const getGroupServices = async (
    req: ExtendedRequest,
    res: Response,
    next: NextFunction,
    destination: string,
    start_date: string,
    seats: number,
    skip: number,
    limit: number
) => {
    const startDate = parseISO(start_date.replace(/\/\//g, '-')).toISOString()
    const endDate = addMonths(parseISO(start_date), 1).toISOString()

    const services = await prisma.service.findMany({
        where: {
            type: 1,
            destination: { equals: destination },
            start_date: {
                gte: startDate,
                lt: endDate,
            },
            available_seats: { gte: seats },
        },
        include: {
            host: {
                select: {
                    name: true,
                    photo: true,
                },
            },
        },
        skip: skip,
        take: limit,
    })
    return services
}

export const getServicesByHostId = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const host_id = req.params.id
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
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, message: 'Ok', services: services, count: services.length })
    } catch (err) {
        return next(err)
    }
}

export const getBidsByHostId = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const host_id = req.params.id
    if (isNaN(Number(host_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid Query Parameters' })
    }
    try {
        const services = await prisma.service.findMany({
            where: {
                host_id: { equals: Number(host_id) },
                type: { equals: 2 },
            },
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, message: 'Ok', bids: services, count: services.length })
    } catch (err) {
        return next(err)
    }
}

export const getSpecificService = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    let serviceId: string | number = req.params.id
    if (!serviceId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(service) is required in params.' })
    }
    serviceId = Number(serviceId)
    if (Number.isNaN(serviceId)) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(service) should be a number.' })
    }

    const service = await prisma.service.findFirst({
        where: { id: serviceId },
        include: {
            host: {
                select: {
                    name: true,
                    email: true,
                    description: true,
                    google_rating: true,
                    photo: true,
                },
            },
        },
    })
    if (!service) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Service not found.' })
    }
    return res.status(200).send({ status: 200, message: 'Ok', service })
}

export const deleteService = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        let serviceId: string | number = req.params.id
        if (!serviceId) {
            return res
                .status(200)
                .send({
                    status: 400,
                    error: 'Invalid payload',
                    error_description: 'id(service) is required in params.',
                })
        }
        serviceId = Number(serviceId)
        if (Number.isNaN(serviceId)) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(service) should be a number.' })
        }

        await prisma.trip.updateMany({
            where: { service_id: serviceId },
            data: { service_id: null },
        })
        const service = await prisma.service.delete({ where: { id: serviceId } })
        return res.status(200).send({ status: 200, message: 'Deleted', service })
    } catch (err) {
        return next(err)
    }
}

const editServiceById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        let serviceId: string | number = req.params.id
        if (!serviceId) {
            return res
                .status(200)
                .send({
                    status: 400,
                    error: 'Invalid payload',
                    error_description: 'id(service) is required in params.',
                })
        }
        serviceId = Number(serviceId)
        if (Number.isNaN(serviceId)) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(service) should be a number.' })
        }

        const body = req.body

        if (
            !helper.isValidatePaylod(body, [
                'name',
                'description',
                'price',
                'offer_price',
                'services',
                'duration',
                'itinerary',
            ])
        ) {
            return res.status(200).send({
                status: 200,
                error: 'Invalid payload',
                error_description: 'name, description, price, offer_price, services, duration, itinerary is required.',
            })
        }

        const service = await prisma.service.update({
            where: { id: serviceId },
            data: {
                name: body.name,
                description: body.description,
                price: Number(body.price),
                offer_price: Number(body.offer_price),
                host_id: body.host_id,
                destination: body.destination,
                services: body.services,
                duration: Number(body.duration),
                itinerary: body.itinerary,
            },
        })
        return res.status(200).send({ status: 200, message: 'Updated', service })
    } catch (err) {
        return next(err)
    }
}

const uploadServicePics = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        let serviceId: string | number = req.params.id
        const files = (req as any).files as Express.Multer.File[]

        if (!serviceId) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'service_id is required in body.' })
        }
        if (!files || files.length === 0) {
            return res.status(400).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'files are required.',
            })
        }
        const imageNames: string[] = []

        const uploadPromises = files.map(async (file) => {
            const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
            const imageName = randomImageName()
            const params = {
                Bucket: process.env.BUCKET_NAME!,
                Key: imageName,
                Body: file.buffer,
                ContentType: file.mimetype,
            }
            const command = new PutObjectCommand(params)
            await s3.send(command)
            imageNames.push(`https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`)
        })

        await Promise.all(uploadPromises)

        const service = await prisma.service.update({
            where: { id: Number(serviceId) },
            data: {
                images: imageNames,
            },
        })
        return res.status(200).send({ status: 200, message: 'Pictures uploaded', service })
    } catch (err) {
        return next(err)
    }
}

const searchServices = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { rating, minBudget, maxBudget, category } = req.body

    if (typeof rating !== 'number' || typeof minBudget !== 'number' || typeof maxBudget !== 'number') {
        return res.status(400).send({ error: 'Invalid input types' })
    }
    if (rating < 0 || rating > 5) {
        return res.status(400).send({ error: 'Rating must be between 0 and 5' })
    }
    if (minBudget < 0 || maxBudget < 0) {
        return res.status(400).send({ error: 'Budget cannot be negative' })
    }
    if (minBudget > maxBudget) {
        return res.status(400).send({ error: 'Minimum budget cannot be greater than maximum budget' })
    }

    try {
        const services = await prisma.service.findMany({
            where: {
                AND: [
                    { rating: { gte: rating } },
                    { active: true },
                    { price: { gte: minBudget, lte: maxBudget } },
                    ...(category ? [{ services: { array_contains: category } }] : []),
                ],
            },
        })

        return res.status(200).send({ status: 200, message: 'Ok', services: services })
    } catch (error) {
        console.log(error)
        return res.status(500).send({ error: 'Internal server error' })
    }
}

const updateServiceStatus = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const serviceId = req.params.id
    if (!serviceId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(service) is required in params.' })
    }
    if (isNaN(Number(serviceId))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(service) should be a number.' })
    }

    const service = await prisma.service.findFirst({
        where: { id: Number(serviceId) },
    })

    if (!service) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Service not found.' })
    }
    const updatedService = await prisma.service.update({
        where: { id: Number(serviceId) },
        data: {
            active: !service.active,
        },
    })

    return res.status(200).send({ status: 200, message: 'Status updated', service: updatedService })
}

const serviceController = {
    CreateService,
    GetAllServices,
    getSpecificService,
    deleteService,
    getServicesByHostId,
    editServiceById,
    uploadServicePics,
    getFilteredServices,
    getBidsByHostId,
    searchServices,
    updateServiceStatus,
}
export default serviceController
