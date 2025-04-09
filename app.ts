import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
dotenv.config()
import authRouter from './routes/auth.routes'
import middleware from './utils/middleware'
import userRouter from './routes/user.routes'
import postRouter from './routes/post.routes'
import fs from 'fs'
import path from 'path'
import http from 'http'
import https from 'https'
import { Server } from 'socket.io'
import actionRouter from './routes/action.routes'
import tripRouter from './routes/trip.routes'
import ServiceRouter from './routes/service.routes'
import ExpenseRouter from './routes/expense.routes'
import cors from 'cors'
import cron from 'node-cron'
import { PrismaClient } from '@prisma/client'
import morgan from 'morgan'
import DestinationRouter from './routes/destination.routes'
import HostRouter from './routes/host.routes'
import customtriprouter from './routes/customtrips.routes'
import faqRouter from './routes/faq.routes'
import forumRouter from './routes/forum.routes'
import messageRouter from './routes/message.routes'
import SuperAdminRouter from './routes/superadmin.routes'
import * as admin from 'firebase-admin'
// import TemplateRouter from './routes/template.routes'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'node:crypto'

const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const accessKey = process.env.ACCESS_KEY
const secretAccessKey = process.env.SECRET_ACCESS_KEY

//@ts-ignore
export const s3 = new S3Client({
    credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretAccessKey,
    },
    region: bucketRegion,
})

const prisma = new PrismaClient()
const app = express()
app.use(express.static('public'))
app.use(express.json())
// app.use(express.urlencoded({ extended: true }));

// app.use(statusMonitor())
app.use(morgan('tiny'))
app.use(cors())

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT!)

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    })

    console.log('Firebase Admin initialized successfully.')
} catch (error) {
    console.error('Error initializing Firebase Admin:', error)
}

app.get('/ping', (_req, res) => {
    return res.status(200).send({ status: 200, message: 'pong' })
})

app.get('/public/:filename', (req: Request, res: Response) => {
    const filename = req.params.filename
    const filepath = path.resolve('./public/images/' + filename)
    try {
        const stream = fs.createReadStream(filepath)
        stream.on('data', (chunk) => res.write(chunk))
        stream.on('end', () => res.end())
        stream.on('error', (err) => {
            return res.sendStatus(404)
        })
    } catch (err) {
        return res.sendStatus(404)
    }
})

app.use('/auth', authRouter)
// @ts-ignore
app.use('/user', middleware.AuthMiddleware, userRouter)
// @ts-ignore
app.use('/post', middleware.AuthMiddleware, postRouter)
// @ts-ignore
app.use('/action', middleware.AuthMiddleware, actionRouter)
// @ts-ignore
app.use('/trip', middleware.AuthMiddleware, tripRouter)
// @ts-ignore
app.use('/service', ServiceRouter)
// @ts-ignore
app.use('/host', middleware.HostAuthMiddleware, HostRouter)
// @ts-ignore
app.use('/destination', DestinationRouter)
// @ts-ignore
app.use('/expense', middleware.AuthMiddleware, ExpenseRouter)
//@ts-ignore
app.use('/custom', customtriprouter)
//@ts-ignore
app.use('/faq', faqRouter)
//@ts-ignore
app.use('/forum', middleware.AuthMiddleware, forumRouter)
//@ts-ignore
app.use('/message', middleware.AuthMiddleware, messageRouter)
// @ts-ignore
app.use('/superAdmin', SuperAdminRouter)
// app.use('/template', TemplateRouter)


export const sendVendordNotif = async (
    hostId: number,
    title: string,
) => {
    const notif = await prisma.vendorNotification.create({
        data: {
            host_id: hostId, 
            title,
        },
    })
}

