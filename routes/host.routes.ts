import { Router } from 'express'
import hostController from '../controller/host.controller'
import { upload } from '..';
const HostRouter = Router()

//@ts-ignore
HostRouter
    //@ts-ignore
    .get('/trips', hostController.getHostedTrips)
    //@ts-ignore
    .get('/trip/:id', hostController.GetSpecificTripHost)
    //@ts-ignore
    .get('/profile/:id', hostController.getHostProfile)
    //@ts-ignore
    .put("/profile/pic/:id", upload.single("image"), hostController.updateHostProfile)
    //@ts-ignore
    .put('/profile/update/:id', hostController.updateProfile)
    //@ts-ignore
    .put('/password/:id', hostController.changeHostPassword)
    //@ts-ignore
    .post('/kyc', upload.single("image"), hostController.submitKycDetails)
    //@ts-ignore
    .get('/kyc', hostController.getKycDetails)
    
export default HostRouter