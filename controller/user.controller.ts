import { NextFunction, Request, Response } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { Itinerary, PrismaClient } from '@prisma/client'
import helper from '../utils/helpers'
const prisma = new PrismaClient()
import crypto from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../app'
import { citiesDescription, getCityByCoordinates, getImgByPlaceName, getNearbyPlaces, marketplaceDetails, TripAdvisorCategory } from '../utils/marketplaceService'

const get_all_users = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const query = req.query
    const { page = 1, limit = 10 } = query

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
            error_description: 'Invalid Query Parameters. Page and limit must be positive integers.',
        })
    }

    const skip = (Number(page) - 1) * Number(limit)

    const MAX_LIMIT = 100
    const finalLimit = Math.min(Number(limit), MAX_LIMIT)

    try {
        const users = await prisma.user.findMany({
            skip: skip,
            take: finalLimit,
            where: { NOT: { id: req.user.id } },
        })

        const sanitizedUsers = users.map((user) => {
            const { password, ...safeUser } = user
            return safeUser
        })

        return res.status(200).send({ status: 200, message: 'Ok', users: sanitizedUsers })
    } catch (err) {
        return next(err)
    }
}

const get_user_feed = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const query = req.query
    const { page = 1, limit = 10 } = query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    if (isNaN(pageNum) || isNaN(limitNum)) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid query parameters',
            error_description: 'page and limit should be valid numbers',
        });
    }

    if (pageNum < 1) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid pagination',
            error_description: 'Page number must be greater than or equal to 1',
        });
    }

    if (limitNum < 1 || limitNum > 100) { 
        return res.status(400).send({
            status: 400,
            error: 'Invalid pagination',
            error_description: 'Limit must be between 1 and 100',
        });
    }

    if (!Number.isInteger(pageNum) || !Number.isInteger(limitNum)) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid pagination',
            error_description: 'Page and limit must be integers',
        });
    }

    const skip = (pageNum - 1) * limitNum;

    try {
        const userIdsObjArr = await prisma.follows.findMany({
            where: { follower_id: req.user.id },
            select: { user_id: true },
        })

        const userIds = userIdsObjArr.map((user) => user.user_id)

        const fetchPosts = await prisma.post.findMany({
            where: { user_id: { in: [...userIds, req.user.id] } },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        image: true,
                        status: true,
                    },
                },
                comment: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                image: true,
                                status: true,
                            },
                        },
                    },
                },
                filterName: true,
            },
            orderBy: { created_at: 'desc' },
            skip: skip,
            take: limitNum,
        })

        const likedPosts = await Promise.all(
            fetchPosts.map(async (post) => {
                const isLiked = await prisma.likes.findFirst({
                    where: { post_id: post.id, user_id: req.user.id },
                })
                return { ...post, isLiked: Boolean(isLiked) }
            })
        )

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            posts: likedPosts,
        })
    } catch (err) {
        console.error('Error fetching user feed:', err)
        return next(err)
    }
}

const get_user_details = (req: ExtendedRequest, res: Response, _next: NextFunction) => {
    const user = req.user

    if (!user) {
        return res.status(404).send({
            status: 404,
            error: 'User Not Found',
            error_description: 'No user details available.',
        })
    }

    const { password, ...userDetails } = user

    return res.status(200).send({
        status: 200,
        message: 'Ok',
        user: userDetails,
    })
}

const update_user = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    let {
        username,
        gender,
        date_of_birth,
        bio,
        emergency_name,
        emergency_phone,
        typeOfTraveller,
        email,
        background_image,
    } = req.body
    if (gender) {
        gender = Number(gender)
        if (Number.isNaN(gender)) {
            return res.status(200).send({
                status: 200,
                error: 'Invalid Payload',
                error_description: "Gender type isn't correct. It should be a number",
            })
        }
    }

    if (email) {
        const emailExists = await prisma.user.findFirst({ where: { email: email } })
        if (emailExists) {
            return res.status(200).send({
                status: 200,
                error: 'Invalid Payload',
                error_description: 'Email already exists',
            })
        }
    }

    if (username) {
        const userExists = await prisma.user.findFirst({ where: { username: username } })
        if (userExists && username !== user.username) {
            return res.status(200).send({
                status: 200,
                error: 'Invalid Payload',
                error_description: 'Username already exists',
            })
        }
    }

    if (typeOfTraveller) {
        typeOfTraveller = Number(typeOfTraveller)
        if (Number.isNaN(typeOfTraveller)) {
            return res
                .status(200)
                .send({ status: 400, error: 'Bad Request', error_description: 'Invalid type of traveller' })
        }
    }
    try {
        if (req.file) {
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
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                    username,
                    gender,
                    date_of_birth,
                    bio,
                    image: `https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`,
                    emergency_name,
                    emergency_phone,
                    typeOfTraveller,
                    email,
                    background_image,
                },
            })
            delete (updatedUser as any).password
            delete (updatedUser as any).emergency_name
            delete (updatedUser as any).emergency_phone
            return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser })
        } else {
            const updatedUser = await prisma.user.update({
                where: { id: user.id },
                data: {
                    username,
                    gender,
                    date_of_birth,
                    bio,
                    emergency_name,
                    emergency_phone,
                    typeOfTraveller,
                    email,
                    background_image,
                },
            })
            delete (updatedUser as any).password
            delete (updatedUser as any).emergency_name
            delete (updatedUser as any).emergency_phone
            return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser })
        }
    } catch (err) {
        return next(err)
    }
}