export const sendNotif = async (
    senderId: number,
    receiverId: number,
    senderProfile: string,
    title: string,
    message: string
) => {
    const notif = await prisma.notification.create({
        data: {
            sender_id: senderId,
            receiver_id: receiverId,
            sender_profile: senderProfile,
            title,
            message,
        },
    })
}
export const sendTripNotif = async (
    senderId: number,
    receiverId: number,
    senderProfile: string,
    title: string,
    message: string,
    tripId: string
) => {
    const notif = await prisma.notification.create({
        data: {
            sender_id: senderId,
            receiver_id: receiverId,
            sender_profile: senderProfile,
            title,
            message,
            type: 'trip',
            type_id: tripId,
        },
    })
}
export const sendTripNotification = async (
    registrationToken: string,
    payload: { title: string; body: string },
    tripId: string
) => {
    try {
        const message = {
            token: registrationToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                type: 'trip',
                tripId: tripId,
            },
        }

        const response = await admin.messaging().send(message)
        return response
    } catch (error) {
        console.error('Error sending message:', error)
    }
}
export const sendPostNotif = async (
    senderId: number,
    receiverId: number,
    senderProfile: string,
    title: string,
    message: string,
    postId: string
) => {
    const notif = await prisma.notification.create({
        data: {
            sender_id: senderId,
            receiver_id: receiverId,
            sender_profile: senderProfile,
            title,
            message,
            type: 'post',
            type_id: postId,
        },
    })
}
export const sendPostNotification = async (
    registrationToken: string,
    payload: { title: string; body: string },
    postId: string
) => {
    try {
        const message = {
            token: registrationToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                type: 'post',
                postId: postId,
            },
        }

        const response = await admin.messaging().send(message)
        return response
    } catch (error) {
        console.error('Error sending message:', error)
    }
}
export const sendForumNotif = async (
    senderId: number,
    receiverId: number,
    senderProfile: string,
    title: string,
    message: string,
    questionId: string
) => {
    const notif = await prisma.notification.create({
        data: {
            sender_id: senderId,
            receiver_id: receiverId,
            sender_profile: senderProfile,
            title,
            message,
            type: 'forum',
            type_id: questionId,
        },
    })
}
export const sendForumNotification = async (
    registrationToken: string,
    payload: { title: string; body: string },
    questionId: string
) => {
    try {
        const message = {
            token: registrationToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                type: 'forum',
                questionId: questionId,
            },
        }

        const response = await admin.messaging().send(message)
        return response
    } catch (error) {
        console.error('Error sending message:', error)
    }
}
export const sendMessageNotif = async (
    senderId: number,
    receiverId: number,
    senderProfile: string,
    title: string,
    message: string,
    chatId: string
) => {
    const notif = await prisma.notification.create({
        data: {
            sender_id: Number(senderId),
            receiver_id: Number(receiverId),
            sender_profile: senderProfile,
            title,
            message,
            type: 'chat',
            type_id: chatId,
        },
    })
}
export const sendMessageNotification = async (
    registrationToken: string,
    payload: { title: string; body: string },
    chatId: string
) => {
    try {
        const message = {
            token: registrationToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                type: 'chat',
                chatId: chatId,
            },
        }

        const response = await admin.messaging().send(message)
        return response
    } catch (error) {
        console.log('Error sending message:', error)
    }
}
export const sendFollowNotif = async (
    senderId: number,
    receiverId: number,
    senderProfile: string,
    title: string,
    message: string
) => {
    const notif = await prisma.notification.create({
        data: {
            sender_id: senderId,
            receiver_id: receiverId,
            sender_profile: senderProfile,
            title,
            message,
            type: 'follow',
            type_id: senderId.toString(),
        },
    })
}
export const sendFollowNotification = async (
    registrationToken: string,
    payload: { title: string; body: string },
    senderId: string
) => {
    try {
        const message = {
            token: registrationToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
            data: {
                type: 'follow',
                senderId: senderId,
            },
        }

        const response = await admin.messaging().send(message)
        return response
    } catch (error) {
        console.error('Error sending message:', error)
    }
}
export const sendNotification = async (registrationToken: string, payload: { title: string; body: string }) => {
    try {
        const message = {
            token: registrationToken,
            notification: {
                title: payload.title,
                body: payload.body,
            },
        }

        const response = await admin.messaging().send(message)
        console.log('Successfully sent message:', response)
        return response
    } catch (error) {
        console.error('Error sending message:', error)
    }
}

