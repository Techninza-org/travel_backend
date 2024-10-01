import { type NextFunction, type Request, type Response } from 'express'
import helper from '../utils/helpers'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'
const prisma = new PrismaClient()

const SALT_ROUND = process.env.SALT_ROUND!
const ITERATION = 100
const KEYLENGTH = 10
const DIGEST_ALGO = 'sha512'

const Login = async (req: Request, res: Response, next: NextFunction) => {
    const body = req.body
    const isValidPayload = helper.isValidatePaylod(body, ['username', 'password'])
    if (!isValidPayload) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'username, password are requried.' })
    }
    let hash_password: string | Buffer = crypto.pbkdf2Sync(
        body?.password,
        SALT_ROUND,
        ITERATION,
        KEYLENGTH,
        DIGEST_ALGO
    )
    hash_password = hash_password.toString('hex')
    try {
        const userDetails = await prisma.user.findUnique({
            where: { username: body.username, password: hash_password },
        })
        if (!userDetails) {
            return res.status(200).send({
                status: 200,
                error: 'Invalid credentials.',
                error_description: 'username or password is not valid',
            })
        }
        //update registration token
        if (body.registrationToken) {
            await prisma.user.update({
                where: { id: userDetails.id },
                data: { registrationToken: body.registrationToken },
            })
        }
        delete (userDetails as any).password
        const token = jwt.sign({ phone: userDetails.phone }, process.env.JWT_SECRET!, {
            expiresIn: '7d',
        })

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            user: { ...userDetails, token },
        })
    } catch (err) {
        return res.status(200).send({
            status: 200,
            error: 'Invalid credentials.',
            error_description: (err as any).message,
        })
    }
}

// TODO Incomplete
const ForgotPassword = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { email, password } = req.body
        if (!helper.isValidatePaylod(req.body, ['email', 'password'])) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid Payload', error_description: 'email, password are required.' })
        }
        let hash_password: string | Buffer = crypto.pbkdf2Sync(password, SALT_ROUND, ITERATION, KEYLENGTH, DIGEST_ALGO)
        hash_password = hash_password.toString('hex')
        await prisma.user.update({
            where: { email },
            data: { password: hash_password },
        })
        return res.status(200).send({ status: 200, message: 'Ok' })
    } catch (err) {
        return next(err)
    }
}

const Signup = async (req: Request, res: Response, next: NextFunction) => {
    const body = req.body
    if (!helper.isValidatePaylod(body, ['phone', 'username', 'password', 'email'])) {
        return res.status(200).send({
            status: 400,
            error: 'Invalid Payload',
            error_description: 'username, phone, password, email are requried.',
        })
    }
    const { phone, password, username, referredByCode, email } = req.body
    try {
        const isUsernameExists = await prisma.user.findFirst({ where: { username } })
        if (isUsernameExists) {
            return res
                .status(200)
                .send({ status: 400, error: 'BAD REQUEST', error_description: 'username already exists.' })
        }
        const isPhoneExists = await prisma.user.findFirst({ where: { phone } })
        if (isPhoneExists) {
            return res
                .status(200)
                .send({ status: 400, error: 'BAD REQUEST', error_description: 'phone already exists.' })
        }
        const isEmailExists = await prisma.user.findFirst({ where: { email } })
        if (isEmailExists) {
            return res
                .status(200)
                .send({ status: 400, error: 'BAD REQUEST', error_description: 'email already exists.' })
        }
    } catch (err) {
        return next(err)
    }

    function generateReferralCode() {
        return 'EZI' + Math.floor(1000 + Math.random() * 9000) + username.slice(0, 3).toUpperCase()
    }
    const referralCode = generateReferralCode()

    crypto.pbkdf2(password, SALT_ROUND, ITERATION, KEYLENGTH, DIGEST_ALGO, (err, hash_password: Buffer | string) => {
        hash_password = hash_password.toString('hex')
        if (err) return next(err)
        else {
            prisma.user
                .create({
                    data: {
                        phone,
                        password: hash_password,
                        email: email,
                        username,
                        referredByCode: referredByCode,
                        userReferralCode: referralCode,
                        registrationToken: body.registrationToken,
                    },
                })
                .then((createdUser) => {
                    const userId = createdUser.id
                    return prisma.follows.create({
                        data: {
                            user_id: 3,
                            follower_id: userId,
                        },
                    })
                })
                .then((follow) => {
                    return res.status(201).send({ status: 201, message: 'Created' })
                })
                .catch((err) => {
                    return next(err)
                })
        }
    })
}

