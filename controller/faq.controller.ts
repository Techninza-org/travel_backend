import type { NextFunction, Request, Response } from 'express'
import { STATUS_CODES } from 'node:http'
import { PrismaClient } from '@prisma/client'
import helper from '../utils/helpers'
const prisma = new PrismaClient()

const getFAQ = async (req: Request, res: Response, next: NextFunction) => {
   try{ const query = req.query
    let { page = 1, limit = 10, search } = query
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
    let faqs
    if (!search) {
        faqs = await prisma.fAQ.findMany({
            select: { id: true, title: true, description: true },
            skip: skip,
            take: Number(limit),
        })
    } else {
        faqs = await prisma.fAQ.findMany({
            where: {
                title: { contains: search as string },
            },
            skip: skip,
            take: Number(limit),
            select: { id: true, title: true, description: true },
        })
    }
    return res.status(200).send({ message: STATUS_CODES['200'], faqs })
}catch(err){
    return next(err)
}
}

const createFAQ = async (req: Request, res: Response, next: NextFunction) => {
    const body = req.body
    try {
        if (!helper.isValidatePaylod(body, ['title', 'description'])) {
            return res
                .status(200)
                .send({ error: 'Invalid payload', error_description: 'description & title is required.' })
        }
        const faq = await prisma.fAQ.create({ data: { description: body.description, title: body.title } })
        return res.status(200).send({ message: "faq created", faq })
    } catch (err) {
        return next(err)
    }
}

const getFaqById = async (req: Request, res: Response, next: NextFunction) => {
    const id = req.params.id
    try {
        if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Id should be a positive integer',
            });
        }
        const faq = await prisma.fAQ.findUnique({ where: { id: Number(id) } })
        return res.status(200).send({ message: "faq", faq })
    } catch (err) {
        return next(err)
    }
}

export { getFAQ, createFAQ, getFaqById }
