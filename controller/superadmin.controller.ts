import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
import crypto from 'crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../app'
const SALT_ROUND = process.env.SALT_ROUND!
const ITERATION = 100
const KEYLENGTH = 10
const DIGEST_ALGO = 'sha512'
import * as xlsx from 'xlsx'

const getAllUsers = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, email: true, username: true, phone: true, trips: true, created_at: true },
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, users: users, count: users.length })
    } catch (err) {
        return res.status(400).send({ error: 'Error in getting users' })
    }
}

const getUserById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user_id = req.params.user_id

    if (isNaN(Number(user_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid user id Parameters' })
    }
    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(user_id) },
            include: { post: { include: { comment: true, Likes: true } } },
        })
        return res.status(200).send({ status: 200, user: user })
    } catch (err) {
        return next(err)
    }
}

const deleteCommentById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const comment_id = req.params.comment_id

    if (isNaN(Number(comment_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid comment id Parameters' })
    }
    try {
        const commentExists = await prisma.comment.findUnique({ where: { id: Number(comment_id) } })
        if (!commentExists) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Comment not found' })
        }
        const comment = await prisma.comment.delete({ where: { id: Number(comment_id) } })

        return res.status(200).send({ status: 200, comment: comment })
    } catch (err) {
        return next(err)
    }
}

const deletePostById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const post_id = req.params.post_id

    if (isNaN(Number(post_id))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid post id Parameters' })
    }
    try {
        const postExists = await prisma.post.findUnique({ where: { id: Number(post_id) } })
        if (!postExists) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Post not found' })
        }
        const post = await prisma.post.delete({ where: { id: Number(post_id) } })

        return res.status(200).send({ status: 200, post: post })
    } catch (err) {
        return next(err)
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
                submitted: true,
                created_at: true,
            },
            orderBy: { created_at: 'desc' },
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
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid hostid Parameters' })
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
    try {
        const kycList = await prisma.vendorKyc.findMany({
            include: {
                host: true,
            },
        })
        return res.status(200).send({ kycList })
    } catch (err) {
        return next(err)
    }
}

const getSpecificVendorKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { host_id } = req.body
        const kyc = await prisma.vendorKyc.findUnique({
            where: { host_id: host_id },
            include: {
                host: true,
            },
        })
        return res.status(200).send({ kyc })
    } catch (err) {
        return next(err)
    }
}

const acceptKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { host_id } = req.body
        if (!host_id) {
            return res.status(400).send({ message: 'host id is required' })
        }
        const accepted = await prisma.host.update({
            where: { id: host_id },
            data: {
                verified: true,
            },
        })
        return res.status(200).send({ message: 'Vendor verified successfully' })
    } catch (err) {
        return next(err)
    }
}

const rejectKyc = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { host_id } = req.body
        if (!host_id) {
            return res.status(400).send({ message: 'host id is required' })
        }
        await prisma.vendorKyc.delete({ where: { host_id: host_id } })
        await prisma.host.update({ where: { id: host_id }, data: { submitted: false } })
        return res.status(200).send({ message: 'Vendor kyc rejected successfully' })
    } catch (err) {
        return next(err)
    }
}

const getNotifs = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const notifs = await prisma.kycNotification.findMany({ orderBy: { created_at: 'desc' } })
        return res.status(200).send({ notifs: notifs })
    } catch (err) {
        return next(err)
    }
}

const getTransactionsByUserId = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { user_id } = req.body
        if (!user_id) {
            return res.status(400).send({ message: 'User id is required' })
        }
        if (isNaN(Number(user_id))) {
            return res.status(400).send({ message: 'Invalid user id' })
        }
        const transactions = await prisma.transactions.findMany({
            where: { user_id: user_id },
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ transactions: transactions })
    } catch (err) {
        return next(err)
    }
}

const getAllTransactions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const transactions = await prisma.transactions.findMany({
            orderBy: { created_at: 'desc' },
            include: {
                user: {
                    select: {
                        username: true,
                        phone: true,
                    },
                },
            },
        })
        return res.status(200).send({ transactions: transactions })
    } catch (err) {
        return next(err)
    }
}

