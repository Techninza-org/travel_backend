import e, { NextFunction, Request, Response } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { Itinerary, PrismaClient, User } from '@prisma/client'
import helper from '../utils/helpers'
const prisma = new PrismaClient()
import crypto from 'node:crypto'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../app'
import OpenAI from "openai";
const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});
import { citiesDescription, getCityByCoordinates, getImgByPlaceName, getNearbyPlaces, marketplaceDetails, optimizedCitiesDescription, placeDetails, TripAdvisorCategory } from '../utils/marketplaceService'
import axios from 'axios'

const PERPLEXITY_API_KEY: string = process.env.PERPLEXITY_API_KEY || "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";
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_MODEL = "sonar-pro";

interface PerplexityResponse {
    choices: {
      message: {
        role: string;
        content: string;
      };
    }[];
}

async function callPerplexity(userPrompt: string, systemPrompt = "You are a helpful assistant that ONLY returns simple answers and related images when asked. Do not add explanations.") {
    if (!PERPLEXITY_API_KEY) {
      throw new Error("Missing PERPLEXITY_API_KEY");
    }
  
    const { data } = await axios.post<PerplexityResponse>(
      PERPLEXITY_URL,
      {
        model: PERPLEXITY_MODEL,
        return_images: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
  
    const response = data?.choices?.[0]?.message ?? "";
    if (!response) throw new Error("Empty response from Perplexity");
    return response;
  }

const gpt = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const {prompt} = req.body
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Prompt is required and should be a string.' })
        }
        
        // const response = await client.responses.create({
        //     model: "gpt-3.5-turbo",
        //     input: prompt,
        // });

        const response = await callPerplexity(prompt);

        console.log(response, 'Response from Perplexity');
        return res.status(200).send({ status: 200, message: 'Ok', result: response });
    }catch(err){
        console.error('Error in GPT:', err)
        return res.status(500).send({ status: 500, error: 'Internal Server Error', error_description: 'An error occurred while processing your request.' })
    }
}

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

