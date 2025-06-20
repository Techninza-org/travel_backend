import { Router } from 'express'
import superAdminController from '../controller/superadmin.controller'
import middleware from '../utils/middleware'
const SuperAdminRouter = Router()
import { upload } from '..'

//@ts-ignore
SuperAdminRouter
    //@ts-ignore
    .get('/users', middleware.superAdminAuthMiddleware, superAdminController.getAllUsers)
    //@ts-ignore
    .get('/vendors' , middleware.superAdminAuthMiddleware, superAdminController.getAllVendors)
    //@ts-ignore
    .post('/vendor', middleware.superAdminAuthMiddleware, superAdminController.createVendor)
    //@ts-ignore
    .get('/vendor-services/:host_id', middleware.superAdminAuthMiddleware, superAdminController.hostServices)
    //@ts-ignore
    .get('/vendor-trips/:host_id', middleware.superAdminAuthMiddleware, superAdminController.hostTrips)
    //@ts-ignore
    .get('/user-trips/:user_id', middleware.superAdminAuthMiddleware, superAdminController.userTrips)
    //@ts-ignore
    .post('/kyc', middleware.superAdminAuthMiddleware, superAdminController.getKycDetails)
    //@ts-ignore
    .post('/kyc/handle', middleware.superAdminAuthMiddleware, superAdminController.handleKyc)
    //@ts-ignore
    .get('/service-options', superAdminController.getServiceOptions)
    //@ts-ignore
    .post('/service-option', superAdminController.addServiceOption)
    //@ts-ignore
    .delete('/service-option/:id', superAdminController.deleteServiceOption)
    //@ts-ignore
    .delete('/vendor/:host_id', superAdminController.deleteVendor)
    //@ts-ignore
    .get('/kyc/all', superAdminController.getAllVendorKyc)
    //@ts-ignore
    .post('/kyc/vendor', superAdminController.getSpecificVendorKyc)
    //@ts-ignore
    .put('/accept', superAdminController.acceptKyc)
    //@ts-ignore
    .put('/reject', superAdminController.rejectKyc)
    //@ts-ignore
    .get('/notifications', superAdminController.getNotifs)
    //@ts-ignore
    .get('/transactions', superAdminController.getTransactionsByUserId)
    //@ts-ignore
    .get('/transactions/all', superAdminController.getAllTransactions)
    //@ts-ignore
    .post('/blog', upload.single('image'), superAdminController.createBlog)
    //@ts-ignore
    .delete('/blog/:id', superAdminController.deleteBlog)
    //@ts-ignore
    .get("/user/:user_id", superAdminController.getUserById)
    //@ts-ignore
    .delete("/user/post/:post_id", superAdminController.deletePostById)
    //@ts-ignore
    .delete("/user/comment/:comment_id", superAdminController.deleteCommentById)
    //@ts-ignore
    .get('/all-trips', superAdminController.allTrips)
    //@ts-ignore
    .get('/all-services', superAdminController.allHostServices)
    //@ts-ignore
    .get('/trip/:id', superAdminController.getTripDetails)
    //@ts-ignore
    .get('/service/:id', superAdminController.getServiceDetails)
    //@ts-ignore
    .get('/queries', superAdminController.getQueries)
    //@ts-ignore
    .post('/update-password', superAdminController.updateUserPassword)
    //@ts-ignore
    .post('/airportCodes', upload.single('file'), superAdminController.importAirportDataFromExcel)

export default SuperAdminRouter