import { Router } from 'express'
import authController from '../controller/auth.controller'
import { upload } from '../index'

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
authRouter.get('/blogs', authController.getBlogs)
authRouter.get('/blog/:slug', authController.getBlogById)
authRouter.get('/blogs/recent', authController.getRecentBlogs)
// authRouter.post('/otp', authController.sendOTPPhone)
authRouter.post('/upload', upload.single('file'), authController.uploadImage)

authRouter.get('/facebook/callback', authController.facebookCallback)

authRouter.post('/quote_query', authController.createQuoteQuery)

export default authRouter