const createBlog = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const body = req.body
        const { title, description, meta, keywords, category } = body
        if (!title || !description) {
            return res.status(400).send({ message: 'Title and description is required' })
        }
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

        const currentDate = new Date().toISOString().slice(0, 10)
        const blogSlug = `${currentDate}-${title.toLowerCase().replace(/ /g, '-')}`

        const blog = await prisma.blog.create({
            data: {
                title: title,
                description: description,
                slug: blogSlug,
                meta: meta,
                keywords: keywords,
                category: category,
                image: `https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`,
            },
        })
        return res.status(200).send({ status: 201, message: 'Created', blog: blog })
    } catch (err) {
        return next(err)
    }
}

const deleteBlog = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        if (!id) {
            return res.status(400).send({ message: 'Blog id is required' })
        }
        const blogExists = await prisma.blog.findUnique({ where: { id: Number(id) } })
        if (!blogExists) {
            return res.status(400).send({ message: 'Blog does not exist' })
        }
        await prisma.blog.delete({ where: { id: Number(id) } })
        return res.status(200).send({ message: 'Blog deleted successfully' })
    } catch (err) {
        return next(err)
    }
}

export const allHostServices = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const services = await prisma.service.findMany({ include: { host: true }, orderBy: { created_at: 'desc' } })
        return res.status(200).send({ status: 200, message: 'Ok', services: services, count: services.length })
    } catch (err) {
        return next(err)
    }
}

export const allTrips = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const normalTrips = await prisma.trip.findMany({
            include: { host: true, user: true, service: true },
            orderBy: { created_at: 'desc' },
        })
        const customTrips = await prisma.customTrip.findMany({
            include: { host: true, user: true, service: true },
            orderBy: { created_at: 'desc' },
        })
        const trips = [...normalTrips, ...customTrips]
        trips.sort((a, b) => (a.created_at > b.created_at ? -1 : 1))
        return res.status(200).send({ status: 200, message: 'Ok', trips: trips, count: trips.length })
    } catch (err) {
        return next(err)
    }
}

export const getTripDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        let tripId: string | number = req.params.id
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

        let tripDetails = {}

        const trip = await prisma.trip.findFirst({
            where: { id: tripId },
            include: { service: true, user: true, host: true },
        })

        const customTrip = await prisma.customTrip.findFirst({
            where: { id: tripId },
            include: { service: true, user: true, host: true },
        })
        if (trip) {
            tripDetails = trip
        } else if (customTrip) {
            tripDetails = customTrip
        } else {
            return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Trip not found.' })
        }
        return res.status(200).send({ status: 200, message: 'Ok', trip: tripDetails })
    } catch (err) {
        return next(err)
    }
}

export const getServiceDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
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

export const getQueries = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const queries = await prisma.query.findMany({ orderBy: { created_at: 'desc' } })
        return res.status(200).send({ status: 200, message: 'Ok', queries: queries, count: queries.length })
    } catch (err) {
        return next(err)
    }
}

const updateUserPassword = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { user_id, password } = req.body
        if (!user_id) return res.status(400).send({ error: 'User id is required' })
        if (isNaN(Number(user_id))) return res.status(400).send({ error: 'Invalid user id' })
        if (typeof password !== 'string') return res.status(400).send({ error: 'password must be a string' })
        let hash_password: string | Buffer = crypto.pbkdf2Sync(password, SALT_ROUND, ITERATION, KEYLENGTH, DIGEST_ALGO)
        hash_password = hash_password.toString('hex')

        const user = await prisma.user.update({
            where: { id: user_id },
            data: { password: hash_password },
        })
        return res.status(200).send({ message: 'Password Updated' })
    } catch (err) {
        return next(err)
    }
}

type AirportRow = {
    AirportCode: string
    AirportName: string
    cityName: string
    CityCode: string
    Country: string
    ContinentCode: string
    CountryCode: string
}

const importAirportDataFromExcel = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const file = req.file
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        const workbook = xlsx.read(file.buffer, { type: 'buffer' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const jsonData = xlsx.utils.sheet_to_json<AirportRow>(sheet, { defval: null })

        const rows = jsonData
            .filter((row) => row.AirportCode && row.AirportName) // basic validation
            .map((row) => ({
                airportCode: row.AirportCode,
                airportName: row.AirportName,
                cityName: row.cityName,
                cityCode: row.CityCode,
                country: row.Country,
                continentCode: row.ContinentCode,
                countryCode: row.CountryCode,
            }))

        await prisma.airport.createMany({
            data: rows,
            skipDuplicates: true,
        })

        console.log('✅ Import completed')
        return res.status(200).json({ message: 'Airport data imported successfully' })
    } catch (err) {
        console.error('❌ Import error:', err)
        return next(err)
    }
}

type AnyObj = Record<string, any>

