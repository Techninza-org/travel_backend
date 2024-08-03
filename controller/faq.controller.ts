import type { NextFunction, Request, Response } from 'express'
import { STATUS_CODES } from 'node:http'
import { PrismaClient } from '@prisma/client'
import helper from '../utils/helpers'
const prisma = new PrismaClient()

const getFAQ = async (req: Request, res: Response, next: NextFunction) => {
   try{ const query = req.query
    let { page = 1, limit = 10, search } = query
    limit = Number(limit)
    page = Number(page)
    if (Number.isNaN(page) || Number.isNaN(limit))
        return res.status(200).send({
            status: 400,
            error: 'Invalid query parameters',
            error_description: 'skip, limit should be a number',
        })
    const skip = (Number(page) - 1) * Number(limit)
    let faqs
    if (!search) {
        faqs = await prisma.fAQ.findMany({
            select: { id: true, title: true, description: true },
            skip: skip,
            take: limit,
        })
    } else {
        faqs = await prisma.fAQ.findMany({
            where: {
                title: { contains: search as string },
            },
            skip: skip,
            take: limit,
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
        const faq = await prisma.fAQ.findUnique({ where: { id: Number(id) } })
        return res.status(200).send({ message: "faq", faq })
    } catch (err) {
        return next(err)
    }
}

export { getFAQ, createFAQ, getFaqById }
