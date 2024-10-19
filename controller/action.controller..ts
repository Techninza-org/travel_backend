import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import helper from '../utils/helpers'
import { PrismaClient } from '@prisma/client'
import { getUserToken, sendFollowNotif, sendFollowNotification, sendPostNotif, sendPostNotification } from '../app'

const prisma = new PrismaClient()

export const LikePost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body
    if (!helper.isValidatePaylod(body, ['post_id', 'action'])) {
        return res
            .status(200)
            .send({ status: 200, error: 'Invalid payload', error_description: 'post_id, action is required.' })
    }
    const { post_id, action } = req.body // action 1 => like, 2 => dislike
    if (typeof post_id !== 'number' || !Number.isInteger(post_id) || post_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Post Id should be a positive integer',
        });
    }
    if (typeof action !== 'number' || !Number.isInteger(action) || action <= 0 || action >= 3) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Action should be a positive integer, either 1 or 2',
        });
    }

    const isAlreadyLiked = await prisma.likes.findFirst({ where: { post_id: post_id, user_id: req.user.id } })
    if (Number(action) === 1) {
        try {
            if (isAlreadyLiked) {
                return res
                    .status(200)
                    .send({ status: 400, error: 'Bad Request', error_description: 'Already liked this post' })
            }
            await prisma.likes.create({ data: { post_id: post_id, user_id: req.user.id } })
            const post = await prisma.post.update({ where: { id: post_id }, data: { likes: { increment: 1 } } })
            const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
            const profile_pic = sender?.image ?? '';
            sendPostNotif(req.user.id, post.user_id, profile_pic, 'New Like', `${req.user.username} liked your post`, String(post_id));
            const receiverToken = await getUserToken(post.user_id);
            if (receiverToken) {
                const payload = {
                    title: 'New Like',
                    body: `${req.user.username} liked your post`
                };
                await sendPostNotification(receiverToken, payload, String(post_id));
            }
            return res.status(200).send({ status: 200, message: 'Ok', post: post })
        } catch (err: unknown) {
            return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Post not found.' })
        }
    } else {
        if (!isAlreadyLiked) {
            return res
                .status(200)
                .send({ status: 400, error: 'Bad Request', error_description: 'No like found for this from this user' })
        }
        const post = await prisma.post.update({ where: { id: post_id }, data: { likes: { decrement: 1 } } })
        const deletedPost = await prisma.likes.deleteMany({ where: { post_id: post_id, user_id: req.user.id } })
        return res.status(200).send({ status: 200, message: 'Ok', post: post })
    }
    }catch(err) {
        return next(err)
    }
}
export const CommentPost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
   try{
    const body = req.body
    if (!helper.isValidatePaylod(body, ['post_id', 'comment'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'post_id, comment is required.' })
    }
    let { post_id, comment } = req.body
    if (typeof post_id !== 'number' || !Number.isInteger(post_id) || post_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Post Id should be a positive integer',
        });
    }
    post_id = Number(post_id)
    const isPostExists = await prisma.post.findFirst({ where: { id: post_id } })
    if (isPostExists) {
        try {
            const commentEntry = await prisma.comment.create({
                data: {
                    comment: comment,
                    postId: post_id,
                    user_id: req.user.id,
                },
            })
            const allComments = await prisma.comment.findMany({
                where: { postId: post_id },
                include: { user: { select: { id: true, username: true, image: true, status: true } } },
            })
            const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
            const profile_pic = sender?.image ?? '';
            sendPostNotif(req.user.id, isPostExists.user_id, profile_pic, 'New Comment', `${req.user.username} commented on your post`, String(post_id));
            const receiverToken = await getUserToken(isPostExists.user_id);
            if (receiverToken) {
                const payload = {
                    title: 'New Comment',
                    body: `${req.user.username} commented on your post`
                };
                await sendPostNotification(receiverToken, payload, String(post_id));
            }
            return res
                .status(200)
                .send({ status: 201, message: 'Created', comment: commentEntry, comments: allComments })
        } catch (err) {
            return next(err)
        }
    } else {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Post not found.' })
    }
   }catch(err){
    return next(err)
   }
}
export const Follows = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body
    if (!helper.isValidatePaylod(body, ['user_id', 'action'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'user_id, action is required.' })
    }
    let { user_id, action } = req.body // action => 1: follow, 2: unfollow

    if (typeof user_id !== 'number' || !Number.isInteger(user_id) || user_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User Id should be a positive integer',
        });
    }
    if (typeof action !== 'number' || !Number.isInteger(action) || action <= 0 || action >= 3) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Action should be a positive integer, either 1 or 2',
        });
    }
    user_id = Number(user_id)
    if(user_id.toString().length > 8){
        return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'user_id too large' })
    }
    const isAlreadyFollowing = await prisma.follows.findFirst({
        where: { user_id: user_id, follower_id: req.user.id },
    })
    if (action === 1) {
        try {
            if (isAlreadyFollowing) {
                return res
                    .status(200)
                    .send({ status: 400, error: 'Bad Request', error_description: 'Already following this user' })
            }
            const entry = await prisma.follows.create({ data: { user_id: user_id, follower_id: req.user.id } })
            return res.status(200).send({ status: 200, message: 'Ok', follow: entry })
        } catch (err) {
            return next(err)
        }
    } else {
        try {
            if (!isAlreadyFollowing) {
                return res
                    .status(200)
                    .send({ status: 400, error: 'Bad Request', error_description: 'Not following this user' })
            }
            const follow = await prisma.follows.deleteMany({ where: { user_id: user_id, follower_id: req.user.id } })
            return res.status(200).send({ status: 200, message: 'Ok', unfollow: follow })
        } catch (err) {
            return next(err)
        }
    }
    return res.sendStatus(500)
    }catch(err){
        return next(err)
    }
}

