import { Router } from 'express'
import customExpenseController from '../controller/customexpense.controller'
const CustomExpenseRouter = Router()

//@ts-ignore
CustomExpenseRouter
    //@ts-ignore
    .post('/create-custom-expense-trip', customExpenseController.createCustomExpenseTrip)
    //@ts-ignore
    .get('/all-custom-expense-trips', customExpenseController.getCustomExpenseTrips)
    //@ts-ignore
    .get('/:id', customExpenseController.GetTripExpenses)
    //@ts-ignore
    .get('/all/trips', customExpenseController.getEachTripsExpenses)
    // @ts-ignore
    .post('/', customExpenseController.CreateExpense)
    //@ts-ignore
    .post('/addUser', customExpenseController.addUserToExpense)
    //@ts-ignore
    .post('/split', customExpenseController.splitExpense)
    //@ts-ignore
    .post('/settle', customExpenseController.settleExpense)
    //@ts-ignore
    .post('/settle/member', customExpenseController.settleBillWithAUser)
    //@ts-ignore
    .get('/split/bills', customExpenseController.getMySplitBills)
    //@ts-ignore
    .post('/edit/name', customExpenseController.editExpenseName)
    

export default CustomExpenseRouter