const get_user_details = async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
    const user = req.user

    if (!user) {
        return res.status(404).send({
            status: 404,
            error: 'User Not Found',
            error_description: 'No user details available.',
        })
    }

    const userDetails = await prisma.user.findUnique({
     where: { id: user.id },
     include: {
        highlights: true
     }
    })

    delete (userDetails as any).password

    return res.status(200).send({
        status: 200,
        message: 'Ok',
        user: { ...userDetails },
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

const getFollowersAndFollowing = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const userId = user.id

    try {
        const followers = await prisma.follows.findMany({
            where: { user_id: userId },
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

        const following = await prisma.follows.findMany({
            where: { follower_id: userId },
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

        return res.status(200).send({
            status: 200,
            message: 'Ok',
            followersCount: followers.length,
            followingCount: following.length,
            followers,
            following,
        })
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
                phone: true,
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
    const user = req.user;

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

const searchUsers = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { lat, long, gender, status } = req.query;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const user = req.user;

    if (!lat || !long) { return res.status(400).json({ status: 400, error: 'Bad Request', error_description: 'Latitude and Longitude are required' }) }
    if (isNaN(Number(lat)) || isNaN(Number(long))) { return res.status(400).json({ status: 400, error: 'Bad Request', error_description: 'Latitude and Longitude should be a number' }) }
    if (Number(lat) < -90 || Number(lat) > 90) { return res.status(400).json({ status: 400, error: 'Bad Request', error_description: 'Latitude should be between -90 and 90' }) }
    if (Number(long) < -180 || Number(long) > 180) { return res.status(400).json({ status: 400, error: 'Bad Request', error_description: 'Longitude should be between -180 and 180' }) }
    
    let intGenger: number[]

    if (gender === 'MALE'){
        intGenger = [1];
    } else if (gender === 'FEMALE') {
        intGenger = [0];
    } else {
        intGenger = [0,1]
    }



    try {
        
        const blockedUsers = await prisma.block.findMany({ where: { user_id: user.id },select: {blocked_id: true,},})
        const blockedUserIds = blockedUsers.map((user) => user.blocked_id)

        const currentUser = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                follows: true,
                followers: true,
                followRequest: true,
                followerRequest: true,
            }
        });


        const nearbyUsers = await prisma.user.findMany({
            where:{
                AND: {
                    NOT: { id: { in: blockedUserIds } },
                    id: { not: user.id },
                    visible: true,
                    gender: { in: intGenger },
                    latitude: {
                        gt: Number(lat) - 0.45,
                        lt: Number(lat) + 0.45,
                    },
                    longitude: {
                        gt: Number(long) - 0.45,
                        lt: Number(long) + 0.45,
                    },
                },
            },
            skip: offset,
            take: limit,
        });

        const usersWithAdditionalInfo = await Promise.all(nearbyUsers.map(async (user) => {
            const isFollower = currentUser?.follows.some((follow) => follow.user_id === user.id);
            const isFollowing = currentUser?.followers.some((follow) => follow.follower_id === user.id);
            const isRequestSendByCurrentUser = currentUser?.followerRequest.some((request) => request.user_id === user.id && request.status === 0);
            const recievedRequests = currentUser?.followRequest.some((request) => request.follower_id === user.id && request.status === 0);

            return {
                ...user,
                isFollower: isFollower,
                isFollowing: isFollowing,
                isRequested: isRequestSendByCurrentUser, // followerRequest
                isFollowingRequest: recievedRequests, // followingRequest
            };
        }));

        return res.status(200).json({ status: 200, message: 'Ok', users: usersWithAdditionalInfo, test: currentUser });
    } catch (error) {
        return next(error);
    }
};

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
        where: { user_id: req.user.id }
    })
    if (isKycSubmitted) {
        return res.status(201).send({ msg: "Kyc details already submitted" })
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

    if (body.alternate_email && body.alternate_email.length > 74) {
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
    if (!Number.isInteger(id)) {
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
        if (amount < 1) {
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
    const user = req.user
    const { title, latitude, longitude, location, image } = req.body

    if (!helper.isValidatePaylod(req.body, ['title', 'latitude', 'longitude'])) {return res.status(200).send({status: 400,error: 'Invalid payload', error_description: 'title, latitude, longitude is required.'})}

    try {

        const highlight = await prisma.highlight.create({
            data: {
              title,
              latitude,
              longitude,
              user_id: user.id,
              postIds: [],
              location: location || '',
              image: image || '',
            }
          });

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
        if (postIdsArray.includes(String(post_id))) {
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
        const highlights = await prisma.highlight.findMany({ where: { user_id: user.id } })
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
        // const highlight = await prisma.highlight.findFirst({ where: { id: Number(id), user_id: user.id } })
        const highlight = await prisma.highlight.findFirst({ where: { id: Number(id) }, include: { media: true } })
        if (!highlight) {
            return res.status(200).send({ status: 404, error: 'Not Found', error_description: 'Highlight not found' })
        }


        const highlightWithPosts = { ...highlight, posts: await prisma.post.findMany({ where: { id: { in: String(highlight.postIds).split(',').map(Number) } } }) }

        //get all post of user with 10 km radius of highlight location
        const customPost = await prisma.post.findMany({
            where: {
                // user_id: user.id,
                user_id: highlight.user_id,
                latitude: {
                    gte: String(Number(highlight.latitude) - 0.1),
                    lte: String(Number(highlight.latitude) + 0.1),
                },
                longitude: {
                    gte: String(Number(highlight.longitude) - 0.1),
                    lte: String(Number(highlight.longitude) + 0.1),
                },
            }
        })

        const customHighlightWithPosts = { ...highlight, posts: customPost }
        
        // return res.status(200).send({ status: 200, message: 'Ok', highlight: highlightWithPosts })
        return res.status(200).send({ status: 200, message: 'Ok', highlight: customHighlightWithPosts })
    } catch (err) {
        return next(err)
    }
}

const getHighlightsByUserId = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { user_id } = req.params
    if (isNaN(Number(user_id))) {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'User Id should be a number' })
    }

    try {
        const highlights = await prisma.highlight.findMany({ where: { user_id: parseInt(user_id) }, include: { media: true }, orderBy: { created_at: 'desc' } })

        //live itenerary of user
        const itinerary = await prisma.itinerary.findFirst({ where: { user_id: parseInt(user_id), status: {not: 'END'} }, include: { city_details: { include: {imges_url: true}} } })
        return res.status(200).send({ status: 200, message: 'Ok', highlights: highlights, itinerary: itinerary });
    } catch (err) {
        return next(err)
    }
}

//====== Itinerary ======//

const deleteItineraryById = async ( req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const user = req.user;
        const {id} = req.params;
        const itinerary = prisma.itinerary.findFirst({
            where: {
                id: Number(id),
                user_id: user.id
            }
        })
        if(!itinerary){
            return res.status(200).send({status: 404, message: "Itinerary not found."})
        }
        console.log(itinerary, 'ITINERARY TO DELETE');
        
        // const deletedItineary = await prisma.itinerary.delete({
        //     where: {
        //         id: Number(id),
        //         user_id: user.id
        //     }
        // })
        // if(!deletedItineary){
        //     return res.status(200).send({status: 404, message: "Itinerary not found."})
        // }
        return res.status(200).send({status: 200, send: "Itinerary deleted successfully!"})
    }catch(err){
        return next(err)
    }
}

const createItinerary = async (req: ExtendedRequest, res: Response, next: NextFunction) => {

    const user = req.user;
    const { lat_long, status, itinerary_id, img_urls, city, city_title, city_description, isAutomatic, hotel, transport, placesVisited } = req.body;
    console.log("createItinerary body :::::::::::::::", req.body);
    

    // if (!lat_long || !status || !city || typeof lat_long !== 'string') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat_long, status and city are required' }); }
    if (!lat_long || !city || typeof lat_long !== 'string') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat_long, status and city are required' }); }
    if (!img_urls || !Array.isArray(img_urls)) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should be an array' }); }
    // if (img_urls.length === 0) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should not be empty' }); }
    if (img_urls.length > 0 && img_urls.some((url) => typeof url !== 'string')) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'img_urls should be an array of string' }); }
    if (typeof isAutomatic !== 'boolean') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'isAutomatic should be a boolean' }); }


    try {

        // const itinerary = await prisma.itinerary.findFirst({ where: { id: itinerary_id }});
        const itinerary: Itinerary | null = await prisma.itinerary.findUnique({ where: { id: itinerary_id ? itinerary_id : 0 } });

        console.log("itinerary :::::::::::::::", itinerary);

        if (itinerary && itinerary.status === 'END') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Itinerary already ended' }); }


        if (isAutomatic) {

            const activeItinerary = await prisma.itinerary.findFirst({ where: { user_id: user.id, status: { not: 'END' } }, include: { city_details: true } });

            if ( activeItinerary?.city_details[activeItinerary.city_details.length - 1].city_name === city && status !== 'END' ) {
                return res.status(409).send({ status: 409, error: 'Bad Request', error_description: 'user already in same city', same_city: true });
            }

            if (!activeItinerary) {
                const newItinerary = await prisma.itinerary.create({
                    data: {
                        user_id: user.id,
                        status: 'START',
                        start_lat_long: helper.removeWhitespace(lat_long),
                        start_city: city ? city : 'START CITY',
                        cover_img: img_urls[0] ? img_urls[0] : helper.DEFAULT_IMAGE,
                        city_details: {
                            create: {
                                city_name: city,
                                lat_long: helper.removeWhitespace(lat_long),
                                title: city_title ? city_title : null,
                                description: city_description ? city_description : null,
                                hotel: hotel,
                                transport: transport,
                                places_visited: placesVisited,
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
            } else {

                if (activeItinerary.status === 'END') {
                    return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Itinerary already ended' });
                }

                const updatedItinerary = await prisma.itinerary.update({
                    where: { id: activeItinerary.id },
                    data: {
                        status: status === 'END' ? 'END' : 'MOVING',
                        cover_img: activeItinerary.cover_img === null ? (img_urls[0] ? img_urls[0] : helper.DEFAULT_IMAGE) : activeItinerary.cover_img,
                        end_lat_long: status === 'END' ? helper.removeWhitespace(lat_long) : null,
                        end_city: status === 'END' ? (city ? city : 'NOT PROVIDED') : null,
                        city_details: {
                            create: {
                                city_name: city,
                                lat_long: helper.removeWhitespace(lat_long),
                                title: city_title ? city_title : null,
                                description: city_description ? city_description : null,
                                hotel: hotel,
                                transport: transport,
                                places_visited: placesVisited,
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
            }

        } else {

            if (!itinerary) {

                // const allUserItineraries = await prisma.itinerary.findMany({ where: { user_id: user.id } });
                // if (allUserItineraries.some(itinerary => itinerary.status !== 'END')) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'User already has an active itinerary' }); }

                const activeItinerary = await prisma.itinerary.findFirst({ where: { user_id: user.id, status: { not: 'END' } } });
                if (activeItinerary) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'User already has an active itinerary, close it first' }); }


                const newItinerary = await prisma.itinerary.create({
                    data: {
                        user_id: user.id,
                        status: 'START',
                        start_lat_long: helper.removeWhitespace(lat_long),
                        start_city: city ? city : 'START CITY',
                        cover_img: img_urls[0] ? img_urls[0] : helper.DEFAULT_IMAGE,
                        city_details: {
                            create: {
                                city_name: city,
                                lat_long: helper.removeWhitespace(lat_long),
                                title: city_title ? city_title : null,
                                description: city_description ? city_description : null,
                                hotel: hotel,
                                transport: transport,
                                places_visited: placesVisited,
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
                        cover_img: itinerary.cover_img === null ? (img_urls[0] ? img_urls[0] : helper.DEFAULT_IMAGE) : itinerary.cover_img,
                        city_details: {
                            create: {
                                city_name: city,
                                lat_long: helper.removeWhitespace(lat_long),
                                title: city_title ? city_title : null,
                                description: city_description ? city_description : null,
                                hotel: hotel,
                                transport: transport,
                                places_visited: placesVisited,
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
        }

    } catch (error) {
        return next(error);
    }
};

const getItineraries = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const { itinerary_id, other_user_id } = req.body;

    try {

        if (itinerary_id) {
            const itinerary = await prisma.itinerary.findFirst({
                // where: { id: itinerary_id, user_id: user.id },
                where: { id: itinerary_id },
                include: {
                    city_details: {
                        include: {
                            imges_url: true,
                        },
                    },
                },
            });

            if (!itinerary) { return res.status(404).send({ status: 404, message: 'Itinerary not found | invalid itinerary id' }); }

            return res.status(200).send({ status: 200, message: 'Ok', itinerary: itinerary });
        } else if (other_user_id) {

            const otherUserIteneraries = await prisma.itinerary.findMany({
                where: { user_id: other_user_id },
                include: {
                    city_details: {
                        include: {
                            imges_url: true,
                        },
                    },
                },
            });

            if (!otherUserIteneraries) { return res.status(404).send({ status: 404, message: 'invalid user id || no itineraries found' }); }

            return res.status(200).send({ status: 200, message: 'Ok', itineraries: otherUserIteneraries });
        } else {

            const itineraries = await prisma.itinerary.findMany({
                where: {
                    OR: [
                        { user_id: user.id },
                        { members: { some: { id: user.id } } }
                    ]
                },
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

const addUserToItineraryMembers = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const { itinerary_id, member_id } = req.body;

        if (!itinerary_id || !member_id) {
            return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'user_id and member_id are required' });
        }

        const itinerary = await prisma.itinerary.findUnique({
            where: { id: itinerary_id },
        });

        if (!itinerary) {
            return res.status(404).send({ status: 404, error: 'Not Found', error_description: 'Itinerary not found' });
        }

        const memberExists = await prisma.user.findUnique({
            where: { id: member_id },
        });

        if (!memberExists) {
            return res.status(404).send({ status: 404, error: 'Not Found', error_description: 'User not found' });
        }

        await prisma.itinerary.update({
            where: { id: itinerary_id },
            data: {
                members: {
                    connect: { id: member_id },
                },
            },
        });

        return res.status(200).send({ status: 200, message: 'User added to itinerary members successfully' });
    }catch(err){
        return next(err)
    }
}

const marketPlace = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { lat, long } = req.body;

    if (lat === undefined || long === undefined) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat and long are required' }); }
    if (isNaN(Number(lat)) || isNaN(Number(long))) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'lat and long should be numbers' }); }

    try {

        const place: string | null = await getCityByCoordinates(lat, long);
        if (!place) { return res.status(404).send({ status: 200, message: 'city not found' }) };

        const citiesByLatLong: string[] = await getNearbyPlaces(lat, long, 150, 500);

        // const attractions:[] = await marketplaceDetails(place, TripAdvisorCategory.Attractions);
        // const restaurants:[] = await marketplaceDetails((place), TripAdvisorCategory.Restrurants);
        // const geos:[] = await marketplaceDetails(place, TripAdvisorCategory.Geos);

        citiesByLatLong.push(place);

        const citiesWithDescriptions = await citiesDescription(citiesByLatLong);
        // const citiesWithDescriptions = await optimizedCitiesDescription(citiesByLatLong);

        const nearbyMarketplaces = await Promise.all(citiesByLatLong.map(async (cityName, index) => {
            // const attractions = await marketplaceDetails(cityName, TripAdvisorCategory.Attractions);
            // const restaurants = await marketplaceDetails(cityName, TripAdvisorCategory.Restrurants);
            // const geos = await marketplaceDetails(cityName, TripAdvisorCategory.Geos);

            return {
                city: cityName,
                city_description: citiesWithDescriptions[index]?.description,
                // attractions: attractions,
                // restaurants: restaurants,
                // geos: geos,
            }
        }));

        const marketplace = {
            city: place,
            city_description: citiesWithDescriptions[citiesWithDescriptions.length - 1]?.description,
            // attractions: attractions,
            // restaurants: restaurants,
            // geos: geos
        }

        console.log("marketplace: ", marketplace);
        nearbyMarketplaces.unshift(marketplace); //adding marketplace object to nearbyMarketplaces array (marketplace is the first element of nearbyMarketplaces)
        nearbyMarketplaces.pop(); // remove last element from nearbyMarketplaces array (which is the same as marketplace object)

        return res.status(200).send({ status: 200, /*marketplace: marketplace,*/ nearbyMarketplaces: nearbyMarketplaces });
    } catch (error) {
        return next(error);
    }
};

const getMarketplaceDetails = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { place, type } = req.query;
  
    if (!place || typeof place !== "string") {
      return res.status(400).send({
        status: 400,
        error: "Bad Request",
        error_description: "place and type are required",
      });
    }
    if (typeof type !== "string") {
      return res.status(400).send({
        status: 400,
        error: "Bad Request",
        error_description: "type should be a string",
      });
    }
  
    try {
      // Get city description (safe: returns [] on failure)
      const cityDetails = await citiesDescription([place]);
      const cityDescription = cityDetails?.[0]?.description || ""; // fallback to empty string
  
      // Helper to send a uniform response
      const sendData = (payloadKey: "attractions" | "restaurants" | "geos" | "hotels", payloadValue: any) => {
        return res.status(200).send({
          status: 200,
          message: "Ok",
          data: {
            city: place,
            city_description: cityDescription,
            [payloadKey]: payloadValue ?? [],
          },
        });
      };
  
      // Fetch TripAdvisor data per type
      switch (type) {
        case "attractions": {
          const attractions = await marketplaceDetails(place, TripAdvisorCategory.Attractions);
          return sendData("attractions", attractions);
        }
        case "restaurants": {
          const restaurants = await marketplaceDetails(place, TripAdvisorCategory.Restrurants);
          return sendData("restaurants", restaurants);
        }
        case "geos": {
          const geos = await marketplaceDetails(place, TripAdvisorCategory.Geos);
          return sendData("geos", geos);
        }
        case "hotels": {
          const hotels = await marketplaceDetails(place, TripAdvisorCategory.hotels);
          return sendData("hotels", hotels);
        }
        default:
          return res.status(400).send({
            status: 400,
            error: "Bad Request",
            error_description: "type should be attractions, restaurants, hotels or geos",
          });
      }
    } catch (error) {
      return next(error);
    }
  };
  

const test = async (req: ExtendedRequest, res: Response, next: NextFunction) => {

    const { place, phone, isDelete, conversation_id } = req.body;
    try {

        // const nearbyList: string[] = await getNearbyPlaces(28.7041, 77.1025, 100, 500);
        // const city: string | null = await getCityByCoordinates(28.7041, 77.1025);
        // const citiesDesc: object[] = await citiesDescription(nearbyList);
        const imgUrl: string | null = await getImgByPlaceName(place);
        const ai = await placeDetails([place]);
        const userByPhone = await prisma.user.findFirst({ where: { phone: phone } });

        if (isDelete) {
            await prisma.user.delete({ where: { phone: phone } });
            return res.status(200).send({ status: 200, message: 'User deleted' });
        }

        const getAllConversations = await prisma.conversation.findMany({
            where: { id: conversation_id },
            include: {
                messages: true,
            }
        });

        const expenseById = await prisma.expense.findFirst({
            where: {
                id: 220
            },
            include: {
                addedUsers: true
            }
        });

        const data = {
            // nearbyList: nearbyList,
            // city: city,
            // citiesDesc: citiesDesc,
            imgUrl: imgUrl,
            ai: ai,
            userByPhone: userByPhone,
            getAllConversations: getAllConversations,
            expense: expenseById
        }

        return res.status(200).send({ status: 200, message: 'Ok', data: data });
    } catch (error) {
        return next(error);
    }
};

const deleteItenerary = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const {id, all} = req.body;

    try {
        
        if (all) {
            await prisma.itinerary.deleteMany({ where: { user_id: req.user.id } });
            return res.status(200).send({ status: 200, message: 'All itineraries deleted' });
        }else {
            const itinerary = await prisma.itinerary.findFirst({ where: { id: id, user_id: req.user.id } });
            if (!itinerary) { return res.status(404).send({ status: 404, message: 'Itinerary not found' }); }

            await prisma.itinerary.delete({ where: { id: id } });
            return res.status(200).send({ status: 200, message: 'Itinerary deleted' });
        }
    } catch (error) {
        return next(error);
    }
};

const companions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { lat, long, radius } = req.body;

    try {


    } catch (error) {
        return next(error);
    }
};

const submitQuery = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const {name, email, phone, message} = req.body;
        if(!phone || !message){
            return res.status(400).send({status: 400, error: 'Bad Request', error_description: 'phone and message are required'});
        }
        const query = await prisma.query.create({
            data: {
                name: name,
                email: email,
                phone: phone,
                message: message
            }
        })
        return res.status(200).send({status: 200, message: 'Ok', query: query});
    }catch(error){
        return next(error);
    }
}

export const followerFollowingHilights = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    try {
        
        let currentUser = await prisma.user.findFirst({ 
            where: { id: user.id },  
            include: {
                highlights: true,
                followers: {
                    include: {
                        user: {
                            include: {
                                highlights: true,
                                itineraries: true
                            }
                        },
                    }
                },
                follows: {
                    include: {
                        user: {
                            include: {
                                highlights: true,
                                itineraries: true
                            }
                        },
                    },
                }
            }
        });

        const currentUserItenerary = await prisma.itinerary.findFirst({
            where: { user_id: user.id },
            orderBy: {
                created_at: 'desc'
            }
        })

        if (!currentUser) {
            return res.status(404).send({ status: 404, error: 'User not found', error_description: 'User not found for the given id.' })
        }

        const userFollower = currentUser?.followers.map((follower) => {
            const itenerary = follower.user.itineraries.length > 0 ? follower.user.itineraries[follower.user.itineraries.length - 1] : null;

            return {
                ...follower,
                user: {
                    ...follower.user,
                    itineraries: undefined,
                    latest_itenerary: itenerary,
                }
            }
        });

        const userFollowing = currentUser?.follows.map((following) => {
            const itenerary = following.user.itineraries.length > 0 ? following.user.itineraries[following.user.itineraries.length - 1] : null;

            return {
                ...following,
                user: {
                    ...following.user,
                    itineraries: undefined,
                    latest_itenerary: itenerary,
                }
            }
        });

        currentUser.followers = userFollower as any;
        currentUser.follows = userFollowing as any;
        
        const data = {
            ...currentUser,
            latest_itenerary: currentUserItenerary ? currentUserItenerary : null,
        }

        return res.status(200).send({ status: 200, message: 'User highlights and followers', user: data })
    } catch (error) {
        console.log(error)
        return next(error)
    }
};

export const addUserInTravelRequestResuests = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    const request_id  = req.params.id;
    if (!request_id || isNaN(Number(request_id))) {
        return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Request ID is required and should be a number.' });
    }
    const travelRequest = await prisma.requestTraveller.findFirst({
        where: { id: Number(request_id), user_id: { not: user.id } }, // Ensure the request belongs to another user
    })
    const usersClicked = travelRequest?.usersClicked ? travelRequest.usersClicked : [];
    if (!travelRequest) {
        return res.status(404).send({ status: 404, error: 'Not Found', error_description: 'Travel request not found.' });
    }
    const usersClickedArray = Array.isArray(usersClicked) ? usersClicked : [];
    if (!usersClickedArray.includes(user.id)) {
        usersClickedArray.push(user.id);
        await prisma.requestTraveller.update({
            where: { id: Number(request_id) },
            data: { usersClicked: usersClickedArray }
        });
        return res.status(200).send({ status: 200, message: 'User added to travel request', usersClicked: usersClickedArray });
    }
}

export const createTravelRequest = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user_id = req.user.id;
        const { destinationName, destination_latitude, destination_longitude, gender, date, date_type, traveler_type, budget_type, description , end_date, count} = req.body;
        
        if(gender !== 0 && gender !== 1 && gender !== 2) {
            return res.send({status: 400, error_description: 'gender must be 0 for any, 1 for male or 2 for female.'})
        }
        if(date_type !== 0 && date_type !== 1) {
            return res.send({status: 400, error_description: 'date_type must be 0 for flexible or 1 for fixed date.'})
        }
        if(budget_type !== 0 && budget_type !== 1) {
            return res.send({status: 400, error_description: 'budget_type must be 0 for backpacking or 1 for premium.'})
        }
        if(date && isNaN(Date.parse(date))) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Date should be a valid date string.',
            });
        }

        const travelRequest = await prisma.requestTraveller.create({
            data: {
                user_id,
                destinationName,
                destination_latitude: Number(destination_latitude),
                destination_longitude: Number(destination_longitude),
                gender,
                date,
                date_type,
                traveler_type,
                budget_type,
                description,
                end_date,
                count
            }
        })

        if(!travelRequest){
            return res.status(500).send({ status: 500, error: 'Internal Server Error', error_description: 'Failed to create travel request.' });
        }

        return res.status(200).send({ status: 200, message: 'Travel request created', travelRequest: travelRequest });
    } catch (error) {
        return next(error);
    }
}

