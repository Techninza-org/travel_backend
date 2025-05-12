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

export const addUserToExpense = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const {user_id, expense_id} = req.body;

    try {
        
        const expense = await prisma.expense.findFirst({ where: { id: expense_id } })
        if (!expense) { return res.status(404).send({ status: 404, error: 'Expense not found', error_description: 'Expense not found for the given id.' }) }
        
        const user = await prisma.user.findFirst({ where: { id: user_id } })
        if (!user) { return res.status(404).send({ status: 404, error: 'User not found', error_description: 'User not found for the given id.' }) }
        const expenseUsers = Array.isArray(expense.splitWithUserIds) ? expense.splitWithUserIds : [];

        if(expense.isSplitDone === true) { 
            if (expenseUsers.includes(user_id)) {
                expenseUsers.splice(expenseUsers.indexOf(user_id), 1)
                const updatedExpense = await prisma.expense.update({
                    where: { id: expense_id },
                    data: { splitWithUserIds: expenseUsers },
                });
                const expenseNew = await prisma.expense.findFirst({ where: { id: expense_id } });
                if (!expenseNew) {
                    return res.status(404).send({
                        status: 404,
                        error: 'Expense not found',
                        error_description: 'Expense not found for the given id.',
                    });
                }
                const expenseUsersUpdated = Array.isArray(expenseNew.splitWithUserIds)
                    ? expenseNew.splitWithUserIds.filter(id => id !== null)
                    : [];
                const amount = expenseNew.amount;
                const splitAmount = Math.floor(amount / expenseUsersUpdated.length);
                const usersData = [];
                for (const id of expenseUsersUpdated) {
                    const user = await prisma.user.findFirst({ where: { id: id as number } });
                    if (!user) {
                        return res.status(404).send({
                            status: 404,
                            error: 'User not found',
                            error_description: `User not found for ID: ${id}`,
                        });
                    }
                    usersData.push({
                        user_id: user.id,
                        amount: splitAmount,
                        username: user.username,
                        owes: true,
                        paid: false,
                    });
                }
                if (usersData.length > 0) {
                    usersData[0].owes = false;
                    usersData[0].paid = true;
                }
                const updatedExpenseNew = await prisma.expense.update({
                    where: { id: expense_id },
                    data: {
                        usersData: usersData,
                        isSplitDone: true,
                    },
                });

                return res.status(200).send({ status: 200, message: 'User removed from expense', expense: updatedExpenseNew });
            } else {
                expenseUsers.push(user_id);
            
                const ex = await prisma.expense.update({
                    where: { id: expense_id },
                    data: { splitWithUserIds: expenseUsers },
                });
            
                const expenseNew = await prisma.expense.findFirst({ where: { id: expense_id } });
                if (!expenseNew) {
                    return res.status(404).send({
                        status: 404,
                        error: 'Expense not found',
                        error_description: 'Expense not found for the given id.',
                    });
                }
            
                const expenseUsersUpdated = Array.isArray(expenseNew.splitWithUserIds)
                    ? expenseNew.splitWithUserIds.filter(id => id !== null)
                    : [];
            
                const amount = expenseNew.amount;
                const splitAmount = Math.floor(amount / expenseUsersUpdated.length);
            
                const usersData = [];
            
                for (const id of expenseUsersUpdated) {
                    const user = await prisma.user.findFirst({ where: { id: id as number } });
                    if (!user) {
                        return res.status(404).send({
                            status: 404,
                            error: 'User not found',
                            error_description: `User not found for ID: ${id}`,
                        });
                    }
            
                    usersData.push({
                        user_id: user.id,
                        amount: splitAmount,
                        username: user.username,
                        owes: true,
                        paid: false,
                    });
                }
            
                if (usersData.length > 0) {
                    usersData[0].owes = false;
                    usersData[0].paid = true;
                }
            
                const updatedExpense = await prisma.expense.update({
                    where: { id: expense_id },
                    data: {
                        usersData: usersData,
                        isSplitDone: true,
                    },
                });
            
                return res.status(200).send({
                    status: 200,
                    message: 'User added to expense successfully',
                    expense: updatedExpense,
                });
            }
            
        } else {
            if (expenseUsers.includes(user_id)) {
                expenseUsers.splice(expenseUsers.indexOf(user_id), 1)
                const updatedExpense = await prisma.expense.update({
                    where: { id: expense_id },
                    data: { splitWithUserIds: expenseUsers },
                });
                return res.status(200).send({ status: 200, message: 'User removed from expense', expense: updatedExpense });
            }else {
                expenseUsers.push(user_id)
                const updatedExpense = await prisma.expense.update({
                    where: { id: expense_id },
                    data: { splitWithUserIds: expenseUsers },
                });
                return res.status(200).send({ status: 200, message: 'User added to expense successfully', expense: updatedExpense })
            }
        } 
    } catch (error) {
        console.log(error)
        return next(error)
    }
}

