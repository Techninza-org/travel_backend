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
    //@ts-ignore
    .post('/package', superAdminController.createPackage)
    //@ts-ignore
    .put('/package/:id', superAdminController.updatePackage)
    //@ts-ignore
    .get('/package', superAdminController.getPackages)
    //@ts-ignore
    .get('/package/:id', superAdminController.getPackageById)
    //@ts-ignore
    .delete('/package/:id', superAdminController.deletePackageById)
    //@ts-ignore
    .get('/quotes', superAdminController.getAllQuoteQuery)
    //@ts-ignore
    .get('/quote/:id', superAdminController.markQuoteQueryAsSent)
    //@ts-ignore
    .post('/package-category', superAdminController.createPackageCategory)
    //@ts-ignore
    .get('/package-category', superAdminController.getAllPackageCategories)
    //@ts-ignore
    .delete('/package-category/:id', superAdminController.deletePackageCategory)
    //@ts-ignore
    .post('/package-state', superAdminController.createPackageState)
    //@ts-ignore
    .get('/package-state', superAdminController.getAllPackageStates)
    //@ts-ignore
    .delete('/package-state/:id', superAdminController.deletePackageState)
    //@ts-ignore
    .post('/package-country', superAdminController.createPackageCountry)
    //@ts-ignore
    .get('/package-country', superAdminController.getAllPackageCountries)
    //@ts-ignore
    .delete('/package-country/:id', superAdminController.deletePackageCountry)
    //@ts-ignore
    .get('/reported-posts', superAdminController.getReportedPosts)
    //@ts-ignore
    .get('/reported-forums', superAdminController.getReportedForumQuestions)
    //@ts-ignore
    .delete('/reported-forums/:id', superAdminController.deleteForumQuestion)
    //@ts-ignore
    .post('/add-banner', superAdminController.addBanner)
    //@ts-ignore
    .delete('/banner/:id', superAdminController.deleteBannerById)
    
export default SuperAdminRouter