import { type NextFunction, type Request, type Response } from 'express'
import helper from '../utils/helpers'
import crypto from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'
const prisma = new PrismaClient()
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../app'
import { OAuth2Client } from 'google-auth-library'
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const SALT_ROUND = process.env.SALT_ROUND!
const ITERATION = 100
const KEYLENGTH = 10
const DIGEST_ALGO = 'sha512'

const Login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const body = req.body
        const isValidPayload = helper.isValidatePaylod(body, ['username', 'password'])
        if (!isValidPayload) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'username, password are requried.' })
        }
        const { password } = req.body
        if (typeof password !== 'string') return res.status(400).send({ error: 'password must be a string' })
        let hash_password: string | Buffer = crypto.pbkdf2Sync(password, SALT_ROUND, ITERATION, KEYLENGTH, DIGEST_ALGO)
        hash_password = hash_password.toString('hex')
        try {
            const userDetails = await prisma.user.findUnique({
                where: { username: String(body.username), password: hash_password },
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
    } catch (err) {
        return next(err)
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
    try {
        const body = req.body
        if (!helper.isValidatePaylod(body, ['phone', 'username', 'password', 'email'])) {
            return res.status(200).send({
                status: 400,
                error: 'Invalid Payload',
                error_description: 'username, phone, password, email are requried.',
            })
        }
        const { password, username, referredByCode } = req.body
        const phone = String(req.body.phone).trim()
        const email = String(req.body.email).trim()

        if (username.length > 25) {
            return res.status(400).send({ status: 400, error: 'Username too long' })
        }

        const escapePattern = /^[\S]*$/
        if (!escapePattern.test(username)) {
            return res.status(400).send({ status: 400, error: 'Username cannot contain control characters' })
        }

        // const emojiPattern =
        //     /[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF\u1F900-\u1F9FF\u1FA70-\u1FAFF\u1F1E6-\u1F1FF]+/
        // if (emojiPattern.test(username)) {
        //     return res
        //         .status(400)
        //         .send({ status: 400, error: 'Bad Request', error_description: 'Username cannot contain emojis' })
        // }

        const phoneRegex = /^[0-9]{10}$/
        if (!phoneRegex.test(phone)) {
            return res.status(400).send({ status: 400, error: 'Invalid Phone number, 10 digits required' })
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).send({ status: 400, error: 'Invalid Email address' })
        }

        if (typeof password !== 'string') return res.status(400).send({ error: 'password should be a string' })
        if (password.includes(' ') || password.length < 7) {
            return res
                .status(400)
                .send({ status: 400, error: 'Password should not contain any spaces, minimum length 7 required' })
        }

        if (!escapePattern.test(password)) {
            return res.status(400).send({ status: 400, error: 'Password cannot contain control characters' })
        }

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

        crypto.pbkdf2(
            password,
            SALT_ROUND,
            ITERATION,
            KEYLENGTH,
            DIGEST_ALGO,
            (err, hash_password: Buffer | string) => {
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
                            return res.status(201).send({ status: 201, message: 'Created but failed to follow ezio' })
                        })
                }
            }
        )
    } catch (err) {
        return next(err)
    }
}

const SendOtp = async (req: Request, res: Response, _next: NextFunction) => {
    try {
        if (!helper.isValidatePaylod(req.body, ['email'])) {
            return res.status(200).send({ status: 400, error: 'Invalid Payload', error_description: 'Email requried' })
        }
        const { email } = req.body
        const otp = Math.floor(10000 + Math.random() * 90000)
        console.log(`email: ${email}, otp: ${otp}`)
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
    } catch (err) {
        return _next(err)
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
    try {
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
    } catch (err) {
        return next(err)
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



// Verify Google ID token
async function verifyGoogleToken(token: string) {
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error('Invalid Google token payload');
    }
    return payload;
  } catch (error) {
    throw new Error('Invalid Google token');
  }
}

// Google Sign In
const socialLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        status: 400,
        error: 'Google token required',
        error_description: 'Please provide a valid Google ID token'
      });
    }

    // Verify Google token
    const googleUser = await verifyGoogleToken(token);
    
    if (!googleUser.email || !googleUser.email_verified) {
      return res.status(400).json({
        status: 400,
        error: 'Invalid Google account',
        error_description: 'Email must be verified with Google'
      });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: googleUser.email }
    });

    if (existingUser) {
      // User exists - sign in (regardless of how they originally signed up)
      
      // Update user info if needed
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          image: googleUser.picture || existingUser.image,
          isSocialLogin: true, // Mark as social login user
          updated_at: new Date()
        }
      });

      delete (updatedUser as any).password;
      
      const jwtToken = jwt.sign(
        { 
          id: updatedUser.id,
          email: updatedUser.email,
          type: 'google'
        }, 
        process.env.JWT_SECRET!, 
        { expiresIn: '7d' }
      );

      return res.status(200).json({
        status: 200,
        message: 'Sign in successful',
        user: updatedUser,
        token: jwtToken
      });
    } else {
      // User doesn't exist - create new account
      return googleSignUp(req, res, next, googleUser);
    }
  } catch (error) {
    console.error('Google sign in error:', error);
    return res.status(500).json({
      status: 500,
      error: 'Authentication failed',
      error_description: 'Unable to authenticate with Google'
    });
  }
};