const getMyTravelRequests = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user_id = req.user.id;

        const travelRequests = await prisma.requestTraveller.findMany({
            where: { user_id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        image: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const travelRequestsWithUsersClickedDetails = await Promise.all(travelRequests.map(async (request) => {
            const usersClicked = request.usersClicked || [];
            const usersClickedArray = Array.isArray(usersClicked) ? usersClicked.filter((id): id is number => id !== null) : [];
            const userDetails = await prisma.user.findMany({
                where: { id: { in: usersClickedArray } },
                select: {
                    id: true,
                    username: true,
                    image: true
                }
            });
            return {
                ...request,
                usersClickedDetails: userDetails,
                usersClickedCount: usersClickedArray.length,
            };
        }))

        return res.status(200).send({ status: 200, message: 'Ok', travelRequests: travelRequestsWithUsersClickedDetails });
    } catch (error) {
        return next(error);
    }
}

const deleteTravelRequestById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user_id = req.user.id;
        const { request_id } = req.params;

        if (!request_id || isNaN(Number(request_id))) {
            return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Request ID is required and should be a number.' });
        }

        const travelRequest = await prisma.requestTraveller.findFirst({
            where: { id: Number(request_id), user_id },
        });

        if (!travelRequest) {
            return res.status(404).send({ status: 404, error: 'Not Found', error_description: 'Travel request not found.' });
        }

        await prisma.requestTraveller.delete({ where: { id: Number(request_id) } });

        return res.status(200).send({ status: 200, message: 'Travel request deleted successfully.' });
    } catch (error) {
        return next(error);
    }
}

