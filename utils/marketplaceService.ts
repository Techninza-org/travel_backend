import { CityDescription, PrismaClient } from "@prisma/client";
import axios from "axios";
import { response } from "express";
const prisma = new PrismaClient();

const PERPLEXITY_API_KEY: string = process.env.PERPLEXITY_API_KEY || "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";
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_MODEL = "sonar-medium-online";

const TRIP_ADVISOR_API_KEY: string = process.env.TRIP_ADVISOR_API_KEY || "B4825F3FE60D4D718AD0B6DFEEF1E58C";
const TRIP_ADVISOR_BASE_URL: string =
  `https://api.content.tripadvisor.com/api/v1/location/search?key=${TRIP_ADVISOR_API_KEY}&searchQuery=`;

const RADIUS_KM = 100;

interface PerplexityResponse {
  choices: {
    message: {
      role: string;
      content: string;
    };
  }[];
}

export interface PlaceDescription {
  place: string;
  description: string;
}

export interface CityDescriptionType {
  city: string;
  description: string;
}

export enum TripAdvisorCategory {
  Attractions = "attractions",
  Restrurants = "restaurants",
  Geos = "geos",
  hotels = "hotels",
}

// Centralized Perplexity call that returns the assistant's raw text
async function callPerplexity(userPrompt: string, systemPrompt = "You are a helpful assistant that ONLY returns valid JSON when asked. Do not add explanations.") {
  if (!PERPLEXITY_API_KEY) {
    throw new Error("Missing PERPLEXITY_API_KEY");
  }

  const { data } = await axios.post<PerplexityResponse>(
    PERPLEXITY_URL,
    {
      model: PERPLEXITY_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("Empty response from Perplexity");
  return text.trim();
}


function safeParseJSON<T = any>(text: string): T {
  // try code fence first
  const fenceMatch = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/);
  const candidate = fenceMatch ? fenceMatch[1] : text;

  // try direct parse
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // attempt to locate first JSON object/array using a simple heuristic
    const start = candidate.indexOf("{");
    const startArr = candidate.indexOf("[");
    const first = (start === -1) ? startArr : (startArr === -1 ? start : Math.min(start, startArr));
    if (first >= 0) {
      const sliced = candidate.slice(first);
      // last } or ] in string
      const lastObj = sliced.lastIndexOf("}");
      const lastArr = sliced.lastIndexOf("]");
      const last = Math.max(lastObj, lastArr);
      if (last >= 0) {
        const jsonStr = sliced.slice(0, last + 1);
        try {
          return JSON.parse(jsonStr) as T;
        } catch { /* fall through */ }
      }
    }
  }
  throw new Error("Failed to parse JSON from model output");
}

// getNearbyPlaces: returns a string[] of city names
export const getNearbyPlaces = async (
  latitude: number,
  longitude: number,
  startRadiusRange: number,
  endRadiusRange: number
): Promise<string[]> => {
  const prompt = `
List up to 10 tourism cities within ${startRadiusRange} to ${endRadiusRange} km
from the given coordinates.

Coordinates:
- latitude: ${latitude}
- longitude: ${longitude}

Return ONLY valid JSON with the schema:
{ "cities": ["city_name_1", "city_name_2", ...] }
`;

  try {
    const text = await callPerplexity(prompt);
    const json = safeParseJSON<{ cities: string[] }>(text);
    const citiesList = Array.isArray(json?.cities) ? json.cities : [];
    console.log("Nearby cities:", citiesList);
    return citiesList;
  } catch (error) {
    console.error("Error fetching nearby places:", error);
    return [];
  }
};

// citiesDescription: returns array/object per your schema request
export const citiesDescription = async (cities: string[]): Promise<any[]> => {
    const prompt = `
  Given the cities: ${JSON.stringify(cities)}
  
  For EACH city, write a ~200-word description.
  
  Return ONLY valid JSON as an array of objects:
  [
    { "city": "city_name", "description": "city_description" },
    ...
  ]
  `;
  
    try {
      const text = await callPerplexity(prompt);
      const parsed = safeParseJSON<any>(text);
  
      // Normalize: if model returns a single object, wrap it; if it returns the target shape, pass through.
      const out = Array.isArray(parsed) ? parsed : [parsed];
      console.log("Cities desc:", out);
      return out;
    } catch (error) {
      console.error("Error fetching city description:", error);
      return []; // << important: never return null
    }
  };
  