const update_user_bg = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
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
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
                background_image: `https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`,
            },
        })
        delete (updatedUser as any).password
        delete (updatedUser as any).emergency_name
        delete (updatedUser as any).emergency_phone
        return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser })
    } catch (err) {
        return next(err)
    }
}

const Get_follower = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    try {
        const followers = await prisma.follows.findMany({
            where: { user_id: user.id },
            select: {
                follower: {
                    select: {
                        id: true,
                        username: true,
                        image: true,
                        is_verified: true,
                    },
                },
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', followers: followers, count: followers.length })
    } catch (err) {
        return next(err)
    }
}

const GET_following = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    let followingCount = 0,
        following = []
    try {
        followingCount = await prisma.follows.count({ where: { follower_id: user.id } })
    } catch (err) {
        return next(err)
    }
    try {
        following = await prisma.follows.findMany({
            where: { follower_id: user.id },
            select: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        image: true,
                        is_verified: true,
                    },
                },
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', following: following, count: followingCount })
    } catch (err) {
        return next(err)
    }
}
const getSuggestion = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const query = req.query
    const { page = 1, limit = 10 } = query
    if (isNaN(Number(page)) || isNaN(Number(limit))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid Query Parameters' })
    }
    const skip = (Number(page) - 1) * Number(limit)
    try {
        const users = await prisma.user.findMany({
            skip: skip,
            take: Number(limit),
            where: { NOT: { id: req.user.id } },
            include: {
                _count: {
                    select: {
                        follows: true,
                    },
                },
            },
        })
        for (let i = 0; i < users.length; i++) {
            const user = users[i]
            const isFollowedByLiveUser = await prisma.follows.findFirst({
                where: { user_id: user.id, follower_id: req.user.id },
                select: {
                    follower_id: true,
                    user_id: true,
                },
            })
            // @ts-ignore
            users[i]['isFollows'] = isFollowedByLiveUser ? true : false
            //@ts-ignore
            users[i].followerCount = users[i]._count.Follows_by
            //@ts-ignore
            delete users[i]._count
        }
        delete (users as any).password
        delete (users as any).emergency_name
        delete (users as any).emergency_phone

        return res.status(200).send({ status: 200, message: 'Ok', users: users })
    } catch (err) {
        return next(err)
    }
}

const userTravelingStatus = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const { is_traveling } = req.body
    if (typeof is_traveling !== 'boolean') {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Boolean value required' })
    }
    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { status: is_traveling },
        })
        delete (updatedUser as any).password
        return res.status(200).send({ status: 200, message: 'Ok', user: { updatedUser } })
    } catch (err) {
        return next(err)
    }
}

const feedByPlace = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const place = req.params.place
    const user = req.user
    if (!place) {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Place is required' })
    }
    if (typeof place !== 'string') {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Place should be a string' })
    }
    try {
        const blockedUsers = await prisma.block.findMany({
            where: { user_id: user.id },
            select: {
                blocked_id: true,
            },
        })
        const blockedUserIds = blockedUsers.map((user) => user.blocked_id)
        const posts = await prisma.post.findMany({
            where: { place: { contains: place }, NOT: { user_id: { in: blockedUserIds } } },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        image: true,
                    },
                },
                comment: true,
            },
            orderBy: { created_at: 'desc' },
        })
        for (let i = 0; i < posts.length; i++) {
            const isLiked = await prisma.likes.findFirst({
                where: { post_id: posts[i].id, user_id: user.id },
            })
            //@ts-ignore
            posts[i].isLiked = isLiked ? true : false
        }
        return res.status(200).send({ status: 200, message: 'Ok', posts: posts })
    } catch (err) {
        return next(err)
    }
}

const getUsersByUsername = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const username = req.params.username
    const currentUserId = req.user.id

    if (!username || username === null || username === 'null') {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Username is required' })
    }
    if (typeof username !== 'string') {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Username should be a string' })
    }

    if (/\s/.test(username)) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Username should not contain spaces' })
    }

    if (username.length > 25) {
        return res.status(400).send({ status: 400, error: 'Username too long' })
    }

    const escapePattern = /^[\S]*$/
    if (!escapePattern.test(username)) {
        return res.status(400).send({ status: 400, error: 'Username cannot contain control characters' })
    }

    // const emojiPattern = /[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF\u1F900-\u1F9FF\u1FA70-\u1FAFF\u1F1E6-\u1F1FF]+/;
    // if (emojiPattern.test(username)) {
    //     return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Username cannot contain emojis' });
    // }

    try {
        let users = await prisma.user.findMany({
            where: { username: { contains: username } },
            select: {
                id: true,
                username: true,
                image: true,
                latitude: true,
                longitude: true,
                followers: true,
                status: true,
                followRequest: true,
            },
        })

        users = users.filter((user) => user.id !== currentUserId)

        const usersWithFollowingInfo = users.map((user) => ({
            id: user.id,
            username: user.username,
            image: user.image,
            latitude: user.latitude,
            longitude: user.longitude,
            followersCount: user.followers.length,
            isFollowing: user.followers.some((follow) => follow.follower_id === currentUserId),
            isRequested: user.followRequest.some(
                (request) => request.follower_id === currentUserId && request.status === 0
            ),
            status: user.status,
        }))

        return res.status(200).send({ status: 200, message: 'Ok', users: usersWithFollowingInfo })
    } catch (err) {
        return next(err)
    }
}