// Google Sign Up
const googleSignUp = async (req: Request, res: Response, next: NextFunction, googleUser: any) => {
  try {
    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: googleUser.email }
    });

    if (existingUser) {
      return res.status(400).json({
        status: 400,
        error: 'User already exists',
        error_description: 'An account with this email already exists'
      });
    }

    // Generate referral code
    function generateReferralCode() {
      return 'EZI' + Math.floor(1000 + Math.random() * 9000) + googleUser.email.slice(0, 3).toUpperCase();
    }

    const referralCode = generateReferralCode();

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        email: googleUser.email,
        username: googleUser.name || googleUser.email.split('@')[0],
        image: googleUser.picture,
        userReferralCode: referralCode,
        isSocialLogin: true,
        is_verified: googleUser.email_verified || false,
        password: '', // Empty password for social login users
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    // Create follow relationship with default user (ID: 2)
    await prisma.follows.create({
      data: {
        user_id: 3,
        follower_id: newUser.id,
      }
    });

    delete (newUser as any).password;

    const jwtToken = jwt.sign(
      { 
        id: newUser.id,
        email: newUser.email,
        type: 'google'
      }, 
      process.env.JWT_SECRET!, 
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      status: 201,
      message: 'Account created successfully',
      user: newUser,
      token: jwtToken
    });

  } catch (error) {
    console.error('Google sign up error:', error);
    return res.status(500).json({
      status: 500,
      error: 'Registration failed',
      error_description: 'Unable to create account'
    });
  }
};

  
// const socialLogin = async (req: Request, res: Response, next: NextFunction) => {
//     try {
//         const body = req.body
//         if (!helper.isValidatePaylod(body, ['email', 'password'])) {
//             return res.status(200).send({
//                 status: 400,
//                 error: 'Invalid Payload',
//                 error_description: 'email, password are requried.',
//             })
//         }
//         const { email, password } = body
//         const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
//         if (!emailRegex.test(email)) {
//             return res.status(400).send({ status: 400, error: 'Invalid Email address' })
//         }
//         if (email.length > 74) {
//             return res.status(400).send({ status: 400, error: 'Invalid Email address' })
//         }
//         if (typeof password !== 'string') return res.status(400).send({ error: 'password must be a string' })
//         if (password.includes(' ') || password.length < 7 || password.length > 16) {
//             return res.status(400).send({
//                 status: 400,
//                 error: 'Password should not contain any spaces, minimum length 7, maximum 16 required',
//             })
//         }
//         const escapePattern = /^[\S]*$/
//         if (!escapePattern.test(password)) {
//             return res.status(400).send({ status: 400, error: 'Password cannot contain control characters' })
//         }
//         let hash_password: string | Buffer = crypto.pbkdf2Sync(
//             body?.password,
//             SALT_ROUND,
//             ITERATION,
//             KEYLENGTH,
//             DIGEST_ALGO
//         )
//         hash_password = hash_password.toString('hex')
//         const userDetails = await prisma.user.findUnique({
//             where: { email: body.email, password: hash_password },
//         })

//         if (userDetails) {
//             delete (userDetails as any).password
//             const token = jwt.sign({ email: userDetails.email }, process.env.JWT_SECRET!, {
//                 expiresIn: '7d',
//             })

//             return res.status(200).send({
//                 status: 200,
//                 message: 'Ok',
//                 user: userDetails,
//                 token,
//             })
//         }
//         return socialSignUp(req, res, next, email, password)
//     } catch (err) {
//         return next(err)
//     }
// }

