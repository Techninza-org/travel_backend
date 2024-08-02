import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import helper from '../utils/helpers'
import { PrismaClient } from '@prisma/client'
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'
import { s3 } from '../app'
const prisma = new PrismaClient()
import dotenv from 'dotenv'
dotenv.config()

export const CreatePost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const body = req.body
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
        const post = await prisma.post.create({
            data: {
                image: `https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`,
                description: body.description,
                user_id: user.id,
                media_type: body.media_type,
                latitude: body.latitude,
                longitude: body.longitude,
                place: body.place,
            },
        })
        return res.status(200).send({ status: 201, message: 'Created', post: post })
}

export const createTemplate = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const body = req.body
    // let transitionArray = []
    // if (req.files && Array.isArray(req.files)) {
    //     for (let i = 0; i < req.files.length; i++) {
    //         const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
    //         const imageName = randomImageName()
    //         const params = {
    //             Bucket: process.env.BUCKET_NAME!,
    //             Key: imageName,
    //             Body: req.files[i].buffer,
    //             ContentType: req.files[i].mimetype,
    //         }
    //         const command = new PutObjectCommand(params)
    //         await s3.send(command)
    //         transitionArray.push(`https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`)
    //     }
    // }
    const post = await prisma.post.create({
        data: {
            description: body.description,
            user_id: user.id,
            media_type: body.media_type,
            latitude: body.latitude,
            longitude: body.longitude,
            place: body.place,
            duration: body.duration,
            soundName: body.soundName,
            filterName: {
                create: {
<<<<<<< HEAD
                    name: body.filterName.name,
                    t1: body.filterName.t1,
                    t2: body.filterName.t2,
                    t3: body.filterName.t3,
                    t4: body.filterName.t4,
                    t5: body.filterName.t5,
                    t6: body.filterName.t6,
                },
=======
                    idx: filterName.idx,//changes by Vivek
                    name: filterName.name,
                    t1: filterName.t1,
                    t2: filterName.t2,
                    t3: filterName.t3,
                    t4: filterName.t4,
                    t5: filterName.t5,
                    t6: filterName.t6
                }
            },
            transitionData: {
                create: transitionData.map((td: any) => ({
                    transitionType: td.transitionType,
                    imageurl: td.imageurl,
                    mediaType: td.mediaType
                }))
>>>>>>> a39c24df439b73a829656d0e05b2cdd24399bccd
            },
            transitions: body.transitions
        },
    })
    return res.status(200).send({ status: 201, message: 'Created', template: post })
}

export const GetOnlyVideos = async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
    const user = req.user
    const query = req.query
    const { page = 1, limit = 20 } = query
    if (Number.isNaN(page) || Number.isNaN(limit))
        return res.status(200).send({
            status: 400,
            error: 'Invalid query parameters',
            error_description: 'skip, limit should be a number',
        })

    const skip = (Number(page) - 1) * Number(limit)
    try {
        const blockedUsers = await prisma.block.findMany({
            where: { user_id: user.id },
            select: {
                blocked_id: true,
            },
        })
        const blockedUserIds = blockedUsers.map((user) => user.blocked_id)
        const fetchPosts = await prisma.post.findMany({
            where: { media_type: 'VIDEO', user_id: { notIn: blockedUserIds } },
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
            },
            orderBy: { created_at: 'desc' },
            skip: skip,
            take: Number(limit),
        })
        for (let i = 0; i < fetchPosts.length; i++) {
            const isLiked = await prisma.likes.findFirst({
                where: { post_id: fetchPosts[i].id, user_id: req.user.id },
            })
            //@ts-ignore
            fetchPosts[i].isLiked = isLiked ? true : false
        }
        return res.status(200).send({ status: 200, message: 'Ok', posts: fetchPosts })
    } catch (err) {
        return _next(err)
    }
}

export const GetPosts = async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
    try {
        const user = req.user
        const posts = await prisma.post.findMany({ where: { user_id: user.id }, orderBy: { created_at: 'desc' } })
        return res.status(200).send({ status: 200, message: 'Ok', posts })
    } catch (err) {
        return _next(err)
    }
}

export const GetPostsByUserId = async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
    const id = Number(req.body.userId)
    const isFollowing = await prisma.follows.findFirst({
        where: { user_id: id, follower_id: req.user.id },
    })
    const isRequested = await prisma.followRequest.findFirst({
        where: { user_id: id, follower_id: req.user.id },
    })
    const posts = await prisma.post.findMany({
        where: { user_id: id },
        include: {
            comment: {
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            image: true,
                        },
                    },
                },
            },
            user: {
                select: {
                    id: true,
                    username: true,
                    image: true,
                    status: true,
                },
            },
            filterName: true,
        },
    })
    for (let i = 0; i < posts.length; i++) {
        const isLiked = await prisma.likes.findFirst({
            where: { post_id: posts[i].id, user_id: req.user.id },
        })
        //@ts-ignore
        posts[i].isLiked = isLiked ? true : false
    }
    const user = await prisma.user.findFirst({
        where: { id: id },
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
            trips: {
                include: {
                    service: true,
                },
            },
        },
    })
    delete (user as any).password
    const follower_count = await prisma.follows.count({ where: { user_id: id } })
    const trip_count = await prisma.trip.count({ where: { user_id: id } })

    return res.status(200).send({
        status: 200,
        message: 'Ok',
        posts,
        user_follower_count: follower_count,
        user_trip_count: trip_count,
        user: user,
        isFollowing: isFollowing ? true : false,
        isRequested: isRequested ? true : false,
    })
}

export const GetSpecificPost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    let postId: string | number = req.params.id
    if (!postId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(post) is required in params.' })
    }
    postId = Number(postId)
    if (Number.isNaN(postId)) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(post) should be a number.' })
    }

    const post = await prisma.post.findFirst({
        where: { id: postId },
        include: {
            comment: true,
            user: {
                select: {
                    id: true,
                    username: true,
                    image: true,
                },
            },
        },
    })
    const follower_count = await prisma.follows.count({ where: { user_id: post?.user_id } })
    const trip_count = await prisma.trip.count({ where: { user_id: post?.user_id } })
    if (!post) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Post not found.' })
    }
    return res
        .status(200)
        .send({ status: 200, message: 'Ok', post, user_follower_count: follower_count, user_trip_count: trip_count })
}

export const DeletePost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const param = req.params
    if (!helper.isValidatePaylod(param, ['id'])) {
        return res
            .status(200)
            .send({ status: 200, error: 'Invalid payload', error_description: 'id(post) is required.' })
    }
    let postId: string | number = param.id
    if (!postId) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(post) is required in body.' })
    }
    postId = Number(postId)
    if (Number.isNaN(postId)) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(post) should be a number.' })
    }

    try {
        const post = await prisma.post.findFirst({ where: { id: postId, user_id: req.user.id } })
        if (!post) {
            return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Post not found.' })
        }
        if(post.image){
            const params = {
                Bucket: process.env.BUCKET_NAME!,
                Key: post.image,
            }
            const command = new DeleteObjectCommand(params)
            await s3.send(command)
        }
        const deleted_post = await prisma.post.delete({ where: { id: postId, user_id: req.user.id } })
        return res.status(200).send({ status: 202, message: 'Accepted', post: deleted_post })
    } catch (err) {
        console.log(err)
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Post not found.' })
    }
}
const postController = { CreatePost, GetPosts, GetSpecificPost, DeletePost, GetOnlyVideos, GetPostsByUserId, createTemplate }
export default postController
