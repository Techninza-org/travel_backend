import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import { PrismaClient } from '@prisma/client'
import helper from '../utils/helpers'
import { getUserToken, sendForumNotif, sendForumNotification } from '../app'
const prisma = new PrismaClient()

const createForumQuestion = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const body = req.body
    try {
        if (!helper.isValidatePaylod(body, ['question'])) {
            return res.status(200).send({ error: 'Invalid payload', error_description: 'question is required.' })
        }
        const forumQuestion = await prisma.forumQuestion.create({
            data: {
                question: body.question.trim(),
                location: body.location,
                latitude: body.latitude,
                longitude: body.longitude,
                user: { connect: { id: user.id, username: user.username, image: user.image } },
            },
        })
        return res.status(200).send({ message: 'forum question created', forumQuestion })
    } catch (err) {
        return next(err)
    }
}

const getAllForumQuestions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const forumQuestions = await prisma.forumQuestion.findMany({
            include: {
                user: { select: { id: true, username: true, image: true, status: true } },
                answers: { include: { User: { select: { id: true, username: true, image: true, status: true } } } },
                likes: { select: { user_id: true } },
            },
        })

        const forumQuestionsWithAnswerAndLikeCount = forumQuestions.map((question) => ({
            ...question,
            answerCount: question.answers.length,
            likeCount: question.likes.length,
            isLiked: question.likes.some((like) => like.user_id === req.user.id),
        }))

        return res.status(200).send({ forumQuestions: forumQuestionsWithAnswerAndLikeCount })
    } catch (err) {
        return next(err)
    }
}

const getForumQuestionsByLocation = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const location = req.body.location.trim()
    if (typeof location !== 'string' || location === null || location === 'null') {
        return res.status(400).send({ error: 'Invalid location' })
    }
    try {
        const forumQuestions = await prisma.forumQuestion.findMany({
            where: { location: { contains: location } },
            include: {
                user: { select: { id: true, username: true, image: true, status: true } },
                answers: { include: { User: { select: { id: true, username: true, image: true, status: true } } } },
                likes: { select: { user_id: true } },
            },
        })

        const forumQuestionsWithAnswerAndLikeCount = forumQuestions.map((question) => ({
            ...question,
            answerCount: question.answers.length,
            likeCount: question.likes.length,
            isLiked: question.likes.some((like) => like.user_id === req.user.id),
        }))

        return res.status(200).send({ forumQuestions: forumQuestionsWithAnswerAndLikeCount })
    } catch (err) {
        return next(err)
    }
}

const getForumQuestion = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const questionId = Number(req.params.id)
    try {
        const forumQuestion = await prisma.forumQuestion.findUnique({
            where: { id: questionId },
            include: {
                user: { select: { id: true, username: true, image: true } },
                answers: { include: { User: { select: { id: true, username: true, image: true } } } },
            },
        })
        return res.status(200).send({ forumQuestion })
    } catch (err) {
        return next(err)
    }
}

const createAnswer = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const questionId = Number(req.params.id)
    const body = req.body
    const postedBy = await prisma.forumQuestion.findUnique({ where: { id: questionId }, select: { user_id: true } })
    const postedById = Number(postedBy?.user_id)
    try {
        if (!helper.isValidatePaylod(body, ['answer'])) {
            return res.status(200).send({ error: 'Invalid payload', error_description: 'answer is required.' })
        }
        const forumAnswer = await prisma.forumAnswer.create({
            data: { answer: body.answer, user_id: user.id, question_id: questionId },
        })
        const allAnswers = await prisma.forumAnswer.findMany({
            where: { question_id: questionId },
            include: { User: { select: { id: true, username: true, image: true } } },
        })
        if (postedById !== user.id) {
            const sender = await prisma.user.findUnique({ where: { id: req.user.id } })
            const profile_pic = sender?.image ?? ''
            sendForumNotif(
                user.id,
                postedById,
                profile_pic,
                'Question Answered',
                `${req.user.username} answered your question`,
                String(questionId)
            )
            const receiverToken = await getUserToken(postedById)
            if (receiverToken) {
                const payload = {
                    title: 'New Answer',
                    body: `${req.user.username} answered your question`,
                }
                await sendForumNotification(receiverToken, payload, String(questionId))
            }
        }
        return res.status(200).send({ message: 'forum answer created', allAnswers })
    } catch (err) {
        return next(err)
    }
}

export const likeQuestion = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const questionId = Number(req.params.id)
    if (!questionId) {
        return res.status(400).send({ error: 'Invalid payload', error_description: 'question id is required.' })
    }
    if (typeof questionId !== 'number' || !Number.isInteger(questionId) || questionId <= 0) {
        return res.status(400).send({
            status: 400,
            error: 'Bad Request',
            error_description: 'Question Id should be a positive integer',
        })
    }
    const postedBy = await prisma.forumQuestion.findUnique({ where: { id: questionId }, select: { user_id: true } })
    const postedById = Number(postedBy?.user_id)
    try {
        const isLiked = await prisma.qLikes.findFirst({
            where: { question_id: questionId, user_id: user.id },
        })
        if (isLiked) {
            await prisma.qLikes.delete({ where: { id: isLiked.id } })
            return res.status(200).send({ message: 'Question unliked' })
        } else {
            await prisma.qLikes.create({ data: { question_id: questionId, user_id: user.id } })
            if (postedById !== user.id) {
                const sender = await prisma.user.findUnique({ where: { id: req.user.id } })
                const profile_pic = sender?.image ?? ''
                sendForumNotif(
                    user.id,
                    postedById,
                    profile_pic,
                    'Question Liked',
                    `${req.user.username} liked your question`,
                    String(questionId)
                )
                const receiverToken = await getUserToken(postedById)
                if (receiverToken) {
                    const payload = {
                        title: 'New Like',
                        body: `${req.user.username} liked your question`,
                    }
                    await sendForumNotification(receiverToken, payload, String(questionId))
                }
            }
            return res.status(200).send({ message: 'Question liked' })
        }
    } catch (err) {
        return next(err)
    }
}

export const deleteForum = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const questionId = Number(req.params.id)
        if (!questionId) {
            return res.status(400).send({ error: 'Invalid payload', error_description: 'question id is required.' })
        }
        if (typeof questionId !== 'number' || !Number.isInteger(questionId) || questionId <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Question Id should be a positive integer',
            })
        }
        const forum = await prisma.forumQuestion.findUnique({where: {id: questionId, user_id: user.id}})
        if(!forum) return res.status(400).send({msg: "Forum not found, or user not posted this forum."})
        const deletedForum = await prisma.forumQuestion.delete({where: {id: questionId}})
        return res.status(200).send({msg: "Forum deleted", deletedForum})
    } catch (err) {
        return next(err)
    }
}

const forumController = {
    createForumQuestion,
    getAllForumQuestions,
    getForumQuestion,
    createAnswer,
    likeQuestion,
    getForumQuestionsByLocation,
    deleteForum
}

export default forumController