const visibleStatus = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const { visible } = req.body

    if (typeof visible !== 'boolean') {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Boolean value required' })
    }
    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { visible: visible },
        })
        delete (updatedUser as any).password
        return res.status(200).send({ status: 200, message: 'Ok', user: { updatedUser } })
    } catch (err) {
        return next(err)
    }
}

const blockUser = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const { blocked_user_id } = req.body

    if (blocked_user_id === undefined) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'blocked_user_id field is required',
        })
    }

    if (blocked_user_id === user.id) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'You cannot block youself',
        })
    }

    if (typeof blocked_user_id !== 'number' || !Number.isInteger(blocked_user_id) || blocked_user_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User ID should be a positive integer value',
        });
    }

    try {
        const userToBlock = await prisma.user.findUnique({
            where: { id: blocked_user_id },
        });

        if (!userToBlock) {
            return res.status(404).send({
                status: 404,
                error: 'Not Found',
                error_description: 'User to block does not exist',
            });
        }
        const isAlreadyFollowing = await prisma.follows.findFirst({
            where: { user_id: blocked_user_id, follower_id: user.id },
        })

        if (isAlreadyFollowing) {
            await prisma.follows.deleteMany({
                where: { user_id: blocked_user_id, follower_id: user.id },
            })
        }

        const isAlreadyBlocked = await prisma.block.findFirst({
            where: { user_id: user.id, blocked_id: blocked_user_id },
        })

        if (isAlreadyBlocked) {
            return res.status(200).send({
                status: 200,
                message: 'Ok',
                error: 'User already blocked',
            })
        }

        const blockedUser = await prisma.block.create({
            data: {
                user_id: user.id,
                blocked_id: blocked_user_id,
            },
        })

        return res.status(200).send({
            status: 200,
            message: 'User successfully blocked',
            blockedUser,
        })
    } catch (err) {
        console.error('Error blocking user:', err)
        return next(err)
    }
}

const unblockUser = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const { blocked_user_id } = req.body
    if (!blocked_user_id) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'blocked_user_id field is required' })
    }
    if (typeof blocked_user_id !== 'number' || !Number.isInteger(blocked_user_id) || blocked_user_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User ID should be a positive integer value',
        });
    }
    try {
        const blockedUser = await prisma.block.deleteMany({
            where: {
                user_id: user.id,
                blocked_id: blocked_user_id,
            },
        })
        return res.status(200).send({ status: 200, message: 'User unblocked successfully' })
    } catch (err) {
        return next(err)
    }
}

const getBlockedUsers = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    try {
        const blockedUsers = await prisma.block.findMany({
            where: { user_id: user.id },
            select: {
                blocked: {
                    select: {
                        id: true,
                        username: true,
                        image: true,
                    },
                },
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', blockedUsers: blockedUsers })
    } catch (err) {
        return next(err)
    }
}

const updateLatLong = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const { latitude, longitude } = req.body

    if (!latitude || !longitude) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Latitude and Longitude is required' })
    }
    if (isNaN(latitude) || isNaN(longitude)) {
        return res
            .status(400)
            .json({ status: 400, error: 'Bad Request', error_description: 'Latitude and Longitude should be a number' })
    }
    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { latitude: latitude, longitude: longitude },
        })
        delete (updatedUser as any).password
        return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser })
    } catch (err) {
        return next(err)
    }
}

const updateRegistrationToken = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const { registrationToken } = req.body
    if (!registrationToken) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Registration Token is required' })
    }
    if (typeof registrationToken !== 'string') {
        return res
            .status(400)
            .json({ status: 400, error: 'Bad Request', error_description: 'Registration Token should be a string' })
    }
    try {
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { registrationToken: registrationToken },
        })
        delete (updatedUser as any).password
        return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser })
    } catch (err) {
        return next(err)
    }
}