const SendOtp = async (req: Request, res: Response, _next: NextFunction) => {
    if (!helper.isValidatePaylod(req.body, ['email'])) {
        return res.status(200).send({ status: 400, error: 'Invalid Payload', error_description: 'Email requried' })
    }
    const { email } = req.body
    const otp = Math.floor(10000 + Math.random() * 90000)
    // const otp = 1234
    const user = await prisma.user.findFirst({ where: { email } })
    console.log(user)

    if (!user) return res.status(200).send({ status: 404, error: 'Not found', error_description: 'user not found' })
    const previousSendOtp = await prisma.otp.findUnique({ where: { user_id: user.id } })
    const userid = user.id
    if (!previousSendOtp) {
        try {
            const otpData = await prisma.otp.create({ data: { user_id: userid, otp: otp } })
            helper.sendMail(email, 'EzioTravels Account Verification', `Your OTP is ${otp}`)
        } catch (err) {
            return _next(err)
        }
        return res.status(200).send({ status: 200, message: 'Ok' })
    } else {
        try {
            const otpData = await prisma.otp.update({ where: { user_id: userid }, data: { otp: otp } })
            helper.sendMail(email, 'EzioTravels Account Verification', `Your OTP is ${otp}`)
        } catch (err) {
            return _next(err)
        }
        return res.status(200).send({ status: 200, message: 'Ok' })
    }
}

/**
 * controller to verify otp from Otp using Otp and email table
 * Every otp will exipred after 5 minute
 * @param req
 * @param res
 * @param next
 * @returns responses
 */
const VerifyOtp = async (req: Request, res: Response, next: NextFunction) => {
    const { email, otp } = req.body
    if (!helper.isValidatePaylod(req.body, ['email', 'otp'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'email, otp are required.' })
    }
    const user = await prisma.user.findFirst({ where: { email } })
    if (!user)
        return res
            .status(200)
            .send({ status: 400, error: 'user not found.', error_description: `No user with ${email}` })
    const otpData = await prisma.otp.findUnique({ where: { user_id: user.id } })
    if (!otpData) {
        return res.status(200).send({ error: 'Bad Request', error_description: 'OTP is not valid.' })
    }
    if (otpData?.otp === otp) {
        const otpExpirationTime = new Date(otpData.updated_at).setMinutes(new Date().getMinutes() + 5)
        if (otpExpirationTime < new Date().getTime()) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'OTP is expired.' })
        }
        try {
            const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { is_verified: true } })
            const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET!, {
                expiresIn: '7d',
            })
            return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser, token })
        } catch (err) {
            return next(err)
        }
    } else {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'OTP is not valid.' })
    }
}

const HostLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body

        if (!helper.isValidatePaylod(body, ['username', 'password'])) {
            return res.status(400).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'username, password are requried.',
            })
        }
        const userDetails = await prisma.host.findUnique({
            where: { username: body.username, password: body.password },
        })

        if (!userDetails) {
            return res.status(400).send({
                status: 400,
                error: 'Invalid credentials.',
                error_description: 'username or password is not valid',
            })
        }
        const token = jwt.sign({ phone: userDetails.phone }, process.env.JWT_SECRET!, {
            expiresIn: '7d',
        })

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            user: {
                username: userDetails.username,
                name: userDetails.name,
                id: userDetails.id,
                photo: userDetails.photo,
            },
            token: token,
        })
    } catch (err) {
        return next(err)
    }
}

