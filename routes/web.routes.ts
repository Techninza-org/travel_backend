
import { Router } from 'express'
import userController from '../controller/user.controller'
const webRouter = Router()
//@ts-ignore
webRouter.get("/get-domestic-package", userController.domesticPackages)
//@ts-ignore
webRouter.get("/domestic_packages_home", userController.domesticPackages)
//@ts-ignore
webRouter.get("/international_packages_home", userController.intlPackages)
//@ts-ignore
webRouter.get("/domestic_by_category/:category", userController.getDomesticPackagesByCategoryName)
//@ts-ignore
webRouter.get("/intl_by_category/:category", userController.getIntlPackagesByCategoryName)
//@ts-ignore
webRouter.get("/domestic_by_state/:state", userController.getDomesticPackagesByStateName)
//@ts-ignore
webRouter.get("/intl_by_country/:country", userController.getIntlPackagesByCountryName)
//@ts-ignore
webRouter.get("/package/:id", userController.getPackageById)

export default webRouter
