import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import helper from '../utils/helpers'
import { PrismaClient } from '@prisma/client'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../app'
const prisma = new PrismaClient()
import crypto from 'crypto'
import dotenv from 'dotenv'
dotenv.config()

export const createDestination = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{const body = req.body
    if (!helper.isValidatePaylod(body, ['destination', 'pincode'])) {
        return res.status(200).send({
            status: 200,
            error: 'Invalid payload',
            error_description: 'destination, pincode is required.',
        })
    }
    const randomImageName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')
    const imageName = randomImageName()

    const params = {
        Bucket: process.env.BUCKET_NAME!,
        Key: imageName,
        Body: req.file?.buffer,
        ContentType: req.file?.mimetype,
    }
    const command = new PutObjectCommand(params)
    await s3.send(command)

    const destination = await prisma.destination.create({
        data: {
            destination: body.destination,
            description: body.description,
            pincode: body.pincode,
            image: `https://ezio.s3.eu-north-1.amazonaws.com/${imageName}`,
            features: body.features,
            customise_options: body.customise_options,
            latitude: Number(body.latitude),
            longitude: Number(body.longitude),
        },
    })
    return res.status(200).send({ status: 201, message: 'Created', destination: destination })}catch(err){
        return next(err)
    }
}

export const getDestinations = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try {
        const destinations = await prisma.destination.findMany({})
        return res.status(200).send({ status: 200, message: 'Ok', destinations: destinations })
    } catch (err) {
        return next(err)
    }
}

export const deleteDestination = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    let destinationId: string | number = req.params.id
    if (!destinationId) {
        return res.status(200).send({
            status: 400,
            error: 'Invalid payload',
            error_description: 'id(destination) is required in params.',
        })
    }
    destinationId = Number(destinationId)
    if (Number.isNaN(destinationId)) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(destination) should be a number.' })
    }
    try{const destination = await prisma.destination.delete({
        where: {
            id: destinationId,
        },
    })
    return res.status(200).send({ status: 200, message: 'Deleted', destination: destination })
}catch(err){
    return next(err)
}
}

export const getSpecificDestination = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    let destinationId: string | number = req.params.id
    if (!destinationId) {
        return res.status(200).send({
            status: 400,
            error: 'Invalid payload',
            error_description: 'id(destination) is required in params.',
        })
    }
    destinationId = Number(destinationId)
    if (Number.isNaN(destinationId)) {
        return res
            .status(200)
            .send({ status: 400, error: 'Invalid payload', error_description: 'id(destination) should be a number.' })
    }
    try{const destination = await prisma.destination.findUnique({
        where: {
            id: destinationId,
        },
    })
    return res.status(200).send({ status: 200, message: 'Ok', destination: destination })
}catch(err){
    next(err)
}

}

const fetchAddressPredictions = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const address = req.query.address;
    const apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?key=AIzaSyAyu-6Pv7RaiohWH1bWpQqwXbx7roNG_GA&input=${address}`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return res.status(200).send(data);
    } catch (error) {
        console.error('Error fetching address predictions: ', error);
    }
};

const getLatLong = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    const description = req.query.description;
    try {
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${description}&key=AIzaSyAyu-6Pv7RaiohWH1bWpQqwXbx7roNG_GA`;
        const response = await fetch(geocodeUrl);
        const data = await response.json();
        const latLong = data.results[0].geometry.location;
        return res.status(200).send(latLong);
    } catch (error) {
        console.error('Error fetching geocode data: ', error);
    }
};

const destinationController = { createDestination, getDestinations, deleteDestination, getSpecificDestination, fetchAddressPredictions, getLatLong }
export default destinationController