const getAllTravelRequests = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const blockedUsers = await prisma.block.findMany({
            where: { user_id: req.user.id },
            select: {
                blocked_id: true,
            },
        })
        const blockedUserIds = blockedUsers.map((user) => user.blocked_id)
        const travelRequestsall = await prisma.requestTraveller.findMany({
            where: {
                user_id: { not: req.user.id },
                user: {
                    id: { notIn: blockedUserIds }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        image: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const travelRequests = await Promise.all(travelRequestsall.map(async (request) => {
            let status = 0;
            const isFollowing = await prisma.follows.findFirst({
                where: {
                    user_id: request.user.id,
                    follower_id: req.user.id,
                },
            });

            const isRequested = await prisma.followRequest.findFirst({
                where: {
                    user_id: request.user.id,
                    follower_id: req.user.id,
                    status: 0,
                },
            });

            if (isRequested) {
                status = 1; // requested
            } else if (isFollowing) {
                status = 2; // following
            }

            return {
                ...request,
                isFollowing: status,
            };
        }))
        
       
        return res.status(200).send({ status: 200, message: 'Ok', travelRequests });
    } catch (error) {
        return next(error);
    }
}

export const filterTravelRequests = async (
    req: ExtendedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const user_id = req.user.id;
  
      const {
        destinationName,
        gender,
        date,
        end_date,
        date_type,
        traveler_type,
        budget_type,
        count,
      } = req.query as Record<string, string>;
  
      const where: any = { user_id };
  
      if (destinationName)   where.destinationName = destinationName;
      if (gender)            where.gender         = Number(gender);
      if (date_type)         where.date_type      = Number(date_type);
      if (traveler_type)     where.traveler_type  = traveler_type;
      if (budget_type)       where.budget_type    = Number(budget_type);
      if (count)             where.count          = Number(count);
  
      // Date filtering
      if (date && end_date) {
        where.AND = [
          { date:     { gte: new Date(date) } },
          { end_date: { lte: new Date(end_date) } },
        ];
      } else if (date) {
        const day = new Date(date);
        day.setUTCHours(0,0,0,0);
        const next = new Date(day);
        next.setUTCDate(day.getUTCDate()+1);
        where.date = { gte: day, lt: next }
      } else if (end_date) {
        const day = new Date(end_date);
        day.setUTCHours(0,0,0,0);
        const next = new Date(day);
        next.setUTCDate(day.getUTCDate()+1);
        where.end_date = { gte: day, lt: next }
      }

        // Exclude requests made by the current user
        where.user_id = { not: user_id };
  
      const travelRequestsall = await prisma.requestTraveller.findMany({
        where,
        include: {
          user: {
            select: { id: true, username: true, image: true },
          },
        },
        orderBy: { created_at: 'desc' },
      });

      const travelRequests = await Promise.all(travelRequestsall.map(async (request) => {
        let status = 0;
        const isFollowing = await prisma.follows.findFirst({
            where: {
                user_id: request.user.id,
                follower_id: req.user.id,
            },
        });

        const isRequested = await prisma.followRequest.findFirst({
            where: {
                user_id: request.user.id,
                follower_id: req.user.id,
                status: 0,
            },
        });

        if (isRequested) {
            status = 1; // requested
        } else if (isFollowing) {
            status = 2; // following
        }

        return {
            ...request,
            isFollowing: status,
        };
    }))
  
      return res.status(200).json({ status: 200, message: 'Ok', travelRequests });
    } catch (error) {
      next(error);
    }
  };

  const getTravelRequestsByDestinationId = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const { destination_id } = req.params;

        if (!destination_id) {
            return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Destination Name as destination_id is required and should be a string.' });
        }

        const travelRequestsDest = await prisma.requestTraveller.findMany({
            where: { destinationName: destination_id },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        image: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        const travelRequestWithFollowingStatus = await Promise.all(travelRequestsDest.map(async (request) => {
            let status = 0;
            const isFollowing = await prisma.follows.findFirst({
                where: {
                    user_id: request.user.id,
                    follower_id: req.user.id,
                },
            });

            const isRequested = await prisma.followRequest.findFirst({
                where: {
                    user_id: request.user.id,
                    follower_id: req.user.id,
                    status: 0,
                },
            });

            if (isRequested) {
                status = 1; // requested
            } else if (isFollowing) {
                status = 2; // following
            }

            return {
                ...request,
                isFollowing: status,
            };
        }))

        const otherRequests = await prisma.requestTraveller.findMany({
            where: {
                destinationName: { not: destination_id },
                user: {
                    id: { not: req.user.id }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        image: true
                    }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        const otherRequestsWithFollowingStatus = await Promise.all(otherRequests.map(async (request) => {
            let status = 0;
            const isFollowing = await prisma.follows.findFirst({
                where: {
                    user_id: request.user.id,
                    follower_id: req.user.id,
                },
            });

            const isRequested = await prisma.followRequest.findFirst({
                where: {
                    user_id: request.user.id,
                    follower_id: req.user.id,
                    status: 0,
                },
            });

            if (isRequested) {
                status = 1; // requested
            } else if (isFollowing) {
                status = 2; // following
            }

            return {
                ...request,
                isFollowing: status,
            };
        }))
        
        return res.status(200).send({ status: 200, message: 'Ok', destination: travelRequestWithFollowingStatus, other: otherRequestsWithFollowingStatus });
    } catch (error) {
        return next(error);
    }
}

const getAllAirports = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const airports = await prisma.airport.findMany({
            select: {
                airportCode: true,
                airportName: true,
                cityName: true,
                cityCode: true,
                countryCode: true,
                country: true,
                continentCode: true,
            },
            orderBy: { airportName: 'asc' }
        });

        return res.status(200).send({ status: 200, message: 'Ok', airports });
    } catch (error) {
        return next(error);
    }
}

const getAirportDetailsByAirportCode = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const { airport_code } = req.params;

        if (!airport_code || typeof airport_code !== 'string') {
            return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Airport code is required and should be a string.' });
        }

        const airportDetails = await prisma.airport.findFirst({
            where: {
                airportCode: airport_code
            }
        })

        if (!airportDetails) {
            return res.status(404).send({ status: 404, error: 'Not Found', error_description: 'Airport not found.' });
        }

        return res.status(200).send({ status: 200, message: 'Ok', airportDetails });
    }
    catch(err){
    return next(err)
    }
}