const unfollowUser = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const body = req.body
    if (!helper.isValidatePaylod(body, ['user_id'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'user_id is required.' })
    }
    let { user_id } = req.body
    if (typeof user_id !== 'number' || !Number.isInteger(user_id) || user_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User Id should be a positive integer',
        });
    }
    user_id = Number(user_id)
    if(user_id.toString().length > 8){
        return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'user_id too large' })
    }
    const isAlreadyFollowing = await prisma.follows.findFirst({
        where: { user_id: user_id, follower_id: req.user.id },
    })
    if (!isAlreadyFollowing) {
        return res.status(200).send({ status: 400, error: 'Bad Request', error_description: 'Not following this user' })
    }
    try {
        const follow = await prisma.follows.deleteMany({ where: { user_id: user_id, follower_id: req.user.id } })
        return res.status(200).send({ status: 200, message: 'Ok', unfollow: follow })
    } catch (err) {
        return next(err)
    }
    }catch(err){
        return next(err)
    }
}

const sendFollowRequest = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const body = req.body
    if (!helper.isValidatePaylod(body, ['user_id'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'user_id is required.' })
    }
    let { user_id } = req.body
    if (typeof user_id !== 'number' || !Number.isInteger(user_id) || user_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'User Id should be a positive integer',
        });
    }
    user_id = Number(user_id)
    if(user_id.toString().length > 8){
        return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'user_id too large' })
    }
    const isAlreadyFollowing = await prisma.follows.findFirst({
        where: { user_id: user_id, follower_id: req.user.id },
    })
    if (isAlreadyFollowing) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Already following this user' })
    }
    const isAlreadyRequested = await prisma.followRequest.findFirst({
        where: { user_id: user_id, follower_id: req.user.id, status: 0 },
    })
    if (isAlreadyRequested) {
        await prisma.followRequest.delete({ where: { id: isAlreadyRequested.id } })
        return res.send({ status: 200, message: 'Follow request deleted' })
    }
    try {
        const entry = await prisma.followRequest.create({ data: { user_id: user_id, follower_id: req.user.id } })
        const title = 'New Friend Request';
        const message = `${req.user.username} has sent you a friend request!`;
        const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
        const profile_pic = sender?.image ?? '';

        sendFollowNotif(req.user.id, user_id, profile_pic, title, message);
        
        const receiverToken = await getUserToken(user_id);
        console.log('Receiver Token:', receiverToken);
        if (!receiverToken) {
            console.log('Receiver not found or has no registration token', user_id);
        } else {
            const payload = {
                title: 'New Friend Request',
                body: `${req.user.username} has sent you a friend request!`
            };
            await sendFollowNotification(receiverToken, payload, String(req.user.id));
            console.log('Notification sent to receiver');
        }
        return res.status(200).send({ status: 200, message: 'Ok', follow: entry })
    } catch (err) {
        return next(err)
    }
}

const getFollowRequests = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const followRequests = await prisma.followRequest.findMany({
            where: { user_id: req.user.id, status: 0 },
            include: {
                follower: {
                    select: { id: true, username: true, image: true },
                },
            },
        })
        return res.status(200).send({ status: 200, message: 'Ok', followRequests: followRequests })
    }catch(err){
        return next(err)
    }
}

const rejectFollowRequest = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
    const body = req.body
    if (!helper.isValidatePaylod(body, ['follower_id'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'follower_id is required.' })
    }
    let { follower_id } = req.body
    if (typeof follower_id !== 'number' || !Number.isInteger(follower_id) || follower_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Follower Id should be a positive integer',
        });
    }
    follower_id = Number(follower_id)
    if(follower_id.toString().length > 8){
        return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'follower_id too large' })
    }
    const followRequest = await prisma.followRequest.findFirst({
        where: { user_id: req.user.id, follower_id: follower_id, status: 0 },
    })
    if (!followRequest) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'No follow request found.' })
    }
    try {
        const entry = await prisma.followRequest.delete({ where: { id: followRequest.id } })
        return res.status(200).send({ status: 200, message: 'Rejected follow request', followRequest: entry })
    } catch (err) {
        return next(err)
    }
} catch (err) {
    return next(err)
}
}