// optimizedCitiesDescription: reads from DB, generates missing, stores, returns combined
export const optimizedCitiesDescription = async (cities: string[]): Promise<any[]> => {
  try {
    const db_existed_cities: CityDescription[] = await prisma.cityDescription.findMany({
      where: { name: { in: cities } },
    });

    const names_not_in_db = cities.filter(
      (city) => !db_existed_cities.some((db_city) => db_city.name === city)
    );

    console.log("name not in db:::", names_not_in_db);

    if (names_not_in_db.length === 0) {
      return db_existed_cities;
    }

    const ai_cities: any[] = (await citiesDescription(names_not_in_db)) || [];

    // save in db
    const citiesToSave = ai_cities.map((city: CityDescriptionType) => ({
      name: city.city,
      description: city.description,
    }));

    await prisma.cityDescription.createMany({
      data: citiesToSave,
      skipDuplicates: true,
    });

    console.log("cities to save:::", citiesToSave);

    const cities_desc = [...db_existed_cities, ...ai_cities];
    return cities_desc;
  } catch (error) {
    console.error("Error in optimizedCitiesDescription:", error);
    return [];
  }
};

// Use OpenStreetMap Nominatim to reverse geocode a city name
export const getCityByCoordinates = async (latitude: number, longitude: number): Promise<string | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const response = await axios.get(url);
    const place =
      response.data.address.state_district ||
      response.data.address.city ||
      response.data.address.town ||
      response.data.address.village;
    return place || null;
  } catch (error) {
    console.error("Error fetching city name:", error);
    return null;
  }
};

// TripAdvisor marketplaceDetails passthrough (unchanged logic)
export const marketplaceDetails = async (cityName: string, category: TripAdvisorCategory): Promise<any> => {
  const response = await axios
    .get(`${TRIP_ADVISOR_BASE_URL}${encodeURIComponent(cityName)}&category=${category}&radiusUnit=${RADIUS_KM}km&language=en`)
    .then((response) => {
      const data = response.data.data;
      return data;
    })
    .catch((error) => {
      console.error("Error fetching marketplace details:", error);
      return null;
    });

  return response;
};

// Fetch first photo for a place via TripAdvisor Content API (unchanged logic)
export const getImgByPlaceName = async (placeName: string): Promise<string | null> => {
  const KEY = TRIP_ADVISOR_API_KEY || "B4825F3FE60D4D718AD0B6DFEEF1E58C"; // fallback if you had a hardcoded dev key

  try {
    const locationRes = await axios.get(
      `https://api.content.tripadvisor.com/api/v1/location/search?key=${KEY}&searchQuery=${encodeURIComponent(placeName)}&language=en`
    );

    const locationId = locationRes.data.data?.[0]?.location_id;
    if (!locationId) return null;

    const imageRes = await axios.get(
      `https://api.content.tripadvisor.com/api/v1/location/${locationId}/photos?key=${KEY}&language=en&source=Traveler`
    );

    const imageUrl = imageRes.data.data?.[0]?.images?.original?.url;
    return imageUrl || null;
  } catch (error) {
    console.error("Error in getImgByPlaceName:", error);
    return null;
  }
};

// getDescriptionsByPlaceNamesClient: Perplexity-powered
export const getDescriptionsByPlaceNamesClient = async (placeNames: string[]): Promise<any[]> => {
  const prompt = `
Given the places: ${JSON.stringify(placeNames)}

For EACH place, write a ~200-word description.

Return ONLY valid JSON as an array of objects:
[
  { "place": "place_name", "description": "place_description" },
  ...
]
`;

  try {
    const text = await callPerplexity(prompt);
    const placesDesc = safeParseJSON<any[]>(text);
    console.log("Places desc:", placesDesc);
    return placesDesc;
  } catch (error) {
    console.error("Error fetching place names:", error);
    return [];
  }
};

// placeDetails: Perplexity-powered
export const placeDetails = async (placeNames: string[]): Promise<any[]> => {
  const prompt = `
Given the places: ${JSON.stringify(placeNames)}

For EACH place, write a ~200-word description.

Return ONLY valid JSON as an array of objects:
[
  { "place": "place_name", "description": "place_description" },
  ...
]
`;

  try {
    const text = await callPerplexity(prompt);
    const placesDesc = safeParseJSON<PlaceDescription[]>(text);
    return placesDesc;
  } catch (error) {
    console.error("Error fetching place names:", error);
    return [];
  }
};