const getNearbyUsers = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user

    const { latitude, longitude } = user

    const blockedUsers = await prisma.block.findMany({
        where: { user_id: user.id },
        select: {
            blocked_id: true,
        },
    })

    const blockedUserIds = blockedUsers.map((user) => user.blocked_id)

    if (!latitude || !longitude) {
        return res
            .status(400)
            .json({ status: 400, error: 'Bad Request', error_description: 'Latitude and Longitude are required' })
    }

    if (isNaN(latitude) || isNaN(longitude)) {
        return res
            .status(400)
            .json({ status: 400, error: 'Bad Request', error_description: 'Latitude and Longitude should be a number' })
    }
    try {
        const nearbyUsers = await prisma.user.findMany({
            where: {
                AND: {
                    NOT: { id: { in: blockedUserIds } },
                    id: { not: user.id },
                    visible: true,
                    latitude: {
                        gt: latitude - 0.45,
                        lt: latitude + 0.45,
                    },
                    longitude: {
                        gt: longitude - 0.45,
                        lt: longitude + 0.45,
                    },
                },
            },
            select: {
                id: true,
                username: true,
                image: true,
                latitude: true,
                longitude: true,
                gender: true,
                status: true,
            },
        })

        return res.status(200).json({ status: 200, message: 'Ok', nearbyUsers })
    } catch (err) {
        return next(err)
    }
}

const deleteAccount = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    try {
        await prisma.user.delete({
            where: { id: user.id },
        })
        return res.status(200).json({ status: 200, message: 'Account deleted successfully' })
    } catch (err) {
        return next(err)
    }
}

const SALT_ROUND = process.env.SALT_ROUND!
const ITERATION = 100
const KEYLENGTH = 10
const DIGEST_ALGO = 'sha512'

const changePassword = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword } = req.body
    if (!helper.isValidatePaylod(req.body, ['oldPassword', 'newPassword'])) {
        return res.status(200).send({
            status: 400,
            error: 'Invalid payload',
            error_description: 'oldPassword, newPassword are required.',
        })
    }
    if (typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
        return res.status(200).send({
            status: 400,
            error: 'Invalid payload',
            error_description: 'oldPassword, newPassword should be a string.',
        })
    }
    let hash_old_password: string | Buffer = crypto.pbkdf2Sync(
        oldPassword,
        SALT_ROUND,
        ITERATION,
        KEYLENGTH,
        DIGEST_ALGO
    )
    hash_old_password = hash_old_password.toString('hex')
    let hash_new_password: string | Buffer = crypto.pbkdf2Sync(
        newPassword,
        SALT_ROUND,
        ITERATION,
        KEYLENGTH,
        DIGEST_ALGO
    )
    hash_new_password = hash_new_password.toString('hex')
    const user = await prisma.user.findFirst({ where: { id: req.user.id } })
    if (!user) {
        return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'User not found.' })
    }

    if (user.password !== hash_old_password) {
        return res.status(200).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Old password is not valid.',
        })
    }
    try {
        await prisma.user.update({ where: { id: user.id }, data: { password: hash_new_password } })
        return res.status(200).send({ status: 200, message: 'Ok' })
    } catch (err) {
        return next(err)
    }
}

const rateService = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { service_id, rating } = req.body
    if (!helper.isValidatePaylod(req.body, ['service_id', 'rating'])) {
        return res.status(200).send({
            status: 400,
            error: 'Invalid payload',
            error_description: 'service_id, rating are required.',
        })
    }
    if (isNaN(Number(service_id))) {
        return res.status(200).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Service Id should be a number.',
        })
    }
    if (isNaN(Number(rating))) {
        return res.status(200).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Rating should be a number.',
        })
    }
    if (rating < 1 || rating > 5) {
        return res.status(200).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Rating should be between 1 and 5.',
        })
    }
    try {
        const service = await prisma.service.findFirst({ where: { id: service_id } })
        if (!service) {
            return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'Service not found.' })
        }
        await prisma.service.update({
            where: { id: service_id },
            data: {
                rating: (service.rating + rating) / (service.rating_count + 1),
                rating_count: service.rating_count + 1,
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok' })
    } catch (err) {
        return next(err)
    }
}

const getUserFollowersFollowingById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const userId = Number(req.params.id)
    if (isNaN(userId)) {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Invalid user id' })
    }
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                followers: {
                    include: {
                        follower: {
                            select: {
                                id: true,
                                username: true,
                                image: true,
                                status: true,
                                is_verified: true,
                                followerRequest: { select: { status: true } },
                            },
                        },
                    },
                },
                follows: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                image: true,
                                status: true,
                                is_verified: true,
                                followerRequest: { select: { status: true } },
                            },
                        },
                    },
                },
            },
        })
        if (!user) {
            return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'User not found.' })
        }
        delete (user as any).password
        return res.status(200).send({ status: 200, message: 'Ok', user: user })
    } catch (err) {
        return next(err)
    }
}

const submitKycDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const body = req.body;

    const isKycSubmitted = await prisma.kYC.findUnique({
        where: {user_id: req.user.id}
    })
    if(isKycSubmitted) {
        return res.status(201).send({msg: "Kyc details already submitted"})
    }

    if (!helper.isValidatePaylod(body, ['name', 'address', 'phone', 'email', 'document']) ||
        !['name', 'address', 'phone', 'email', 'document', 'alternate_phone', 'alternate_email', 'document_type']
            .every(field => typeof body[field] === 'string' || body[field] === undefined)) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid payload',
            error_description: 'All fields must be strings and name, address, phone, email, document are required.',
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(body.email)) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid email format',
        });
    }
    if (body.email.length > 74) {
        return res.status(400).send({ status: 400, error: 'Email address too long' })
    }

    
    if (body.alternate_email && !emailRegex.test(body.alternate_email)) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid alternate email format',
        });
    }
    
    if(body.alternate_email && body.alternate_email.length > 74){
        return res.status(400).send({ status: 400, error: 'Alternate email address too long' })
    }
    
    if (!/^\d{10}$/.test(body.phone)) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid phone number format. Must be 10 digits.',
        });
    }

    if (body.alternate_phone && !/^\d{10}$/.test(body.alternate_phone)) {
        return res.status(400).send({
            status: 400,
            error: 'Invalid alternate phone number format. Must be 10 digits.',
        });
    }

    try {
        await prisma.kYC.create({
            data: {
                name: body.name,
                address: body.address,
                phone: body.phone,
                alternate_phone: body.alternate_phone,
                email: body.email,
                alternate_email: body.alternate_email,
                document_type: body.document_type,
                document: body.document,
                user_id: user.id,
            },
        });

        await prisma.user.update({
            where: { id: user.id },
            data: { kycStatus: 0 },
        });

        return res.status(200).send({ status: 200, message: 'Ok' });
    } catch (err) {
        return next(err);
    }
};

const getFollowStatus = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User Id is required',
        });
    }

    if (typeof user_id !== 'number' || !Number.isInteger(user_id) || user_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User Id should be a positive integer',
        });
    }

    if (user_id === user.id) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User cannot check follow status for themselves',
        });
    }

    try {
        const isFollowing = await prisma.follows.findFirst({
            where: {
                user_id: user_id,
                follower_id: user.id,
            },
        });

        const isRequested = await prisma.followRequest.findFirst({
            where: {
                user_id: user_id,
                follower_id: user.id,
                status: 0, 
            },
        });

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            isFollowing: !!isFollowing,
            isRequested: !!isRequested,
        });
    } catch (err) {
        return next(err);
    }
};


const getPinnedLocations = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const pinnedLocations = await prisma.pinnedLocation.findMany({ where: { user_id: user.id } })
    return res.status(200).json({ status: 200, message: 'Ok', pinnedLocations: pinnedLocations })
}

const pinLocation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const { latitude, longitude, title } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Latitude and Longitude are required.',
        });
    }

    if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
            status: 400,
            error: 'Bad Request',
            error_description: 'Latitude and Longitude should be numbers.',
        });
    }

    if (title && typeof title !== 'string') {
        return res.status(400).json({
            status: 400,
            error: 'Bad Request',
            error_description: 'Title should be a string.',
        });
    }

    try {
        const addedPin = await prisma.pinnedLocation.create({
            data: {
                latitude: latitude,
                longitude: longitude,
                title: title || '', 
                user_id: user.id,
            },
        });

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            pinned: addedPin,
        });
    } catch (err) {
        return next(err);
    }
};


const deletePinnedLocation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const { id } = req.params
    if (!id) {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Id is required' })
    }
    if (isNaN(Number(id))) {
        return res.status(400).json({ status: 400, error: 'Bad Request', error_description: 'Id should be a number' })
    }
    if(!Number.isInteger(id)){
        return res.status(400).json({ status: 400, error: 'Bad Request', error_description: 'Id should be a integer' })
    }
    const exists = await prisma.pinnedLocation.findFirst({ where: { id: Number(id), user_id: user.id } })
    if (!exists) {
        return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'Pinned location not found' })
    }
    try {
        await prisma.pinnedLocation.delete({
            where: { id: Number(id) },
        })
        return res.status(200).send({ status: 200, message: 'Ok' })
    } catch (err) {
        return next(err)
    }
}

const getNotifications = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    try {
        const notifications = await prisma.notification.findMany({
            where: { receiver_id: user.id },
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, message: 'Ok', notifications: notifications })
    } catch (err) {
        return next(err)
    }
}

const deleteNotification = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.body
        if (!id) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Id is required' })
        }
        if (isNaN(Number(id))) {
            return res
                .status(400)
                .json({ status: 400, error: 'Bad Request', error_description: 'Id should be a number' })
        }
        const notif = await prisma.notification.findFirst({ where: { id: Number(id), receiver_id: req.user.id } })
        if (!notif) {
            return res
                .status(200)
                .send({ status: 404, error: 'Not Found', error_description: 'Notification not found' })
        }
        try {
            await prisma.notification.delete({
                where: { id: Number(id), receiver_id: req.user.id },
            })
            return res.status(200).send({ status: 200, message: 'Ok' })
        } catch (err) {
            return next(err)
        }
    } catch (err) {
        return next(err)
    }
}

const markAsRead = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.body
        if (!id) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Id is required' })
        }
        if (isNaN(Number(id))) {
            return res
                .status(400)
                .json({ status: 400, error: 'Bad Request', error_description: 'Id should be a number' })
        }
        const notif = await prisma.notification.findFirst({ where: { id: Number(id), receiver_id: req.user.id } })
        if (!notif) {
            return res
                .status(200)
                .send({ status: 404, error: 'Not Found', error_description: 'Notification not found' })
        }
        try {
            await prisma.notification.update({
                where: { id: Number(id), receiver_id: req.user.id },
                data: { isRead: true },
            })
            return res.status(200).send({ status: 200, message: 'Ok' })
        } catch (err) {
            return next(err)
        }
    } catch (err) {
        return next(err)
    }
}

