import { PrismaClient } from '@prisma/client'
import { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
const prisma = new PrismaClient()


const domesticInternationalPackages = async (req: ExtendedRequest, res: Response, next: NextFunction) => { 
    try {
        const categories = await prisma.packageCategory.findMany();
        const states = await prisma.packageState.findMany();
        const countries = await prisma.packageCountry.findMany();
        const domesticPackages = await prisma.package.findMany({
            where: { type: 0 }
        });
        const internationalPackages = await prisma.package.findMany({
            where: { type: 1 }
        });

        const statesWithPackageCount = states.map((state) => {
            const statePackageCount = domesticPackages.filter(
                (pkg) => pkg.state === state.name
            ).length;
          
            return {
                ...state,
                packageCount: statePackageCount,
            };
        });

        const countriesWithPackageCount = countries.map((country) => {
            const countryPackageCount = internationalPackages.filter(
                (pkg) => pkg.country === country.name
            ).length;
          
            return {
                ...country,
                packageCount: countryPackageCount,
            };
        });

        return res.status(200).send({ 
            status: 200, 
            message: 'Ok', 
            categories, 
            states: statesWithPackageCount, 
            countries: countriesWithPackageCount,
            domesticPackages,
            internationalPackages
        });
    } catch (err) {
        return next(err);
    }
};


const domesticPackages = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const categories = await prisma.packageCategory.findMany();
        const states = await prisma.packageState.findMany();
        const domesticPackages = await prisma.package.findMany({
            where: {type: 0}
        })
        const statesWithPackageCount = states.map((state) => {
            const statePackageCount = domesticPackages.filter(
              (pkg) => pkg.state === state.name
            ).length;
          
            return {
              ...state,
              packageCount: statePackageCount,
            };
          });
        return res.status(200).send({ status: 200, message: 'Ok', categories, states: statesWithPackageCount, packages: domesticPackages });
    }catch(err){
        return next(err)
    }
}

//get all domestic states

const domesticStates = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const states = await prisma.packageState.findMany();
        return res.status(200).send({ status: 200, message: 'Ok', states });
    }catch(err){
        return next(err)
    }
}




const intlPackages = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const categories = await prisma.packageCategory.findMany();
        const countries = await prisma.packageCountry.findMany();
        const intlPackages = await prisma.package.findMany({
            where: {type: 1}
        })
        const countryWithPackageCount = countries.map((country) => {
            const statePackageCount = intlPackages.filter(
              (pkg) => pkg.country === country.name
            ).length;
          
            return {
              ...country,
              packageCount: statePackageCount,
            };
          });
        return res.status(200).send({ status: 200, message: 'Ok', categories, countries: countryWithPackageCount, packages: intlPackages });
    }catch(err){
        return next(err)
    }
}

const getDomesticPackagesByCategoryName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const category = req.params.category;
        const packages = await prisma.package.findMany({
            where: {
                type: 0,
                category: category
            }
        })
        const statesFromPackagesArray = packages.map((pkg) => pkg.state);
        const citiesFromPackagesArray = packages.map((pkg) => pkg.city);
        return res.status(200).send({ status: 200, message: 'Ok', packages, states: [...new Set(statesFromPackagesArray)], cities: [...new Set(citiesFromPackagesArray)] });

    }catch(err){
        return next(err)
    }
} 

const getIntlPackagesByCategoryName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const category = req.params.category;
        const packages = await prisma.package.findMany({
            where: {
                type: 1,
                category: category
            }
        })
        const packageCountriesFromPackagesArray = packages.map((pkg) => pkg.country);
        return res.status(200).send({ status: 200, message: 'Ok', packages, countries: [...new Set(packageCountriesFromPackagesArray)] });

    }catch(err){
        return next(err)
    }
} 

const getDomesticPackagesByStateName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const state = req.params.state;
        const packages = await prisma.package.findMany({
            where: {
                type: 0,
                state: state
            }
        })
        const citiesFromPackagesArray = packages.map((pkg) => pkg.city);
        return res.status(200).send({ status: 200, message: 'Ok', packages, cities: [...new Set(citiesFromPackagesArray)] });

    }catch(err){
        return next(err)
    }
} 

const getIntlPackagesByCountryName = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const country = req.params.country;
        const packages = await prisma.package.findMany({
            where: {
                type: 1,
                country: country
            }
        })
        return res.status(200).send({ status: 200, message: 'Ok', packages });

    }catch(err){
        return next(err)
    }
} 

const getPackageById = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const packageId = req.params.id

    if (isNaN(Number(packageId))) {
        return res
            .status(200)
            .send({ status: 400, error: 'Bad Request', error_description: 'Invalid package id Parameters' })
    }
    try {
        const packageDetails = await prisma.package.findUnique({
            where: { id: Number(packageId) },
        })
        if (!packageDetails) {
            return res.status(404).send({ status: 404, error: 'Package not found' })
        }
        return res.status(200).send({ status: 200, package: packageDetails })
    } catch (err) {
        return next(err)
    }
}


const webController = { domesticInternationalPackages, domesticStates, domesticPackages, intlPackages, getDomesticPackagesByCategoryName, getIntlPackagesByCategoryName, getDomesticPackagesByStateName, getIntlPackagesByCountryName, getPackageById }

export default webController