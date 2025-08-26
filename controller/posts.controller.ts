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
    try {
        const user = req.user
        const body = req.body
        // console.log(req.file, 'req.file');

        // const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
        // const imageName = randomImageName()
        // const params = {
        //     Bucket: process.env.BUCKET_NAME!,
        //     Key: imageName,
        //     Body: req.file?.buffer,
        //     ContentType: req.file?.mimetype,
        // }
        // console.log(params, 'params');

        // const command = new PutObjectCommand(params)
        // const uploadres = await s3.send(command)
        const post = await prisma.post.create({
            data: {
                image: body.image,
                description: body.description,
                user_id: user.id,
                media_type: body.media_type,
                thumbnail: body.thumbnail,
                latitude: body.latitude,
                longitude: body.longitude,
                place: body.place,
            },
        })

        return res.status(200).send({ status: 201, message: 'Created', post: post })
    } catch (err) {
        return next(err)
    }
}

export const createTemplate = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const body = req.body
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
                thumbnail: body.thumbnail,
                filterName: {
                    create: {
                        name: body.filterName.name,
                        t1: body.filterName.t1,
                        t2: body.filterName.t2,
                        t3: body.filterName.t3,
                        t4: body.filterName.t4,
                        t5: body.filterName.t5,
                        t6: body.filterName.t6,
                    },
                },
                transitions: body.transitions,
            },
        })
        return res.status(200).send({ status: 201, message: 'Created', template: post })
    } catch (err) {
        return next(err)
    }
}

export const getAdminTemplates = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const templates = await prisma.post.findMany({
            where: { media_type: 'TEMPLATE', user_id: {in: [3, 171]} },
            include: {
                filterName: true,
            },
            orderBy: { created_at: 'desc' },
        })
        return res.status(200).send({ status: 200, message: 'Ok', templates })
    } catch (err) {
        return next(err)
    }
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

function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const toRad = (deg: number) => deg * (Math.PI / 180);
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  export const getMemories = async (
    req: ExtendedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user.id;
  
      // 1. Fetch all posts for this user
      const posts = await prisma.post.findMany({
        where: { user_id: userId, media_type: 'IMAGE'},
        orderBy: { created_at: 'desc' },
      });
  
      // 2. Cluster posts by 200m radius
      interface Cluster {
        latitude: number;
        longitude: number;
        posts: typeof posts;
      }
      const clusters: Cluster[] = [];
      const noLocationCluster: { posts: typeof posts } = { posts: [] };
  
      for (const post of posts) {
        const lat = post.latitude ? parseFloat(post.latitude) : null;
        const lng = post.longitude ? parseFloat(post.longitude) : null;
  
        if (lat === null || lng === null) {
          // Collect posts with missing coords separately
          noLocationCluster.posts.push(post);
          continue;
        }
  
        // Try to fit into an existing cluster
        let added = false;
        for (const cluster of clusters) {
          const dist = haversineDistance(
            lat, lng,
            cluster.latitude, cluster.longitude
          );
          if (dist <= 200) {
            cluster.posts.push(post);
            added = true;
            break;
          }
        }
  
        if (!added) {
          // Start a new cluster centered at this post
          clusters.push({
            latitude: lat,
            longitude: lng,
            posts: [post],
          });
        }
      }
  
      // 3. Format response
    const allPosts = clusters.map(c => ({
        latitude: c.latitude as number | null,
        longitude: c.longitude as number | null,
        posts: c.posts,
    }));
    if (noLocationCluster.posts.length) {
        allPosts.push({
            latitude: null as number | null,
            longitude: null as number | null,
            posts: noLocationCluster.posts,
        });
    }
  
      return res.status(200).json({
        status: 200,
        message: 'Ok',
        allPosts,
      });
    } catch (err) {
      return next(err);
    }
  };


export const GetPostsByUserId = async (req: ExtendedRequest, res: Response, _next: NextFunction) => {
    try {
        const id = Number(req.body.userId)
        if (isNaN(id))
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id should be a number.' })
        if (!Number.isInteger(id))
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id should be a integer.' })

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
        if (!user)
            return res.status(200).send({ status: 404, error: 'Not found', error_description: 'User not found.' })
        delete (user as any).password
        const follower_count = await prisma.follows.count({ where: { user_id: id } })
        const trip_count = await prisma.trip.count({ where: { user_id: id } })

        console.log(user, 'userdata');
        

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
    } catch (err) {
        return _next(err)
    }
}

export const GetSpecificPost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        let postId: string | number = req.params.id
        if (!postId) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(post) is required in params.' })
        }
        postId = Number(postId)
        if (Number.isNaN(postId) || !Number.isInteger(postId)) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(post) should be a integer.' })
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
        const isLiked = await prisma.likes.findFirst({
            where: { post_id: post.id, user_id: req.user.id },
        })
        //@ts-ignore
        post.isLiked = isLiked ? true : false
        return res.status(200).send({
            status: 200,
            message: 'Ok',
            post,
            user_follower_count: follower_count,
            user_trip_count: trip_count,
        })
    } catch (err) {
        return next(err)
    }
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
    if (Number.isNaN(postId) || !Number.isInteger(postId)) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(post) should be a integer.' })
    }

    try {
        const post = await prisma.post.findFirst({ where: { id: postId, user_id: req.user.id } })
        if (!post) {
            return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Post not found.' })
        }
        if (post.image) {
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

export const editPost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const body = req.body

        const param = req.params
        if (!helper.isValidatePaylod(param, ['id'])) {
            return res
                .status(200)
                .send({ status: 200, error: 'Invalid payload', error_description: 'id(post) is required.' })
        }

        const postId = Number(req.params.id)

        const { description, latitude, longitude, place } = body
        if (typeof postId !== 'number' || !Number.isInteger(postId) || postId <= 0)
            return res.status(400).send({ status: 400, error: 'postId should be a positive integer' })
        if (description) {
            if (typeof description !== 'string')
                return res.status(400).send({ status: 400, error: 'Description should be a string' })
        }
        if (latitude) {
            if (typeof latitude !== 'string')
                return res.status(400).send({ status: 400, error: 'latitude should be a string' })
        }
        if (longitude) {
            if (typeof longitude !== 'string')
                return res.status(400).send({ status: 400, error: 'longitude should be a string' })
        }
        if (place) {
            if (typeof place !== 'string')
                return res.status(400).send({ status: 400, error: 'latitude should be a string' })
        }

        const post = await prisma.post.findUnique({ where: { id: postId, user_id: user.id } })
        if (!post) {
            return res.status(400).send({ status: 400, error: 'Post not found' })
        }
        const updatedPost = await prisma.post.update({
            where: { id: postId },
            data: {
                description: description,
                latitude: latitude,
                longitude: longitude,
                place: place,
            },
        })

        return res.status(200).send({ message: 'Post updated successfully', post: updatedPost })
    } catch (err) {
        return next(err)
    }
}

const postController = {
    CreatePost,
    GetPosts,
    GetSpecificPost,
    DeletePost,
    GetOnlyVideos,
    GetPostsByUserId,
    createTemplate,
    editPost,
    getMemories,
    getAdminTemplates
}
export default postController