const acceptFollowRequest = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
    const body = req.body
    if (!helper.isValidatePaylod(body, ['follower_id'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'follower_id is required.' })
    }
    let { follower_id } = req.body
    if (typeof follower_id !== 'number' || !Number.isInteger(follower_id) || follower_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Follower Id should be a positive integer',
        });
    }
    follower_id = Number(follower_id)
    if(follower_id.toString().length > 8){
        return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'follower_id too large' })
    }
    const followRequest = await prisma.followRequest.findFirst({
        where: { user_id: req.user.id, follower_id: follower_id, status: 0 },
    })
    if (!followRequest) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'No follow request found.' })
    }
    try {
        const entry = await prisma.follows.create({ data: { user_id: req.user.id, follower_id: follower_id} })
        const deletedEntry = await prisma.followRequest.delete({ where: { id: followRequest.id } })
        const sender = await prisma.user.findUnique({ where: { id: req.user.id } });
        const profile_pic = sender?.image ?? '';
        sendFollowNotif(req.user.id, follower_id, profile_pic, 'New Friend', `${req.user.username} accepted your friend request`);
        const receiverToken = await getUserToken(follower_id);
        if (receiverToken) {
            const payload = {
                title: 'New Friend',
                body: `${req.user.username} accepted your friend request`
            };
            await sendFollowNotification(receiverToken, payload, String(req.user.id));
        }
        
        return res.status(200).send({ status: 200, message: 'Accepted follow request', follow: entry })
    } catch (err) {
        return next(err)
    }
} catch (err) {
    return next(err)
}
}

const reportPost = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
    const body = req.body
    if (!helper.isValidatePaylod(body, ['post_id'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'post_id is required.' })
    }
    let { post_id } = req.body
    if (typeof post_id !== 'number' || !Number.isInteger(post_id) || post_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Post Id should be a positive integer',
        });
    }
    post_id = Number(post_id)
    const post = await prisma.post.findFirst({ where: { id: post_id } })
    if (!post) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Post not found.' })
    }
    try {
        const totalReports = await prisma.postReport.count({ where: { post_id: post_id } })
        if (totalReports > 4) {
            await prisma.post.delete({ where: { id: post_id } })
            return res.status(200).send({ status: 200, message: 'Post deleted', post_id: post_id })
        }
    } catch (err) {
        return next(err)
    }
    try {
        const alreadyReported = await prisma.postReport.findFirst({ where: { post_id: post_id, user_id: req.user.id } })
        if (alreadyReported) {
            return res
                .status(200)
                .send({ status: 400, error: 'Bad Request', error_description: 'Already reported this post' })
        }
        const entry = await prisma.postReport.create({ data: { post_id: post_id, user_id: req.user.id } })
        return res.status(200).send({ status: 200, message: 'Ok', report: entry })
    } catch (err) {
        return next(err)
    }
} catch (err) {
    return next(err)
}
}

const reportForumQuestion = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
    const body = req.body
    if (!helper.isValidatePaylod(body, ['question_id'])) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'question_id is required.' })
    }
    let { question_id } = req.body
    if (typeof question_id !== 'number' || !Number.isInteger(question_id) || question_id <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Question Id should be a positive integer',
        });
    }
    question_id = Number(question_id)
    const question = await prisma.forumQuestion.findFirst({ where: { id: question_id } })
    if (!question) {
        return res.status(200).send({ status: 404, error: 'Not found', error_description: 'Question not found.' })
    }
    try {
        const totalReports = await prisma.forumReport.count({ where: { question_id: question_id } })
        if (totalReports > 4) {
            await prisma.forumReport.delete({ where: { id: question_id } })
            return res.status(200).send({ status: 200, message: 'Forum deleted', forum_id: question_id })
        }
    } catch (err) {
        return next(err)
    }
    try {
        const alreadyReported = await prisma.forumReport.findFirst({
            where: { id: question_id, user_id: req.user.id },
        })
        if (alreadyReported) {
            return res
                .status(200)
                .send({ status: 400, error: 'Bad Request', error_description: 'Already reported this question' })
        }
        const entry = await prisma.forumReport.create({ data: { question_id: question_id, user_id: req.user.id } })
        return res.status(200).send({ status: 200, message: 'Ok', report: entry })
    } catch (err) {
        return next(err)
    }
} catch (err) {
    return next(err)
}
}

const actionController = {
    LikePost,
    CommentPost,
    Follows,
    sendFollowRequest,
    getFollowRequests,
    rejectFollowRequest,
    acceptFollowRequest,
    unfollowUser,
    reportPost,
    reportForumQuestion
}
export default actionController