function safeJson<T = any>(val: any, fallback: T): T {
    if (val == null) return fallback
    if (typeof val === 'string') {
        try {
            return JSON.parse(val) as T
        } catch {
            return fallback
        }
    }
    return val as T
}

function toInt(v: any, d = 0) {
    const n = parseInt(String(v), 10)
    return Number.isFinite(n) ? n : d
}

export const createPackage = async (req: Request, res: Response, _next: NextFunction) => {
    try {
        const b = req.body as AnyObj

        const type = toInt(b.type) // 0=india, 1=international
        const category = String(b.category || '').trim()
        const state = String(b.state || '').trim()
        const city = String(b.city || '').trim()
        const country = String(b.country || '').trim()
        const name = String(b.name || '').trim()
        const description = String(b.description || '').trim()
        const price = toInt(b.price)
        const tax = toInt(b.tax)
        const days = Math.max(1, toInt(b.days, 1))
        const nights = Math.max(0, toInt(b.nights, Math.max(0, days - 1)))

        const itinerary = safeJson(b.itinerary, [] as AnyObj[])
        const inclusions = safeJson(b.inclusions, [] as string[])
        const exclusions = safeJson(b.exclusions, [] as string[])
        const highlights = safeJson(b.highlights, [] as string[])
        const cancellation_policy = safeJson(b.cancellation_policy, [] as string[])
        const date_change_policy = safeJson(b.date_change_policy, [] as string[])
        const destination_guide = safeJson(b.destination_guide, [] as string[])
        const images = safeJson(b.images, [] as string[]) // Array of image URLs or base64 strings
        const providedBy = b.provided_by ? String(b.provided_by).trim() : ''

        if (![0, 1].includes(type)) {
            return res.status(400).send({ error: 'Invalid type (use 0 for india, 1 for international)' })
        }
        if (!category) return res.status(400).send({ error: 'Category is required' })
        if (!name) return res.status(400).send({ error: 'Name is required' })
        if (!description) return res.status(400).send({ error: 'Description is required' })
        if (price <= 0) return res.status(400).send({ error: 'Price must be > 0' })

        // --- Create
        const created = await prisma.package.create({
            data: {
                type,
                category,
                name,
                state,
                city,
                country,
                description,
                images: images as any, // Prisma Json
                price,
                tax,
                days,
                nights,
                providedBy,
                itinerary: itinerary as any, // Prisma Json
                destination_guide: destination_guide as any, // Prisma Json
                inclusions: inclusions as any,
                exclusions: exclusions as any,
                highlights: highlights as any,
                cancellation_policy: cancellation_policy as any,
                date_change_policy: date_change_policy as any,
            },
            select: {
                id: true,
                name: true,
                category: true,
                type: true,
                days: true,
                nights: true,
                price: true,
                created_at: true,
            },
        })

        return res.status(201).send({ status: 201, package: created })
    } catch (err) {
        console.error('createPackage error:', err)
        return res.status(400).send({ error: 'Error in creating package' })
    }
}
export const updatePackage = async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
    try {
        const b = req.body as AnyObj
        const packageId = req.params.id

        const type = toInt(b.type) // 0=india, 1=international
        const category = String(b.category || '').trim()
        const state = String(b.state || '').trim()
        const city = String(b.city || '').trim()
        const country = String(b.country || '').trim()
        const name = String(b.name || '').trim()
        const description = String(b.description || '').trim()
        const price = toInt(b.price)
        const tax = toInt(b.tax)
        const days = Math.max(1, toInt(b.days, 1))
        const nights = Math.max(0, toInt(b.nights, Math.max(0, days - 1)))

        const itinerary = safeJson(b.itinerary, [] as AnyObj[])
        const inclusions = safeJson(b.inclusions, [] as string[])
        const exclusions = safeJson(b.exclusions, [] as string[])
        const highlights = safeJson(b.highlights, [] as string[])
        const cancellation_policy = safeJson(b.cancellation_policy, [] as string[])
        const date_change_policy = safeJson(b.date_change_policy, [] as string[])
        const destination_guide = safeJson(b.destination_guide, [] as string[])
        const images = safeJson(b.images, [] as string[]) // Array of image URLs or base64 strings
        const providedBy = b.provided_by ? String(b.provided_by).trim() : ''

        if (![0, 1].includes(type)) {
            return res.status(400).send({ error: 'Invalid type (use 0 for india, 1 for international)' })
        }
        if (!category) return res.status(400).send({ error: 'Category is required' })
        if (!name) return res.status(400).send({ error: 'Name is required' })
        if (!description) return res.status(400).send({ error: 'Description is required' })
        if (price <= 0) return res.status(400).send({ error: 'Price must be > 0' })

        // --- Updated
        const updated = await prisma.package.update({
            where: {
                id: Number(packageId),
            },
            data: {
                type,
                category,
                name,
                state,
                city,
                country,
                description,
                images: images as any, // Prisma Json
                price,
                tax,
                days,
                nights,
                providedBy,
                itinerary: itinerary as any, // Prisma Json
                destination_guide: destination_guide as any, // Prisma Json
                inclusions: inclusions as any,
                exclusions: exclusions as any,
                highlights: highlights as any,
                cancellation_policy: cancellation_policy as any,
                date_change_policy: date_change_policy as any,
            },
        })

        return res.status(201).send({ status: 201, package: updated })
    } catch (err) {
        console.error('updatePackage error:', err)
        return res.status(400).send({ error: 'Error in updating package' })
    }
}

