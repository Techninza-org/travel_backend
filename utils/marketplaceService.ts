import { CityDescription, PrismaClient } from "@prisma/client";
import axios from "axios";
import { response } from "express";
const prisma = new PrismaClient();

const API_KEY = "AIzaSyA67I2HSJSFUxwU4nyQRrTDfpUdWntb97Y";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

const TRIP_ADVISOR_API_KEY = "B4825F3FE60D4D718AD0B6DFEEF1E58C";
const TRIP_ADVISOR_BASE_URL = `https://api.content.tripadvisor.com/api/v1/location/search?key=${TRIP_ADVISOR_API_KEY}&searchQuery=`;

const RADIUS_KM = 100;


interface GeminiResponse {
    candidates: {
        content: {
            parts: { text: string; }[];
        };
    }[];
}

export interface CityDescriptionType {
    name: string;
    description: string;
}

export enum TripAdvisorCategory {
    Attractions = "attractions",
    Restrurants = "restaurants",
    Geos = "geos",
    hotels = "hotels",
}


export const getNearbyPlaces = async (latitude: number, longitude: number, startRadiusRange: number, endRadiusRange: number): Promise<string[]> => {

    const prompt = {
        contents: [
            {
                parts: [
                    {
                        text: `List 10 cities within ${startRadiusRange} to ${endRadiusRange} km from the given latitude: ${latitude} and longitude: ${latitude}. Use the following schema: { "cities": ["city_name_1", "city_name_2", ...] }. Given coordinates: latitude: ${latitude}, longitude: ${longitude}. Return only the JSON list.`
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: "application/json",
        }
    };

    try {

        const response = await axios.post<GeminiResponse>(API_URL, prompt, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        const citiesList = JSON.parse(response.data.candidates[0].content.parts[0].text).cities;

        console.log("Nearby cities:", citiesList);

        return citiesList;

    } catch (error) {
        console.error("Error fetching nearby places:", error);
        return [];
    }
}

export const citiesDescription = async (cities: string[]) => {
    const prompt = {
        contents: [
            {
                parts: [
                    {
                        text: `List given cities ${cities} with description of 200 words in JSON format using the following schema: cities = { \"city\": \"city_name\", \"description\": \"cit_description\" }. Return: list[cities]`
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: "application/json",
        }
    };

    try {

        const response = await axios.post<GeminiResponse>(API_URL, prompt, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        const citiesDesc = JSON.parse(response.data.candidates[0].content.parts[0].text);

        console.log("Cities desc:", citiesDesc);

        return citiesDesc;

    } catch (error) {
        console.error("Error fetching city name:", error);
        return null;
    }
};

export const optimizedCitiesDescription = async (cities: string[]): Promise<any[]> => {
    try {

        const db_existed_cities: CityDescription[] = await prisma.cityDescription.findMany({
            where: {
                name: {
                    in: cities
                }
            }
        });

        const names_not_in_db = cities.filter((city) => {
            return !db_existed_cities.some((db_city) => db_city.name === city);
        });

        if (names_not_in_db.length === 0) {
            return db_existed_cities;
        }

        const ai_cities: [] = await citiesDescription(names_not_in_db);

        const cities_desc = [...db_existed_cities, ...ai_cities];

        return cities_desc;
    } catch (error) {
        console.error("Error fetching city name:", error);
        return [];
    }
};

export const getCityByCoordinates = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        const response = await axios.get(url);

        // Extract city name
        const place = response.data.address.state_district || response.data.address.city || response.data.address.town || response.data.address.village;

        // console.log("City:", response.data);

        // return response.data || null;
        return place || null;
    } catch (error) {
        console.error("Error fetching city name:", error);
        return null;
    }
};

export const marketplaceDetails = async (cityName: string, category: TripAdvisorCategory): Promise<any> => {

    const response = await axios.get(`${TRIP_ADVISOR_BASE_URL}${cityName}&category=${category}&radiusUnit=${RADIUS_KM}km&language=en`)
        .then((response) => {
            const data = response.data.data;
            // const places = data.map((place: any) => ({
            //     name: place.name,
            //     address: place.address,
            //     rating: place.rating,
            //     category: place.category,
            //     imageUrl: place.imageUrl
            // }));

            // console.log("Marketplace details:", data);
            return data;

        }).catch((error) => {
            console.error("Error fetching marketplace details:", error);
            return null;
        });

    return response;
};

export const getImgByPlaceName = async (placeName: string): Promise<string | null> => {

    const API_KEY = "B4825F3FE60D4D718AD0B6DFEEF1E58C";


    try {
        const locationRes = await axios.get(
            `https://api.content.tripadvisor.com/api/v1/location/search?key=${API_KEY}&searchQuery=${placeName}&language=en`
        );

        const locationId = locationRes.data.data[0]?.location_id;
        // console.log("Location ID:", locationId);

        if (!locationId) return null;

        const imageRes = await axios.get(
            `https://api.content.tripadvisor.com/api/v1/location/${locationId}/photos?key=${API_KEY}&language=en&source=Traveler`
        );

        const imageUrl = imageRes.data.data[0]?.images?.original?.url;
        // console.log("Image URL:", imageUrl);

        return imageUrl || null;

    } catch (error) {
        console.error("Error in getImgByPlaceName:", error);
        return null;
    }
};

export const getDescriptionsByPlaceNamesClient = async (placeNames: string[]): Promise<any[]> => {
    const prompt = {
        contents: [
            {
                parts: [
                    {
                        text: `List given places ${placeNames} with description of 200 words in JSON format using the following schema: places = { \"place\": \"place_name\", \"description\": \"place_description\" }. Return: list[places]`
                    }
                ]
            }
        ],
        generationConfig: {
            response_mime_type: "application/json",
        }
    };

    try {

        const response = await axios.post<GeminiResponse>(API_URL, prompt, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        const placesDesc = JSON.parse(response.data.candidates[0].content.parts[0].text);

        console.log("Places desc:", placesDesc);

        return placesDesc;

    } catch (error) {
        console.error("Error fetching place names:", error);
        return [];
    }
}