const socialLogin = async (req: Request, res: Response, next: NextFunction) => {
    const body = req.body
    if (!helper.isValidatePaylod(body, ['email', 'password'])) {
        return res.status(200).send({
            status: 400,
            error: 'Invalid Payload',
            error_description: 'email, password are requried.',
        })
    }
    const { email, password } = body
    let hash_password: string | Buffer = crypto.pbkdf2Sync(
        body?.password,
        SALT_ROUND,
        ITERATION,
        KEYLENGTH,
        DIGEST_ALGO
    )
    hash_password = hash_password.toString('hex')
    const userDetails = await prisma.user.findUnique({
        where: { email: body.email, password: hash_password },
    })

    if (userDetails) {
        delete (userDetails as any).password
        const token = jwt.sign({ email: userDetails.email }, process.env.JWT_SECRET!, {
            expiresIn: '7d',
        })

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            user: userDetails,
            token,
        })
    }
    return socialSignUp(req, res, next, email, password)
}

const socialSignUp = async (req: Request, res: Response, next: NextFunction, email: string, password: string) => {
    let isAlreadyExists: any = false
    try {
        isAlreadyExists = await prisma.user.findFirst({ where: { email } })
    } catch (err) {
        return next(err)
    }
    if (isAlreadyExists) {
        return res.status(200).send({ status: 400, error: 'BAD REQUEST', error_description: 'user already exists.' })
    }
    const token = jwt.sign({ email: email }, process.env.JWT_SECRET!, {
        expiresIn: '7d',
    })
    function generateReferralCode() {
        return 'EZI' + Math.floor(1000 + Math.random() * 9000) + email.slice(0, 3).toUpperCase()
    }
    const referralCode = generateReferralCode()
    crypto.pbkdf2(password, SALT_ROUND, ITERATION, KEYLENGTH, DIGEST_ALGO, (err, hash_password: Buffer | string) => {
        hash_password = hash_password.toString('hex')
        if (err) return next(err)
        else {
            prisma.user
                .create({
                    data: {
                        email,
                        password: hash_password,
                        userReferralCode: referralCode,
                        isSocialLogin: true,
                    },
                })
                .then((createdUser) => {
                    const userId = createdUser.id
                    return prisma.follows.create({
                        data: {
                            user_id: 2,
                            follower_id: userId,
                        },
                    })
                })
                .then((follow) => {
                    return res.status(201).send({ status: 201, message: 'Created', token })
                })
                .catch((err) => {
                    return next(err)
                })
        }
    })
}

const superAdminLogin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body

        if (!helper.isValidatePaylod(body, ['username', 'password'])) {
            return res.status(400).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'username, password are requried.',
            })
        }
        const userDetails = await prisma.superAdmin.findUnique({
            where: { username: body.username, password: body.password },
        })

        if (!userDetails) {
            return res.status(400).send({
                status: 400,
                error: 'Invalid credentials.',
                error_description: 'username or password is not valid',
            })
        }
        const token = jwt.sign({ phone: userDetails.phone }, process.env.JWT_SECRET!, {
            expiresIn: '7d',
        })

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            user: {
                username: userDetails.username,
            },
            token: token,
        })
    } catch (err) {
        return next(err)
    }
}

const SendOtpPhone = async (req: Request, res: Response, _next: NextFunction) => {
    if (!helper.isValidatePaylod(req.body, ['phone'])) {
        return res.status(200).send({ status: 400, error: 'Invalid Payload', error_description: 'phone requried' })
    }
    const { phone } = req.body
    // const otp = Math.floor(10000 + Math.random() * 90000)
    const otp = 1234
    const user = await prisma.user.findFirst({ where: { phone } })
    if (!user) return res.status(200).send({ status: 404, error: 'Not found', error_description: 'user not found' })
    const previousSendOtp = await prisma.otp.findUnique({ where: { user_id: user.id } })
    const userid = user.id
    if (!previousSendOtp) {
        try {
            const otpData = await prisma.otp.create({ data: { user_id: userid, otp: otp } })
            // helper.sendMail(phone , 'TravelApp Acco-unt Verification', `Your OTP is ${otp}`)
        } catch (err) {
            return _next(err)
        }
        return res.status(200).send({ status: 200, message: 'Ok' })
    } else {
        try {
            const otpData = await prisma.otp.update({ where: { user_id: userid }, data: { otp: otp } })
            // helper.sendMail(phone , 'TravelApp Account Verification', `Your OTP is ${otp}`)
        } catch (err) {
            return _next(err)
        }
        return res.status(200).send({ status: 200, message: 'Ok' })
    }
}