const friendsSuggestions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const friendsIdList = await prisma.follows.findMany({ where: { follower_id: req.user.id } })
        const friendsId = friendsIdList.map((friend) => friend.user_id)
        const friendsOfFriends = await prisma.follows.findMany({
            where: { follower_id: { in: friendsId } },
            select: { user_id: true },
        })
        const friendsOfFriendsId = friendsOfFriends.map((friend) => friend.user_id)
        const suggestions = await prisma.user.findMany({
            where: { id: { in: friendsOfFriendsId }, NOT: { id: req.user.id } },
            select: {
                id: true,
                username: true,
                image: true,
                status: true,
                latitude: true,
                longitude: true,
                followers: true,
                followRequest: true,
            },
        })
        const usersWithFollowingInfo = suggestions.map((user) => ({
            id: user.id,
            username: user.username,
            image: user.image,
            latitude: user.latitude,
            longitude: user.longitude,
            followersCount: user.followers.length,
            isFollowing: user.followers.some((follow) => follow.follower_id === req.user.id),
            isRequested: user.followRequest.some(
                (request) => request.follower_id === req.user.id && request.status === 0
            ),
            status: user.status,
        }))
        return res.status(200).send({ status: 200, message: 'Ok', suggestions: usersWithFollowingInfo })
    } catch (err) {
        return next(err)
    }
}

const switchPushNotifications = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const { pushNotifications } = req.body
        if (typeof pushNotifications !== 'boolean') {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Invalid Payload' })
        }
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { pushNotifications: pushNotifications },
        })
        delete (updatedUser as any).password
        return res.status(200).send({ status: 200, message: 'Ok', user: updatedUser })
    } catch (err) {
        return next(err)
    }
}

const createTransaction = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const { amount, status, order_id, type } = req.body
        if (!helper.isValidatePaylod(req.body, ['amount', 'status', 'order_id', 'type'])) {
            return res.status(200).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'amount, status and order_id are required.',
            })
        }
        if (typeof amount !== 'number') {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Amount should be a number.',
            })
        }
        if(amount < 1){
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Amount should be greater than 0.',
            })
        }
        if (typeof status !== 'string' || typeof order_id !== 'string' || typeof type !== 'string') {
            return res.status(200).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Status, Order_id and type should be a string.',
            })
        }
        const transaction = await prisma.transactions.create({
            data: {
                amount: amount,
                status: status,
                order_id: order_id,
                ezi_order_id: `EZI${order_id}`,
                user_id: user.id,
                type: type,
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', transaction: transaction })
    } catch (err) {
        return next(err)
    }
}

const getTransactions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const transactions = await prisma.transactions.findMany({
            where: { id: user.id },
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, message: 'Ok', transactions: transactions })
    } catch (err) {
        return next(err)
    }
}

const createHighlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const { title, latitude, longitude } = req.body

        if (!helper.isValidatePaylod(req.body, ['title', 'latitude', 'longitude'])) {
            return res.status(200).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'title, latitude, longitude is required.',
            })
        }

        const highlight = await prisma.highlight.create({
            data: {
                title,
                latitude,
                longitude,
                user_id: user.id,
                postIds: [],
            },
        })

        return res.status(200).send({ status: 200, message: 'Ok', highlight })
    } catch (err) {
        return next(err)
    }
}

const addPostToHighlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { post_id, highlight_id } = req.body
        if (!helper.isValidatePaylod(req.body, ['post_id', 'highlight_id'])) {
            return res.status(200).send({
                status: 400,
                error: 'Invalid payload',
                error_description: 'post_id, highlight_id is required.',
            })
        }
        if (typeof post_id !== 'number' || !Number.isInteger(post_id) || post_id <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Post Id should be a number.',
            })
        }
        if (typeof highlight_id !== 'number' || !Number.isInteger(highlight_id) || highlight_id <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Highlight Id should be a number.',
            })
        }
        const post = await prisma.post.findFirst({ where: { id: post_id, user_id: req.user.id } })
        if (!post) {
            return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'Post not found.' })
        }

        const highlight = await prisma.highlight.findFirst({ where: { id: highlight_id, user_id: req.user.id } })
        if (!highlight) {
            return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'Highlight not found.' })
        }
        const postIds = highlight.postIds || '';
        const postIdsArray = String(postIds).split(',')
        if(postIdsArray.includes(String(post_id))){
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Post already added to highlight.' })
        }
        postIdsArray.push(String(post_id))
        const postIdsNew = postIdsArray.join(',')
        const updatedHighlight = await prisma.highlight.update({
            where: { id: highlight_id },
            data: { postIds: postIdsNew },
        })
        
        return res.status(200).send({ status: 200, message: 'Ok', highlight: updatedHighlight })
    } catch (err) {
        return next(err)
    }
}

