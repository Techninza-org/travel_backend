import { Router } from 'express'
import expenseController, { addUserToExpense } from '../controller/expense.controller'
const ExpenseRouter = Router()

//@ts-ignore
ExpenseRouter
    //@ts-ignore
    .get('/:id', expenseController.GetTripExpenses)
    //@ts-ignore
    .get('/all/trips', expenseController.getEachTripsExpenses)
    // @ts-ignore
    .post('/', expenseController.CreateExpense)
    //@ts-ignore
    .post('/addUser', addUserToExpense)
    //@ts-ignore
    .post('/split', expenseController.splitExpense)
    //@ts-ignore
    .post('/settle', expenseController.settleExpense)
    //@ts-ignore
    .get('/split/bills', expenseController.getMySplitBills)
    

export default ExpenseRouter