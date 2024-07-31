import { Router } from 'express'
import authController from '../controller/auth.controller'

const authRouter = Router()

authRouter.post('/login', authController.Login)
authRouter.post('/signup', authController.Signup)
//@ts-ignore
authRouter.post('/forgot', authController.ForgotPassword)
authRouter.post('/sendotp', authController.SendOtp)
authRouter.post('/sendotpPhone', authController.SendOtpPhone)
authRouter.post('/verify', authController.VerifyOtp)
authRouter.post('/verifyPhone', authController.VerifyOtpPhone)
authRouter.post('/host-login', authController.HostLogin)
authRouter.post('/social-login', authController.socialLogin)
authRouter.post('/super-admin-login', authController.superAdminLogin)

export default authRouter