export const getUserToken = async (userId: any) => {
    const user = await prisma.user.findUnique({ where: { id: Number(userId) }, select: { registrationToken: true } })
    return user ? user.registrationToken : null
}

// async function updatePass(username: string) {
//     const SALT_ROUND = process.env.SALT_ROUND!
//     const ITERATION = 100
//     const KEYLENGTH = 10
//     const DIGEST_ALGO = 'sha512'
//     const user = await prisma.user.findUnique({ where: { username: username } })
//     if (!user) {
//         return
//     }
//     const newpass = 'password'
//     let hash_new_password: string | Buffer = crypto.pbkdf2Sync(
//         newpass,
//         SALT_ROUND,
//         ITERATION,
//         KEYLENGTH,
//         DIGEST_ALGO
//     )
//     hash_new_password = hash_new_password.toString('hex')
//     const updated = await prisma.user.update({ where: { username: username }, data: { password: hash_new_password } })
// }

// updatePass('js nikhil verma');

cron.schedule('0 0 * * *', async () => {
    console.log('Running your daily task...')

    try {
        const trips = await prisma.trip.findMany({})
        const customTrips = await prisma.customTrip.findMany({})

        for (const trip of trips) {
            const startDate = new Date(trip.start_date)
            const endDate = new Date(trip.end_date)
            const today = new Date()

            if (trip.cancelled) {
                await prisma.trip.update({
                    where: { id: trip.id },
                    data: { status: 'cancelled' },
                })
            } else if (endDate < today) {
                await prisma.trip.update({
                    where: { id: trip.id },
                    data: { status: 'completed' },
                })
                await prisma.user.update({
                    where: { id: trip.user_id },
                    data: { status: false },
                })
            } else if (startDate < today && today < endDate) {
                await prisma.trip.update({
                    where: { id: trip.id },
                    data: { status: 'ongoing' },
                })
                await prisma.user.update({
                    where: { id: trip.user_id },
                    data: { status: true },
                })
            } else {
                await prisma.trip.update({
                    where: { id: trip.id },
                    data: { status: 'upcoming' },
                })
            }
        }
        for (const customTrip of customTrips) {
            const startDate = new Date(customTrip.start_date)
            const endDate = new Date(customTrip.end_date)
            const today = new Date()

            if (customTrip.cancelled) {
                await prisma.customTrip.update({
                    where: { id: customTrip.id },
                    data: { status: 'cancelled' },
                })
            } else if (endDate < today) {
                await prisma.customTrip.update({
                    where: { id: customTrip.id },
                    data: { status: 'completed' },
                })
                await prisma.user.update({
                    where: { id: customTrip.user_id },
                    data: { status: false },
                })
            } else if (startDate < today && today < endDate) {
                await prisma.customTrip.update({
                    where: { id: customTrip.id },
                    data: { status: 'ongoing' },
                })
                await prisma.user.update({
                    where: { id: customTrip.user_id },
                    data: { status: true },
                })
            } else {
                await prisma.customTrip.update({
                    where: { id: customTrip.id },
                    data: { status: 'upcoming' },
                })
            }
        }
        console.log('Trip statuses updated successfully.')
    } catch (error) {
        console.error('Error updating trip statuses:', error)
    }
})