const domesticPackages = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const categories = await prisma.packageCategory.findMany();
        const states = await prisma.packageState.findMany();
        const domesticPackages = await prisma.package.findMany({
            where: {type: 0}
        })
        const statesWithPackageCount = states.map((state) => {
            const statePackageCount = domesticPackages.filter(
              (pkg) => pkg.state === state.name
            ).length;
          
            return {
              ...state,
              packageCount: statePackageCount,
            };
          });
        return res.status(200).send({ status: 200, message: 'Ok', categories, states: statesWithPackageCount, packages: domesticPackages });
    }catch(err){
        return next(err)
    }
}

const intlPackages = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const categories = await prisma.packageCategory.findMany();
        const countries = await prisma.packageCountry.findMany();
        const intlPackages = await prisma.package.findMany({
            where: {type: 1}
        })
        const countryWithPackageCount = countries.map((country) => {
            const statePackageCount = intlPackages.filter(
              (pkg) => pkg.country === country.name
            ).length;
          
            return {
              ...country,
              packageCount: statePackageCount,
            };
          });
        return res.status(200).send({ status: 200, message: 'Ok', categories, countries: countryWithPackageCount, packages: intlPackages });
    }catch(err){
        return next(err)
    }
}

const getDomesticPackagesByCategoryName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const category = req.params.category;
        const packages = await prisma.package.findMany({
            where: {
                type: 0,
                category: category
            }
        })
        return res.status(200).send({ status: 200, message: 'Ok', packages });

    }catch(err){
        return next(err)
    }
} 