/**
 * controller to verify otp from Otp using Otp and email table
 * Every otp will exipred after 5 minute
 * @param req
 * @param res
 * @param next
 * @returns responses
 */
const VerifyOtpPhone = async (req: Request, res: Response, next: NextFunction) => {
    const { phone, otp } = req.body
    if (!helper.isValidatePaylod(req.body, ['phone', 'otp'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'phone, otp are required.' })
    }
    const user = await prisma.user.findFirst({ where: { phone } })
    if (user?.is_verified) {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'User already verified' })
    }
    if (!user)
        return res
            .status(200)
            .send({ status: 400, error: 'user not found.', error_description: `No user with ${phone}` })
    const otpData = await prisma.otp.findUnique({ where: { user_id: user.id } })
    if (!otpData) {
        return res.status(200).send({ error: 'Bad Request', error_description: 'OTP is not valid.' })
    }
    if (otpData?.otp === otp) {
        const otpExpirationTime = new Date(otpData.updated_at).setMinutes(new Date().getMinutes() + 5)
        if (otpExpirationTime < new Date().getTime()) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'OTP is expired.' })
        }
        try {
            const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { is_verified: true } })
            const token = jwt.sign({ phone: user.phone }, process.env.JWT_SECRET!, {
                expiresIn: '7d',
            })
            return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser, token })
        } catch (err) {
            return next(err)
        }
    } else {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'OTP is not valid.' })
    }
}

const getBlogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blogs = await prisma.blog.findMany()
        return res.status(200).send({ status: 200, message: 'Ok', blogs })
    } catch (err) {
        return next(err)
    }
}

const getBlogById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blog = await prisma.blog.findUnique({ where: { slug: String(req.params.slug) } })
        return res.status(200).send({ status: 200, message: 'Ok', blog })
    } catch (err) {
        return next(err)
    }
}

const getRecentBlogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blogs = await prisma.blog.findMany({ take: 5, orderBy: { created_at: 'desc' } })
        return res.status(200).send({ status: 200, message: 'Ok', blogs })
    } catch (err) {
        return next(err)
    }
}

const sendOTPPhone = async (req: Request, res: Response, next: NextFunction) => {
    const { phone, otp, username } = req.body

    if (!phone || !otp) {
        return res.status(400).json({ error: 'Phone number and OTP are required' })
    }

    try {
        const msg = `Dear ${username}, welcome to EZIO! Your OTP for completing the sign-up process is ${otp}. This OTP is valid for 10 minutes. Please do not share it with anyone.`
        const response = await axios.get('https://api.datagenit.com/sms', {
            params: {
                auth: 'D!~9969GozvD4fWD7', 
                senderid: 'DATAGN', 
                msisdn: phone,
                message: msg,   
            },
            headers: {
                'cache-control': 'no-cache',
            },
        })

        console.log(response.data)
        res.status(200).json({ message: 'OTP sent successfully'})
    } catch (error) {
        res.status(500).json({ error: 'Failed to send OTP' })
    }
}

const authController = {
    Login,
    ForgotPassword,
    Signup,
    SendOtp,
    VerifyOtp,
    HostLogin,
    socialLogin,
    superAdminLogin,
    SendOtpPhone,
    VerifyOtpPhone,
    getBlogs,
    getBlogById,
    getRecentBlogs,
    sendOTPPhone
}
export default authController
