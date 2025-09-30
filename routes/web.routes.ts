
import { Router } from 'express'
//@ts-ignore
import webController from '../controller/web.controller'
const webRouter = Router()
//@ts-ignore
webRouter.get("/get-domestic-international-packages", webController.domesticInternationalPackages)
//@ts-ignore
// webRouter.get("/get-domestic-package", webController.domesticPackages)
//@ts-ignore
webRouter.get("/domestic_packages_home", webController.domesticPackages)
//@ts-ignore
webRouter.get('/get-all-states', webController.domesticStates)
//@ts-ignore
webRouter.get('/get-all-countries', webController.internationalCountries)
//@ts-ignore
webRouter.get("/international_packages_home", webController.intlPackages)
//@ts-ignore
webRouter.get("/domestic_by_category/:category", webController.getDomesticPackagesByCategoryName)
//@ts-ignore
webRouter.get("/intl_by_category/:category", webController.getIntlPackagesByCategoryName)
//@ts-ignore
webRouter.get("/domestic_by_state/:state", webController.getDomesticPackagesByStateName)
//@ts-ignore
webRouter.get("/intl_by_country/:country", webController.getIntlPackagesByCountryName)
//@ts-ignore
webRouter.get("/package/:id", webController.getPackageById)
//@ts-ignore


export default webRouter
