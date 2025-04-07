import { Router } from 'express'
import serviceController from '../controller/service.controller'
import { upload } from '..'
import middleware from '../utils/middleware'
const ServiceRouter = Router()

//@ts-ignore
ServiceRouter
    //@ts-ignore
    .post('/', middleware.HostAuthMiddleware, serviceController.CreateService)
    //@ts-ignore
    .get('/all', middleware.HostAuthMiddleware, serviceController.GetAllServices)
    //@ts-ignore
    .get('/filter', serviceController.getFilteredServices)
    //@ts-ignore
    .get('/:id', serviceController.getSpecificService)
    //@ts-ignore
    .put('/:id', middleware.HostAuthMiddleware, serviceController.editServiceById)
    //@ts-ignore
    .get('/host/:id', middleware.HostAuthMiddleware, serviceController.getServicesByHostId)
    //@ts-ignore
    .get('/host/bids/:id', middleware.HostAuthMiddleware, serviceController.getBidsByHostId)
    //@ts-ignore
    .delete('/:id', middleware.HostAuthMiddleware, serviceController.deleteService)
    //@ts-ignore
    .put('/servicePics/:id', middleware.HostAuthMiddleware, upload.array('files', 5), serviceController.uploadServicePics)
    //@ts-ignore
    .post('/searchServices', serviceController.searchServices)

export default ServiceRouter
