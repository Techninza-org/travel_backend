import axios from "axios";

const API_KEY = "AIzaSyA67I2HSJSFUxwU4nyQRrTDfpUdWntb97Y";
// const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;
const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyA67I2HSJSFUxwU4nyQRrTDfpUdWntb97Y";

interface GeminiResponse {
    candidates: {
        content: {
            parts: { text: string; }[];
        };
    }[];
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