const createNewEditedPackageCustom = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const b = req.body as AnyObj
        const { packageId } = req.params
        if (!packageId) {
            return res.status(400).send({ error: 'Package id is required' })
        }

        const name = String(b.name || '').trim()
        const price = toInt(b.price)
        const tax = toInt(b.tax)
        const days = Math.max(1, toInt(b.days, 1))
        const nights = Math.max(0, toInt(b.nights, Math.max(0, days - 1)))

        const itinerary = safeJson(b.itinerary, [] as AnyObj[])
        const inclusions = safeJson(b.inclusions, [] as string[])
        const exclusions = safeJson(b.exclusions, [] as string[])
        const existingPackage = await prisma.package.findUnique({ where: { id: Number(packageId) } })
        if (!existingPackage) {
            return res.status(404).send({ error: 'Package not found' })
        }
        const newPackage = await prisma.customPackage.create({
            data: {
                type: existingPackage.type,
                category: existingPackage.category,
                state: existingPackage.state,
                city: existingPackage.city,
                country: existingPackage.country,
                name: name || existingPackage.name,
                description: existingPackage.description,
                images: existingPackage.images || [],
                price: price || existingPackage.price,
                tax: tax || existingPackage.tax,
                days: days || existingPackage.days,
                nights: nights || existingPackage.nights,
                providedBy: existingPackage.providedBy,
                itinerary: itinerary as any || existingPackage.itinerary,
                inclusions: inclusions as any || existingPackage.inclusions,
                exclusions: exclusions as any || existingPackage.exclusions,
                highlights: existingPackage.highlights || [],
                cancellation_policy: existingPackage.cancellation_policy as any,
                date_change_policy: existingPackage.date_change_policy as any,
                destination_guide: existingPackage.destination_guide as any,
            },
            select: {
                id: true,
                name: true,
                category: true,
                type: true,
                days: true,
                nights: true,
                price: true,
                created_at: true,
            },
        })
    } catch (err) {
        return next(err)
    }
}

const getPackages = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const packages = await prisma.package.findMany({
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, packages: packages, count: packages.length })
    } catch (err) {
        return next(err)
    }
}

const getPackageById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const packageId = req.params.id

    if (isNaN(Number(packageId))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid package id Parameters' })
    }
    try {
        const packageDetails = await prisma.package.findUnique({
            where: { id: Number(packageId) },
        })
        if (!packageDetails) {
            return res.status(404).send({ status: 404, error: 'Package not found' })
        }
        return res.status(200).send({ status: 200, package: packageDetails })
    } catch (err) {
        return next(err)
    }
}

const deletePackageById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const packageId = req.params.id
    if (isNaN(Number(packageId))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid package id Parameters' })
    }
    try {
        const packageExists = await prisma.package.findUnique({
            where: {
                id: Number(packageId),
            },
        })
        if (!packageExists) {
            return res.status(404).send({ status: 404, error: 'Package not found' })
        }
        await prisma.package.delete({ where: { id: Number(packageId) } })
        return res.status(200).send({ message: 'Package deleted successfully' })
    } catch (err) {
        return next(err)
    }
}

const getAllQuoteQuery = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const quotes = await prisma.quote.findMany({
            include: {
                package: true,
            },
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, quotes })
    } catch (err) {
        return next(err)
    }
}

