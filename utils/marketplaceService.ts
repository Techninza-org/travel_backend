import axios from "axios";

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

export enum TripAdvisorCategory {
    Attractions = "attractions",
    Restrurants = "restaurants",
    Geos = "geos",
    hotels = "hotels",
}


export const getNearbyPlaces = async (latitude: number, longitude: number, startRadiusRange: number, endRadiusRange: number) => {

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

export const cityByCoordinatesGem = async (latitude: number, longitude: number) => {
    const prompt = {
        contents: [
            {
                parts: [
                    {
                        text: `Get the city name for the given latitude: ${latitude} and longitude: ${longitude}. Use the following schema: { "city": "city_name" }. Given coordinates: latitude: ${latitude}, longitude: ${longitude}. Return only the JSON list.`
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

        const cityName = JSON.parse(response.data.candidates[0].content.parts[0].text).city;

        console.log("City name:", cityName);

        return cityName;

    } catch (error) {
        console.error("Error fetching city name:", error);
        return null;
    }
};

export const getCityByCoordinates = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        const response = await axios.get(url);

        // Extract city name
        const city = response.data.address.state_district

        console.log("City:", response.data);

        // return response.data || null;
        return city || null;
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

            console.log("Marketplace details:", data);
            return data;

        }).catch((error) => {
            console.error("Error fetching marketplace details:", error);
            return null;
        });

    return response;
};