const getHighlightsAll = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const highlights = await prisma.highlight.findMany({ where: { user_id: user.id }})
        const hightlightsWithPosts = await Promise.all(highlights.map(async (highlight) => {
            const postIds = highlight.postIds || '';
            const posts = await prisma.post.findMany({ where: { id: { in: String(postIds).split(',').map(Number) } } })
            return { ...highlight, posts }
        }))
        return res.status(200).send({ status: 200, message: 'Ok', highlights: hightlightsWithPosts })
    } catch (err) {
        return next(err)
    }
}

const getHighlightById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const { id } = req.params
        if (!id) {
            return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Id is required' })
        }
        if (isNaN(Number(id))) {
            return res.status(400).json({ status: 400, error: 'Bad Request', error_description: 'Id should be a number' })
        }
        const highlight = await prisma.highlight.findFirst({ where: { id: Number(id), user_id: user.id }})
        if (!highlight) {
            return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'Highlight not found' })
        }
        const highlightWithPosts = { ...highlight, posts: await prisma.post.findMany({ where: { id: { in: String(highlight.postIds).split(',').map(Number) } }}) }
        return res.status(200).send({ status: 200, message: 'Ok', highlight: highlightWithPosts })
    } catch (err) {
        return next(err)
    }
}

//====== Itinerary ======//

const createItinerary = async (req: ExtendedRequest, res: Response, next: NextFunction) => {

    const user = req.user;
    const { lat_long, status, itinerary_id, img_urls, city, city_title, city_description } = req.body;

    // if (!lat_long || !status || !city || typeof lat_long !== 'string') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat_long, status and city are required' }); }
    if (!lat_long || !city || typeof lat_long !== 'string') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat_long, status and city are required' }); }
    if (!img_urls || !Array.isArray(img_urls)) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should be an array' }); }
    if (img_urls.length === 0) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should not be empty' }); }
    if (img_urls.some((url) => typeof url !== 'string')) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should be an array of string' }); }
    

    try {

        // const itinerary = await prisma.itinerary.findFirst({ where: { id: itinerary_id }});
        const itinerary: Itinerary | null = await prisma.itinerary.findUnique({ where: { id: itinerary_id ? itinerary_id : 0 }});

        console.log(":::::::::::::::", itinerary);

        if (itinerary && itinerary.status === 'END') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Itinerary already ended' }); }

        if (!itinerary) {
            const newItinerary = await prisma.itinerary.create({
                data: {
                    user_id: user.id,
                    status: 'START',
                    start_lat_long: helper.removeWhitespace(lat_long),
                    start_city: city ? city : 'START CITY',
                    city_details: {
                        create: {
                            city_name: city,
                            lat_long: helper.removeWhitespace(lat_long),
                            title: city_title ? city_title : null,
                            description: city_description ? city_description : null,
                            // ...(img_url ? { imges_url: { create: { image_url: img_url } } } : {}), // only create, if img_url is provided
                            imges_url: {
                                createMany: {
                                    data: img_urls.map((url) => ({ image_url: url })),
                                },
                            },
                        },
                    }
                }
            });

            return res.status(200).send({ status: 200, message: 'created', itinerary: newItinerary });
        } else if (itinerary) {
            const updatedItinerary = await prisma.itinerary.update({
                where: { id: itinerary.id },
                data: {
                    status: status === 'END' ? 'END' : 'MOVING',
                    end_lat_long: status === 'END' ? helper.removeWhitespace(lat_long) : null,
                    end_city: status === 'END' ? (city ? city : 'NOT PROVIDED') : null,
                    city_details: {
                        create: {
                            city_name: city,
                            lat_long: helper.removeWhitespace(lat_long),
                            title: city_title ? city_title : null,
                            description: city_description ? city_description : null,
                            // ...(img_url ? { imges_url: { create: { image_url: img_url } } } : {}), // only create, if img_url is provided
                            imges_url: {
                                createMany: {
                                    data: img_urls.map((url) => ({ image_url: url })),
                                },
                            },
                        },
                    }
                }
            });

            return res.status(200).send({ status: 200, message: 'updated', itinerary: updatedItinerary });
        } else {
            return res.status(404).send({ status: 404, message: 'Itinerary not found' });
        }
        
    } catch (error) {
        return next(error);
    }
};

const getItineraries = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const { itinerary_id } = req.body;

    try {

        if (itinerary_id) {
            const itinerary = await prisma.itinerary.findFirst({
                where: { id: itinerary_id, user_id: user.id },
                include: {
                    city_details: {
                        include: {
                            imges_url: true,
                        },
                    },
                },
            });

            if (!itinerary) { return res.status(404).send({ status: 404, message: 'Itinerary not found | invalid itinerary id' });}

            return res.status(200).send({ status: 200, message: 'Ok', itinerary: itinerary });
        } else {

            const itineraries = await prisma.itinerary.findMany({
                where: { user_id: user.id },
                include: {
                    city_details: {
                        include: {
                            imges_url: true,
                        },
                    },
                },
            });
            
            return res.status(200).send({ status: 200, message: 'Ok', itineraries: itineraries });
        }
    } catch (error) {
        return next(error);
    }
};

