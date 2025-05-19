import type { Response, NextFunction } from 'express'
import { ExtendedRequest } from '../utils/middleware'
import axios from 'axios'

const PASSWORD = "EMT@uytrFYTREt"
const USERNAME = "EMTB2B"
const IPADDRESS = "110.235.232.209"

const searchFlight = async (req: ExtendedRequest, res: Response, next: NextFunction) => {
    try{
        const {adults, child, cabin, beginDate, origin, destination, infants, traceId, tripType} = req.body
        
        const requestBody = {
            Adults: adults,
            Authentication: {
                Password: PASSWORD,
                UserName: USERNAME,
                IpAddress: IPADDRESS,
            },
            Cabin: cabin,
            Childs: child,
            FlightSearchDetails: {
                BeginDate: beginDate,
                Origin: origin,
                Destination: destination, 
            },
            Infants: infants,
            TraceId: traceId,
            TripType: tripType,
        }

        const response = await axios.post('https://stagingapi.easemytrip.com/Flight.svc/json/FlightSearch', requestBody, {
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const data = response.data
        return res.status(200).json({
            message: 'Flight search results fetched successfully',
            data: data,
        })
    }catch(err){
        console.error(err)
        return res.status(500).json({
            message: 'Internal server error',
        })
    }
}

const airController = {
    searchFlight,
}

export default airController