const socialSignUp = async (req: Request, res: Response, next: NextFunction, email: string, password: string) => {
    try {
        let isAlreadyExists: any = false
        try {
            isAlreadyExists = await prisma.user.findFirst({ where: { email } })
        } catch (err) {
            return next(err)
        }
        if (isAlreadyExists) {
            return res
                .status(200)
                .send({ status: 400, error: 'BAD REQUEST', error_description: 'user already exists.' })
        }
        const token = jwt.sign({ email: email }, process.env.JWT_SECRET!, {
            expiresIn: '7d',
        })
        function generateReferralCode() {
            return 'EZI' + Math.floor(1000 + Math.random() * 9000) + email.slice(0, 3).toUpperCase()
        }
        const referralCode = generateReferralCode()
        crypto.pbkdf2(
            password,
            SALT_ROUND,
            ITERATION,
            KEYLENGTH,
            DIGEST_ALGO,
            (err, hash_password: Buffer | string) => {
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
                                    user_id: 3,
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
            }
        )
    } catch (err) {
        return next(err)
    }
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
        const {username, password} = body
        if(typeof username !== 'string' || username === 'null'){
            return res.status(400).send({error: "Invalid username"})
        }
        if(typeof password !== 'string' ){
            return res.status(400).send({error: "Invalid password"})
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
    try {
        if (!helper.isValidatePaylod(req.body, ['phone'])) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid Payload', error_description: 'phone is requried, 10 digits only' })
        }
        const { phone } = req.body
        if (typeof phone !== 'string') return res.status(400).json({ msg: 'phone should be string' })
        const otp = Math.floor(1000 + Math.random() * 9000)

        console.log(`phone: ${phone}, otp: ${otp}`)
        const user = await prisma.user.findFirst({ where: { phone } })
        if (!user) return res.status(200).send({ status: 404, error: 'Not found', error_description: 'user not found' })
        const previousSendOtp = await prisma.otp.findUnique({ where: { user_id: user.id } })
        const userid = user.id
        if (!previousSendOtp) {
            try {
                const otpData = await prisma.otp.create({ data: { user_id: userid, otp: otp } })
                const msg = `Dear ${user.username}, welcome to EZIO! Your OTP for completing the sign-up process is ${otp}. This OTP is valid for 10 minutes. Please do not share it with anyone.`
                const response = await axios.get('https://api.datagenit.com/sms', {
                    params: {
                        auth: 'D!~9969GozvD4fWD7',
                        senderid: 'EZITVL',
                        msisdn: phone,
                        message: msg,
                    },
                    headers: {
                        'cache-control': 'no-cache',
                    },
                })

                console.log(`phone service response: ${response.data}`)
            } catch (err) {
                return _next(err)
            }
            return res.status(200).send({ status: 200, message: 'Otp sent successfully' })
        } else {
            try {
                const otpData = await prisma.otp.update({ where: { user_id: userid }, data: { otp: otp } })
                const msg = `Dear ${user.username}, welcome to EZIO! Your OTP for completing the sign-up process is ${otp}. This OTP is valid for 10 minutes. Please do not share it with anyone.`
                const response = await axios.get('https://api.datagenit.com/sms', {
                    params: {
                        auth: 'D!~9969GozvD4fWD7',
                        senderid: 'EZITVL',
                        msisdn: phone,
                        message: msg,
                    },
                    headers: {
                        'cache-control': 'no-cache',
                    },
                })

                console.log(`phone service response: ${response.data}`)
            } catch (err) {
                return _next(err)
            }
            return res.status(200).send({ status: 200, message: 'Otp sent successfully' })
        }
    } catch (err) {
        return _next(err)
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
    try {
        const { phone, otp } = req.body
        if (!helper.isValidatePaylod(req.body, ['phone', 'otp'])) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'phone, otp are required.' })
        }
        const user = await prisma.user.findFirst({ where: { phone } })
        if (user?.is_verified) {
            return res.status(201).send({ status: 201, msg: 'User already verified' })
        }
        if (!user)
            return res
                .status(200)
                .send({ status: 400, error: 'user not found.', error_description: `No user with ${phone}` })
        const otpData = await prisma.otp.findUnique({ where: { user_id: user.id } })
        if (!otpData) {
            return res.status(400).send({ error: 'Bad Request', error_description: 'OTP is not valid.', invalidOtp: true, status: 400 })
        }
        if (otpData?.otp === otp) {
            const otpExpirationTime = new Date(otpData.updated_at).setMinutes(new Date().getMinutes() + 5)
            if (otpExpirationTime < new Date().getTime()) {
                return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'OTP is expired.' })
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
    } catch (err) {
        return next(err)
    }
}

const getBlogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const blogs = await prisma.blog.findMany({orderBy: { created_at: 'desc' }})
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
    try {
        const { phone, username } = req.body

        if (!phone || !username) {
            return res.status(400).json({ error: 'Phone number and username are required' })
        }

        const user = await prisma.user.findUnique(phone)
        if (!user) {
            return res.status(400).json({ message: 'User not found', status: 400 })
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const otpExpiry = new Date(Date.now() + 5 * 60000)

        try {
            const msg = `Dear ${username}, welcome to EZIO! Your OTP for completing the sign-up process is ${otp}. This OTP is valid for 10 minutes. Please do not share it with anyone.`
            const response = await axios.get('https://api.datagenit.com/sms', {
                params: {
                    auth: 'D!~9969GozvD4fWD7',
                    senderid: 'EZITVL',
                    msisdn: phone,
                    message: msg,
                },
                headers: {
                    'cache-control': 'no-cache',
                },
            })

            console.log(response.data)
            res.status(200).json({ message: 'OTP sent successfully', response: response.data })
        } catch (error) {
            res.status(500).json({ error: 'Failed to send OTP' })
        }
    } catch (err) {
        return next(err)
    }
}

const uploadImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'No image provided' })
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
        
      
        const url =  `https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`;
         
        return res.status(200).send({ status: 200, url })
    } catch (err) {
        return next(err)
    }
}

const facebookCallback = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { code } = req.query;

        const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
          params: {
            client_id: process.env.APP_ID!,
            client_secret: process.env.APP_SECRET!,
            redirect_uri: 'https://eziotravels.com/api/auth/facebook/callback',
            code,
          },
        });
      
        const accessToken = tokenRes.data.access_token;
      
        const userRes = await axios.get('https://graph.facebook.com/me', {
          params: {
            fields: 'id,name,email',
            access_token: accessToken,
          },
        });
      
        const fbUser = userRes.data;
        console.log(fbUser, 'user');
        if (!fbUser.email) {
            return res.status(400).json({ error: 'Email is required for authentication' });
        }
        const existingUser = await prisma.user.findUnique({ where: { email: fbUser.email } });
        if (!existingUser) {
            const isUsernameExists = await prisma.user.findFirst({ where: { username: fbUser.name } })
            if (isUsernameExists) {
                return res
                    .status(200)
                    .send({ status: 400, error: 'BAD REQUEST', error_description: 'username already exists.' })
            }
           
            const isEmailExists = await prisma.user.findFirst({ where: { email: fbUser.email } })
            if (isEmailExists) {
                return res
                    .status(200)
                    .send({ status: 400, error: 'BAD REQUEST', error_description: 'email already exists.' })
            }
            const referralCode = `EZI${Math.floor(1000 + Math.random() * 9000)}${fbUser.name.slice(0, 3).toUpperCase()}`;
            const newUser = await prisma.user.create({
                data: {
                    email: fbUser.email,
                    username: fbUser.name,
                    userReferralCode: referralCode,
                    isSocialLogin: true,
                    password: fbUser.email + '@ezio' + fbUser.id,
                    fb_access_token: accessToken
                },
            });
            delete (newUser as any).password;
            const token = jwt.sign({ email: fbUser.email }, process.env.JWT_SECRET!, {
                expiresIn: '7d',
            });
            return res.json({ message: 'User created successfully', user: newUser, token });
        }else{
            delete (existingUser as any).password;
            
                await prisma.user.update({
                    where: { id: existingUser.id },
                    data: { fb_access_token: accessToken }
                });
            
            const token = jwt.sign({ email: existingUser.email }, process.env.JWT_SECRET!, {
                expiresIn: '7d',
            });
            return res.status(200).json({ message: 'User logged in successfully', user: existingUser, token });
        }
    } catch (err) {
        return next(err)
    }
}

const createQuoteQuery = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const {name, phone, number_of_people, packageId, start_date, source} = req.body;
        if(!name){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'name is required'});
        }
        if(!source || typeof source !== 'string'){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'source is required and should be a string'});
        }
        if(source !== 'APP' && source !== 'WEBSITE'){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'source should be either APP or WEBSITE'});

        }
        if(!phone){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'phone is required'});
        }
        if(!number_of_people){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'number_of_people is required'});
        }
        if(!packageId || isNaN(Number(packageId))){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'packageId is required and should be a number'});
        }
        if(!start_date){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'start_date is required and should be a valid date'});
        }
        const packageExists = await prisma.package.findUnique({
            where: { id: Number(packageId) },
        });
        if(!packageExists){
            return res.status(404).send({status: 404, error: 'Not Found', error_description: 'Package not found'});
        }
        const quoteQuery = await prisma.quote.create({
            data: {
                name,
                phone,
                number_of_people: Number(number_of_people),
                packageId: Number(packageId),
                start_date: start_date,
                source
            }
        });
        return res.status(200).send({status: 200, message: 'Quote query created successfully', quoteQuery});
    }catch(err){
        return next(err)
    }
}

const getBanners = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const banners = await prisma.banner.findMany();
        return res.status(200).send({ valid: true, banners });
    } catch (err) {
        return next(err);
    }
}

const authController = {
    getBanners,
    facebookCallback,
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
    sendOTPPhone,
    uploadImage,
    createQuoteQuery
}
export default authController