const updateDetailsToItineraryCity = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    const { itinerary_city_id, img_urls, city_name, title, description } = req.body;

    if (!itinerary_city_id) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'itinerary_id is required' }); }
    if (!img_urls || !Array.isArray(img_urls)) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should be an array' }); }
    if (img_urls.length === 0) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should not be empty' }); }
    if (img_urls.some((url) => typeof url !== 'string')) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should be an array of string' }); }

    try {

        const itineraryCity = await prisma.itineraryCity.findFirst({ where: { id: itinerary_city_id, itinerary: { user_id: user.id } } });
        if (!itineraryCity) { return res.status(404).send({ status: 404, message: 'Itinerary city not found | invalid itinerary city id' }); }

        const updatedItineraryCity = await prisma.itineraryCity.update({
            where: { id: itinerary_city_id },
            data: {
                city_name: city_name ? city_name : itineraryCity.city_name,
                title: title ? title : itineraryCity.title,
                description: description ? description : itineraryCity.description,
                imges_url: {
                    createMany: {
                        data: img_urls.map((url) => ({ image_url: url })),
                    },
                },
            },
        });

        return res.status(200).send({ status: 200, message: 'Ok', itinerary_city: updatedItineraryCity });

    } catch (error) {
        return next(error);
    }
};

const marketPlace = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const {lat, long } = req.body;

    if (lat === undefined || long === undefined) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat and long are required' }); }
    if (isNaN(Number(lat)) || isNaN(Number(long))) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat and long should be numbers' }); }

    try {
        
        const place: string | null = await getCityByCoordinates(lat, long);
        if (!place) {return res.status(404).send({ status: 200, message: 'city not found'})};

        const citiesByLatLong: string[] = await getNearbyPlaces(lat, long, 100, 500);

        // const attractions:[] = await marketplaceDetails(place, TripAdvisorCategory.Attractions);
        // const restaurants:[] = await marketplaceDetails((place), TripAdvisorCategory.Restrurants);
        // const geos:[] = await marketplaceDetails(place, TripAdvisorCategory.Geos);

        citiesByLatLong.push(place);

        const citiesWithDescriptions = await citiesDescription(citiesByLatLong);

        const nearbyMarketplaces = await Promise.all(citiesByLatLong.map(async (cityName, index) => {
            // const attractions = await marketplaceDetails(cityName, TripAdvisorCategory.Attractions);
            // const restaurants = await marketplaceDetails(cityName, TripAdvisorCategory.Restrurants);
            // const geos = await marketplaceDetails(cityName, TripAdvisorCategory.Geos);

            return {
                city: cityName,
                city_description: citiesWithDescriptions[index].description,
                // attractions: attractions,
                // restaurants: restaurants,
                // geos: geos,
            }
        }));

        const marketplace = {
            city: place,
            city_description: citiesWithDescriptions[citiesWithDescriptions.length - 1].description,
            // attractions: attractions,
            // restaurants: restaurants,
            // geos: geos
        }

        console.log("marketplace: ", marketplace);
        nearbyMarketplaces.unshift(marketplace); //adding marketplace object to nearbyMarketplaces array (marketplace is the first element of nearbyMarketplaces)

        return res.status(200).send({status: 200, /*marketplace: marketplace,*/ nearbyMarketplaces: nearbyMarketplaces });
    } catch (error) {
        return next(error);
    }
};

const test = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        
        // const nearbyList: string[] = await getNearbyPlaces(28.7041, 77.1025, 100, 500);
        // const city: string | null = await getCityByCoordinates(28.7041, 77.1025);
        // const citiesDesc: object[] = await citiesDescription(nearbyList);
        const imgUrl: string | null = await getImgByPlaceName("Delhi");

        const data = {
            // nearbyList: nearbyList,
            // city: city,
            // citiesDesc: citiesDesc,
            imgUrl: imgUrl,
        }

        return res.status(200).send({ status: 200, message: 'Ok', data: data });
    } catch (error) {
        return next(error);
    }
};

const userController = {
    getSuggestion,
    get_all_users,
    get_user_feed,
    get_user_details,
    update_user,
    Get_follower,
    GET_following,
    userTravelingStatus,
    feedByPlace,
    getUsersByUsername,
    visibleStatus,
    blockUser,
    getBlockedUsers,
    unblockUser,
    updateLatLong,
    getNearbyUsers,
    deleteAccount,
    changePassword,
    rateService,
    getUserFollowersFollowingById,
    submitKycDetails,
    getFollowStatus,
    getPinnedLocations,
    pinLocation,
    deletePinnedLocation,
    updateRegistrationToken,
    update_user_bg,
    getNotifications,
    deleteNotification,
    markAsRead,
    friendsSuggestions,
    switchPushNotifications,
    createTransaction,
    getTransactions,
    createHighlight,
    addPostToHighlight,
    getHighlightsAll,
    getHighlightById,
    createItinerary,
    getItineraries,
    updateDetailsToItineraryCity,
    marketPlace,
    test,
}

export default userController
