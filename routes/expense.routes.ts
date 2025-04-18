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
    

export default ExpenseRouter