cron.schedule('30 0 * * *', async () => {
    console.log('Running trips notifications...')
    try {
        const trips = await prisma.trip.findMany({})
        const customTrips = await prisma.customTrip.findMany({})
        const allTrips = [...trips, ...customTrips]
        const upcomingTrips = allTrips.filter((trip) => trip.status === 'upcoming')
        const ongoingTrips = allTrips.filter((trip) => trip.status === 'ongoing')
        const ezio = await prisma.user.findUnique({ where: { id: 3 } })

        for (const trip of upcomingTrips) {
            const startDate = new Date(trip.start_date)
            const today = new Date()

            if (startDate.getDate() - today.getDate() === 1) {
                const user = await prisma.user.findUnique({ where: { id: trip.user_id } })
                if (user) {
                    const registrationToken = user.registrationToken
                    const payload = {
                        title: 'Trip Alert',
                        body: `Your journey starts tomorrow! Get ready for an adventure.`,
                    }
                    sendNotif(3, trip.user_id, ezio?.image ?? '', payload.title, payload.body)
                    if (registrationToken) await sendNotification(registrationToken, payload)
                }
            }
        }

        for (const trip of ongoingTrips) {
            const startDate = new Date(trip.start_date)
            const today = new Date()
            if (startDate.getDate() === today.getDate()) {
                const user = await prisma.user.findUnique({ where: { id: trip.user_id } })
                if (user) {
                    const registrationToken = user.registrationToken
                    const payload = {
                        title: 'Trip Alert',
                        body: `Your journey starts today!`,
                    }
                    sendNotif(3, trip.user_id, ezio?.image ?? '', payload.title, payload.body)
                    if (registrationToken) await sendNotification(registrationToken, payload)
                }
            }
        }

        console.log('User statuses updated successfully.')
    } catch (error) {
        console.error('Error updating user statuses:', error)
    }
})

cron.schedule('0 0 * * *', async () => {
    console.log('deleting notifications');
    const notifications = await prisma.notification.findMany()
    for await (const notification of notifications) {
        if(notification.created_at < new Date(Date.now() - 7*24*60*60*1000)){
            await prisma.notification.delete({where: {id: notification.id}})
        }
    }
});

app.use(middleware.ErrorHandler)

const privateKey = fs.readFileSync('/home/ubuntu/privkey.pem', 'utf8')
const certificate = fs.readFileSync('/home/ubuntu/cert.pem', 'utf8')
const ca = fs.readFileSync('/home/ubuntu/chain.pem', 'utf8')

// const credentials = {
//     key: privateKey,
//     cert: certificate,
//     ca: ca,
// }

const credentials = {
    key : fs.readFileSync('/home/ubuntu/privkey.pem', 'utf8'),
    cert: fs.readFileSync('/home/ubuntu/cert.pem',    'utf8'),
    ca  : fs.readFileSync('/home/ubuntu/chain.pem',   'utf8')
        .split(/(?=-----BEGIN CERTIFICATE-----)/gm),
  };

const httpsServer = https.createServer(credentials, app)

const io = new Server(httpsServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    // path: '/socket.io',
})

export const getReceiverSocketId = (receiverId: string) => {
    return userSocketMap[receiverId]
}

const userSocketMap: { [key: string]: string } = {}

io.on('connection', (socket) => {
    console.log('user connected', socket.id)
    const userId = socket.handshake.query.userId
    if (typeof userId === 'string') {
        userSocketMap[userId] = socket.id
    }

    io.emit('getOnlineUsers', Object.keys(userSocketMap))

    socket.on('disconnect', () => {
        console.log('user disconnected', socket.id)
        for (const key in userSocketMap) {
            if (userSocketMap[key] === socket.id) {
                delete userSocketMap[key]
            }
        }
        io.emit('getOnlineUsers', Object.keys(userSocketMap))
    })
})

const httpApp = express()
httpApp.use((req, res) => {
    res.redirect(`https://${req.headers.host}${req.url}`)
})
const httpServer = http.createServer(httpApp)

app.all('*', (_req, res) => {
    res.status(200).send({
        status: 404,
        error: 'Not found',
        error_description: `(${_req.url}), route or file not found.`,
    })
})

export default httpsServer
export { io, httpsServer, httpServer }