const getIntlPackagesByCategoryName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const category = req.params.category;
        const packages = await prisma.package.findMany({
            where: {
                type: 1,
                category: category
            }
        })
        return res.status(200).send({ status: 200, message: 'Ok', packages });

    }catch(err){
        return next(err)
    }
} 

const getDomesticPackagesByStateName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const state = req.params.state;
        const packages = await prisma.package.findMany({
            where: {
                type: 0,
                state: state
            }
        })
        const citiesFromPackagesArray = packages.map((pkg) => pkg.city);
        return res.status(200).send({ status: 200, message: 'Ok', packages, cities: [...new Set(citiesFromPackagesArray)] });

    }catch(err){
        return next(err)
    }
} 

const getIntlPackagesByCountryName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const country = req.params.country;
        const packages = await prisma.package.findMany({
            where: {
                type: 1,
                country: country
            }
        })
        return res.status(200).send({ status: 200, message: 'Ok', packages });

    }catch(err){
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

const userController = {
    submitQuery,
    domesticPackages,
    intlPackages,
    getPackageById,
    getDomesticPackagesByCategoryName,
    getDomesticPackagesByStateName,
    getIntlPackagesByCategoryName,
    getIntlPackagesByCountryName,
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
    getMarketplaceDetails,
    deleteItenerary,
    test,
    searchUsers,
    getHighlightsByUserId,
    gpt,
    createTravelRequest,
    getMyTravelRequests,
    deleteTravelRequestById,
    getAllTravelRequests,
    addUserToItineraryMembers,
    getFollowersAndFollowing,
    getAirportDetailsByAirportCode,
    getAllAirports,
    getTravelRequestsByDestinationId,
    filterTravelRequests,
    deleteItineraryById,
    addUserInTravelRequestResuests
}

export default userController
