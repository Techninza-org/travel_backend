import { Router } from 'express'
import superAdminController from '../controller/superadmin.controller'
import middleware from '../utils/middleware'
const SuperAdminRouter = Router()

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
    .get('/kyc', superAdminController.getSpecificVendorKyc)
    //@ts-ignore
    .put('/accept', superAdminController.acceptKyc)
    //@ts-ignore
    .put('/reject', superAdminController.rejectKyc)
    //@ts-ignore
    .get('/notifications', superAdminController.getNotifs)

export default SuperAdminRouter