const markQuoteQueryAsSent = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const quoteId = Number(req.params.id)
        if (!quoteId) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(quote) is required in params.' })
        }
        const quote = await prisma.quote.update({
            where: { id: quoteId },
            data: { done: true },
        })
        return res.status(200).send({ status: 200, message: 'Quote marked as sent successfully.', quote })
    } catch (err) {
        return next(err)
    }
}

const createPackageCategory = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { name, image } = req.body
        if (!name || !image) {
            return res.status(400).send({ error: 'Name and image are required' })
        }
        const category = await prisma.packageCategory.create({
            data: { name, image },
        })
        return res.status(201).send({ status: 201, category })
    } catch (err) {
        return res.status(400).send({ error: 'Error in creating package category' })
    }
}

const updateCategoryImage = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { id, image } = req.body
        if (!id || !image) {
            return res.status(400).send({ error: 'Id and image are required' })
        }
        const categoryExists = await prisma.packageCategory.findUnique({ where: { id: Number(id) } })
        if (!categoryExists) {
            return res.status(404).send({ error: 'Category not found' })
        }
        const category = await prisma.packageCategory.update({
            where: { id: Number(id) },
            data: { image },
        })
        return res.status(200).send({ status: 200, category })
    } catch (err) {
        return res.status(400).send({ error: 'Error in updating category image' })
    }
}

const updateStateImage = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { id, image } = req.body
        if (!id || !image) {
            return res.status(400).send({ error: 'Id and image are required' })
        }
        const stateExists = await prisma.packageState.findUnique({ where: { id: Number(id) } })
        if (!stateExists) {
            return res.status(404).send({ error: 'State not found' })
        }
        const state = await prisma.packageState.update({
            where: { id: Number(id) },
            data: { image },
        })
        return res.status(200).send({ status: 200, state })
    } catch (err) {
        return res.status(400).send({ error: 'Error in updating state image' })
    }
}

const updateCountryImage = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { id, image } = req.body
        if (!id || !image) {
            return res.status(400).send({ error: 'Id and image are required' })
        }
        const countryExists = await prisma.packageCountry.findUnique({ where: { id: Number(id) } })
        if (!countryExists) {
            return res.status(404).send({ error: 'Country not found' })
        }
        const country = await prisma.packageCountry.update({
            where: { id: Number(id) },
            data: { image },
        })
        return res.status(200).send({ status: 200, country })
    } catch (err) {
        return res.status(400).send({ error: 'Error in updating country image' })
    }
}

const createPackageState = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { name, image } = req.body
        if (!name || !image) {
            return res.status(400).send({ error: 'Name and image are required' })
        }
        const state = await prisma.packageState.create({
            data: { name, image },
        })
        return res.status(201).send({ status: 201, state })
    } catch (err) {
        return res.status(400).send({ error: 'Error in creating package state' })
    }
}

const createPackageCountry = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { name, image } = req.body
        if (!name || !image) {
            return res.status(400).send({ error: 'Name and image are required' })
        }
        const country = await prisma.packageCountry.create({
            data: { name, image },
        })
        return res.status(201).send({ status: 201, country })
    } catch (err) {
        return res.status(400).send({ error: 'Error in creating package country' })
    }
}

const getAllPackageCategories = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const categories = await prisma.packageCategory.findMany({
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, categories })
    } catch (err) {
        return next(err)
    }
}

const getAllPackageStates = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const states = await prisma.packageState.findMany({
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, states })
    } catch (err) {
        return next(err)
    }
}

const getAllPackageCountries = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const countries = await prisma.packageCountry.findMany({
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, countries })
    } catch (err) {
        return next(err)
    }
}

const deletePackageCategory = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id
        if (isNaN(Number(id))) {
            return res.status(400).send({ error: 'Invalid category id' })
        }
        const categoryExists = await prisma.packageCategory.findUnique({ where: { id: Number(id) } })
        if (!categoryExists) {
            return res.status(404).send({ error: 'Category not found' })
        }
        await prisma.packageCategory.delete({ where: { id: Number(id) } })
        return res.status(200).send({ message: 'Category deleted successfully' })
    } catch (err) {
        return next(err)
    }
}

const deletePackageState = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id
        if (isNaN(Number(id))) {
            return res.status(400).send({ error: 'Invalid state id' })
        }
        const stateExists = await prisma.packageState.findUnique({ where: { id: Number(id) } })
        if (!stateExists) {
            return res.status(404).send({ error: 'State not found' })
        }
        await prisma.packageState.delete({ where: { id: Number(id) } })
        return res.status(200).send({ message: 'State deleted successfully' })
    } catch (err) {
        return next(err)
    }
}