export const splitExpense = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const {expense_id} = req.body;
    try {
        const expense = await prisma.expense.findFirst({ where: { id: expense_id } })
        if (!expense) { return res.status(404).send({ status: 404, error: 'Expense not found', error_description: 'Expense not found for the given id.' }) }
        // if(expense.isSplitDone === true) { return res.status(200).send({ status: 200, message: 'Expense already split' }) }
        const expenseUsers = Array.isArray(expense.splitWithUserIds) ? expense.splitWithUserIds : [];
        const user_id = req.user.id
        const amount = expense.amount;
        const splitAmount = Math.floor(amount / (expenseUsers.length + 1));
        const usersData = [];
        for (let i = 0; i < expenseUsers.length; i++) {
            if (expenseUsers[i] !== null) {
                const user = await prisma.user.findFirst({ where: { id: expenseUsers[i] as number } })
                if (!user) { return res.status(404).send({ status: 404, error: 'User not found', error_description: 'User not found for the given id.' }) }
                usersData.push({ user_id: user.id, amount: splitAmount, username: user.username, owes: true, paid: false })
            }
        }
        const user = await prisma.user.findFirst({ where: { id: user_id } })
        if (!user) { return res.status(404).send({ status: 404, error: 'User not found', error_description: 'User not found for the given id.' }) }
        usersData.push({ user_id: user.id, amount: splitAmount, username: user.username, owes: false, paid: true })
        const updatedExpense = await prisma.expense.update({
            where: { id: expense_id },
            data: { usersData: usersData, isSplitDone: true },
        });
        return res.status(200).send({ status: 200, message: 'Expense split successfully', expense: updatedExpense })
    } catch (error) {
        console.log(error)
        return next(error)
    }
}

export const settleExpense = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { expense_id } = req.body
    try {
        const expense = await prisma.expense.findFirst({ where: { id: expense_id } })
        if (!expense) { return res.status(404).send({ status: 404, error: 'Expense not found', error_description: 'Expense not found for the given id.' }) }
        const usersData = Array.isArray(expense.usersData) ? expense.usersData?.map((user:any) => {
            return { ...user, owes: false, paid: true }
        }) : [];
        const updatedExpense = await prisma.expense.update({
            where: { id: expense_id },
            data: { usersData: usersData, isSettled: true, splitWithUserIds: [] },
        });
        return res.status(200).send({ status: 200, message: 'Expense settled successfully', expense: updatedExpense })
    } catch (error) {
        console.log(error)
        return next(error)
    }
}

export const settleBillWithAUser = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const { expense_id, user_id } = req.body
    try {
        const expense = await prisma.expense.findFirst({ where: { id: expense_id } })
        if (!expense) { return res.status(404).send({ status: 404, error: 'Expense not found', error_description: 'Expense not found for the given id.' }) }
        const userExistsInSplit = Array.isArray(expense.splitWithUserIds) ? expense.splitWithUserIds.includes(user_id) : false;
        if (!userExistsInSplit) {
            return res.status(400).send({ status: 400, error: 'Bad Request', error_description: 'User not found in split' })
        }
        const usersData = Array.isArray(expense.usersData) ? expense.usersData?.map((user:any) => {
            if(user.user_id === user_id) {
                return { ...user, owes: false, paid: true }
            }
            return user
        }) : [];
        const splitWithUserIds = expense.splitWithUserIds || [];
        const updatedExpense = await prisma.expense.update({
            where: { id: expense_id },
            data: { usersData: usersData, splitWithUserIds: (splitWithUserIds as string[]).filter((id:any) => id !== user_id) },
        });
        return res.status(200).send({ status: 200, message: 'Expense settled successfully', expense: updatedExpense })
    } catch (error) {
        console.log(error)
        return next(error)
    }
}

export const getMySplitBills = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) {
        return res.status(401).send({ status: 401, error: 'Unauthorized', error_description: 'User not found' });
    }

    const userId = parseInt(user.id, 10);

    try {
        const expenses: any[] = await prisma.$queryRaw`
            SELECT * FROM Expense
            WHERE isSplitDone = true
              AND (
                user_id = ${userId}
                OR JSON_CONTAINS(splitWithUserIds, JSON_ARRAY(${userId}))
              )
        `;

        let toPay = 0;
        let toGet = 0;

        for (const expense of expenses) {
            const usersData = expense.usersData as any[];

            if (Array.isArray(usersData)) {
                usersData.forEach((userData) => {
                    console.log(userData, 'data');
                    
                    if (userData.owes && !userData.paid && userData.user_id !== userId) {
                        toGet += userData.amount;
                    } 
                    if (!userData.owes && !userData.paid && userData.user_id === userId) {
                        toPay += userData.amount;
                    }
                })
            }
        }

        return res.status(200).send({ status: 200, expenses, toPay, toGet });
    } catch (err) {
        return next(err);
    }
};



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

const expenseController = { CreateExpense, GetTripExpenses, getEachTripsExpenses, splitExpense, getMySplitBills, settleExpense, settleBillWithAUser }

export default expenseController
