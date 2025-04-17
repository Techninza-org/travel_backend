import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import helper from '../utils/helpers'
import { PrismaClient } from '@prisma/client'
import { connect } from 'node:http2'
const prisma = new PrismaClient()

export const CreateExpense = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user
    const body = req.body
    const { trip_id, amount, category, note } = body
    
    if (!helper.isValidatePaylod(body, ['amount', 'category', 'trip_id'])) { return res.status(200).send({ status: 200, error: 'Invalid payload', error_description: 'trip_id, amount, category is required.' }) }
    if (typeof trip_id !== 'number' || !Number.isInteger(trip_id) || trip_id <= 0) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Trip id should be a positive integer value', }); }
    if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Amount should be a positive integer value', }); }
    
    if (typeof category !== 'string') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'Category should be a String', }); }
    
    if (note) {
        if (typeof note !== 'string') { return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'note should be a String', }); }
    }

    try {

        const trip = await prisma.trip.findFirst({ where: { id: body.trip_id } })
        if (!trip) { return res.status(404).send({ status: 404, error: 'Trip not found', error_description: 'Trip not found for the given id.' }) }

        const expense = await prisma.expense.create({
            data: {
                amount: body.amount,
                category: body.category,
                note: body.note,
                trip_id: body.trip_id,
                user_id: user.id,
            },
        });

        return res.status(200).send({ status: 201, message: 'Created', expense: expense })
    } catch (err) {
        return next(err)
    }
}

// export const addUserToExpense = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
//     const {user_id, expense_id} = req.body;

//     try {
        
//         const expense = await prisma.expense.findFirst({ where: { id: expense_id } })
//         if (!expense) { return res.status(404).send({ status: 404, error: 'Expense not found', error_description: 'Expense not found for the given id.' }) }

//         const user = await prisma.user.findFirst({ where: { id: user_id } })
//         if (!user) { return res.status(404).send({ status: 404, error: 'User not found', error_description: 'User not found for the given id.' }) }

//         // add user to addedUsers array in expense
//         const updatedExpense = await prisma.expense.update({
//             where: { id: expense_id },
//             data: {
//                 addedUsers: {
//                     connect: { id: user.id }
//                 }
//             }
//         });

//         return res.status(200).send({ status: 200, message: 'User added to expense', expense: updatedExpense })
//     } catch (error) {
//         console.log(error)
//         return next(error)
//     }
// }

export const GetTripExpenses = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        let tripId: string | number = req.params.id
        const user = req.user
        if (!tripId) {
            return res
                .status(200)
                .send({ status: 400, error: 'Invalid payload', error_description: 'id(trip) is required in params.' })
        }
        tripId = Number(tripId)
        if (typeof tripId !== 'number' || !Number.isInteger(tripId) || tripId <= 0) {
            return res.status(400).send({
                status: 400,
                error: 'Bad Request',
                error_description: 'Trip id should be a positive integer value',
            });
        }
        const expenses = await prisma.expense.findMany({
            where: { user_id: user.id, trip_id: tripId },
        })
        let total = 0
        expenses.forEach((expense) => {
            total += expense.amount
        })

        return res.status(200).send({ status: 200, expenses: expenses, total: total })
    } catch (err) {
        return next(err)
    }
}

export const getEachTripsExpenses = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const user = req.user
        const normal_trips = await prisma.trip.findMany({
            where: { user_id: user.id, is_payment_confirmed: true },
            include: {
                service: {
                    select: {
                        name: true,
                        images: true
                    }
                }
            }
        })
        const custom_trips = await prisma.customTrip.findMany({
            where: { user_id: user.id, is_payment_confirmed: true },
            include: {
                service: {
                    select: {
                        name: true,
                        images: true
                    }
                }
            }
        })
        const trips = [...normal_trips, ...custom_trips]
        let tripExpenses = []
        for (let i = 0; i < trips.length; i++) {
            const expenses = await prisma.expense.findMany({
                where: { user_id: user.id, trip_id: trips[i].id },
            })
            let total = 0
            expenses.forEach((expense) => {
                total += expense.amount
            })
            tripExpenses.push({ trip: trips[i], total: total })
        }
        let grandTotal = 0;
        tripExpenses.forEach((tripExpense) => {
            grandTotal += tripExpense.total;
        });
        return res.status(200).send({ status: 200, tripExpenses: tripExpenses, grandTotal: grandTotal });
    } catch (err) {
        return next(err)
    }
}

const expenseController = { CreateExpense, GetTripExpenses, getEachTripsExpenses }

export default expenseController