const deletePackageCountry = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const id = req.params.id
        if (isNaN(Number(id))) {
            return res.status(400).send({ error: 'Invalid country id' })
        }
        const countryExists = await prisma.packageCountry.findUnique({ where: { id: Number(id) } })
        if (!countryExists) {
            return res.status(404).send({ error: 'Country not found' })
        }
        await prisma.packageCountry.delete({ where: { id: Number(id) } })
        return res.status(200).send({ message: 'Country deleted successfully' })
    } catch (err) {
        return next(err)
    }
}

const getReportedForumQuestions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const questions = await prisma.forumReport.findMany({
            include: {
                question: true,
            },
        })
        const questionWithReportCountMap = new Map<number, { question: any; reportCount: number }>()
        questions.forEach((report) => {
            const questionId = report.question.id
            const existing = questionWithReportCountMap.get(questionId)
            if (existing) {
                existing.reportCount += 1
            } else {
                questionWithReportCountMap.set(questionId, { question: report.question, reportCount: 1 })
            }
        })
        const questionss = Array.from(questionWithReportCountMap.values())
        questionss.sort((a, b) => b.reportCount - a.reportCount) // Sort by report count in descending order
        return res.status(200).send({ status: 200, questions: questionss })
    } catch (err) {
        return next(err)
    }
}

const deleteForumQuestion = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const questionId = req.params.id
    if (isNaN(Number(questionId))) {
        return res.status(400).send({ error: 'Invalid question id' })
    }
    try {
        const questionExists = await prisma.forumQuestion.findUnique({ where: { id: Number(questionId) } })
        if (!questionExists) {
            return res.status(404).send({ error: 'Question not found' })
        }
        //delete all answers
        await prisma.forumAnswer.deleteMany({ where: { question_id: Number(questionId) } })
        await prisma.forumQuestion.delete({ where: { id: Number(questionId) } })
        return res.status(200).send({ message: 'Question deleted successfully' })
    } catch (err) {
        return next(err)
    }
}

const getReportedPosts = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const posts = await prisma.postReport.findMany({
            include: {
                post: true,
            },
        })
        const postWithReportCountMap = new Map<number, { post: any; reportCount: number }>()
        posts.forEach((report) => {
            const postId = report.post.id
            const existing = postWithReportCountMap.get(postId)
            if (existing) {
                existing.reportCount += 1
            } else {
                postWithReportCountMap.set(postId, { post: report.post, reportCount: 1 })
            }
        })
        const postss = Array.from(postWithReportCountMap.values())
        postss.sort((a, b) => b.reportCount - a.reportCount) // Sort by report count in descending order
        return res.status(200).send({ status: 200, posts: postss })
    } catch (err) {
        return next(err)
    }
}

const addBanner = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { imageUrl } = req.body
        if (!imageUrl) {
            return res.status(400).send({ valid: false, error: 'Image URL is required.' })
        }
        const banner = await prisma.banner.create({
            data: { image: imageUrl },
        })
        return res.status(200).send({ valid: true, banner })
    } catch (err) {
        return next(err)
    }
}

const deleteBannerById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params
        const banner = await prisma.banner.delete({
            where: { id: parseInt(id) },
        })
        return res.status(200).send({ valid: true, banner })
    } catch (err) {
        return next(err)
    }
}

const superAdminController = {
    getReportedForumQuestions,
    deleteForumQuestion,
    getReportedPosts,
    createPackage,
    getPackages,
    getPackageById,
    deletePackageById,
    getAllQuoteQuery,
    markQuoteQueryAsSent,
    getQueries,
    createPackageCategory,
    createPackageState,
    createPackageCountry,
    getAllPackageCategories,
    getAllPackageStates,
    getAllPackageCountries,
    deletePackageCategory,
    deletePackageState,
    deletePackageCountry,
    updateUserPassword,
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
    getNotifs,
    getTransactionsByUserId,
    getAllTransactions,
    createBlog,
    deleteBlog,
    getUserById,
    deleteCommentById,
    deletePostById,
    allHostServices,
    allTrips,
    getTripDetails,
    getServiceDetails,
    importAirportDataFromExcel,
    addBanner,
    deleteBannerById,
    updatePackage,
    updateCategoryImage,
    updateStateImage,
    updateCountryImage,
    createNewEditedPackageCustom,
}
export default superAdminController
