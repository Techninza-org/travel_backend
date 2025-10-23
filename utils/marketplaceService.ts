import { CityDescription, PrismaClient } from "@prisma/client";
import axios from "axios";
import { response } from "express";
const prisma = new PrismaClient();

const PERPLEXITY_API_KEY: string = process.env.PERPLEXITY_API_KEY || "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";
const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_MODEL = "sonar-pro";

const TRIP_ADVISOR_API_KEY: string = process.env.TRIP_ADVISOR_API_KEY || "B4825F3FE60D4D718AD0B6DFEEF1E58C";
const TRIP_ADVISOR_BASE_URL: string =
  `https://api.content.tripadvisor.com/api/v1/location/search?key=${TRIP_ADVISOR_API_KEY}&searchQuery=`;

const GOOGLE_MAPS_API_KEY: string = process.env.GOOGLE_MAPS_API_KEY || "AIzaSyA9bSNp7B8WIWN4nxYhzYegyJOdQpQEJgs";
const GOOGLE_PLACES_BASE_URL: string = "https://maps.googleapis.com/maps/api/place/textsearch/json";
const GOOGLE_PLACE_DETAILS_URL: string = "https://maps.googleapis.com/maps/api/place/details/json";
const GOOGLE_PHOTOS_BASE_URL: string = "https://maps.googleapis.com/maps/api/place/photo";

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

// Google Places API types (for Perplexity replacements)
export interface GooglePlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  types: string[];
  business_status?: string;
  opening_hours?: {
    open_now: boolean;
  };
}

export interface GooglePlacesResponse {
  results: GooglePlaceResult[];
  status: string;
  next_page_token?: string;
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
    const url =  `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${process.env.MAPS_API_KEY}`;
    const response = await axios.get(url);
    console.log(response.data, 'google maps response');
    const place = response.data.results[0].address_components.find((component: any) =>
      component.types.includes("locality")
    )?.long_name;
    console.log(place, 'place');
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

// getDescriptionsByPlaceNamesClient: Google Places API powered (faster)
export const getDescriptionsByPlaceNamesClient = async (placeNames: string[]): Promise<any[]> => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("Missing GOOGLE_MAPS_API_KEY");
    }

    const placeDescriptions = await Promise.all(
      placeNames.map(async (placeName) => {
        try {
          // Search for the place using Google Places API
          const searchResponse = await axios.get(GOOGLE_PLACES_BASE_URL, {
            params: {
              query: placeName,
              key: GOOGLE_MAPS_API_KEY,
              language: 'en'
            }
          });

          if (searchResponse.data.status !== 'OK' || !searchResponse.data.results.length) {
            return {
              place: placeName,
              description: `Information about ${placeName} is not available.`
            };
          }

          const place = searchResponse.data.results[0];
          
          // Get detailed information using Place Details API
          const detailsResponse = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
            params: {
              place_id: place.place_id,
              key: GOOGLE_MAPS_API_KEY,
              fields: 'name,formatted_address,rating,user_ratings_total,types,editorial_summary,reviews',
              language: 'en'
            }
          });

          if (detailsResponse.data.status !== 'OK') {
            return {
              place: placeName,
              description: `${placeName} is located at ${place.formatted_address}.`
            };
          }

          const details = detailsResponse.data.result;
          
          // Create description from available data
          let description = `${details.name || placeName}`;
          
          if (details.formatted_address) {
            description += ` is located at ${details.formatted_address}.`;
          }
          
          if (details.rating) {
            description += ` It has a rating of ${details.rating} stars`;
            if (details.user_ratings_total) {
              description += ` based on ${details.user_ratings_total} reviews.`;
            } else {
              description += `.`;
            }
          }
          
          if (details.types && details.types.length > 0) {
            const typeString = details.types.slice(0, 3).join(', ');
            description += ` This is a ${typeString}.`;
          }
          
          if (details.editorial_summary && details.editorial_summary.overview) {
            description += ` ${details.editorial_summary.overview}`;
          } else if (details.reviews && details.reviews.length > 0) {
            // Use first review snippet if available
            const firstReview = details.reviews[0];
            if (firstReview.text && firstReview.text.length > 50) {
              const reviewSnippet = firstReview.text.substring(0, 150) + '...';
              description += ` According to reviews: "${reviewSnippet}"`;
            }
          }

          return {
            place: placeName,
            description: description
          };
        } catch (error) {
          console.error(`Error fetching details for ${placeName}:`, error);
          return {
            place: placeName,
            description: `Information about ${placeName} is not available.`
          };
        }
      })
    );

    console.log("Places desc:", placeDescriptions);
    return placeDescriptions;
  } catch (error) {
    console.error("Error fetching place names:", error);
    return [];
  }
};

// placeDetails: Google Places API powered (faster)
export const placeDetails = async (placeNames: string[]): Promise<any[]> => {
  try {
    if (!GOOGLE_MAPS_API_KEY) {
      throw new Error("Missing GOOGLE_MAPS_API_KEY");
    }

    const placeDescriptions = await Promise.all(
      placeNames.map(async (placeName) => {
        try {
          // Search for the place using Google Places API
          const searchResponse = await axios.get(GOOGLE_PLACES_BASE_URL, {
            params: {
              query: placeName,
              key: GOOGLE_MAPS_API_KEY,
              language: 'en'
            }
          });

          if (searchResponse.data.status !== 'OK' || !searchResponse.data.results.length) {
            return {
              place: placeName,
              description: `Information about ${placeName} is not available.`
            };
          }

          const place = searchResponse.data.results[0];
          
          // Get detailed information using Place Details API
          const detailsResponse = await axios.get(GOOGLE_PLACE_DETAILS_URL, {
            params: {
              place_id: place.place_id,
              key: GOOGLE_MAPS_API_KEY,
              fields: 'name,formatted_address,rating,user_ratings_total,types,editorial_summary,reviews,website,formatted_phone_number,opening_hours',
              language: 'en'
            }
          });

          if (detailsResponse.data.status !== 'OK') {
            return {
              place: placeName,
              description: `${placeName} is located at ${place.formatted_address}.`
            };
          }

          const details = detailsResponse.data.result;
          
          // Create comprehensive description from available data
          let description = `${details.name || placeName}`;
          
          if (details.formatted_address) {
            description += ` is located at ${details.formatted_address}.`;
          }
          
          if (details.rating) {
            description += ` It has a rating of ${details.rating} stars`;
            if (details.user_ratings_total) {
              description += ` based on ${details.user_ratings_total} reviews.`;
            } else {
              description += `.`;
            }
          }
          
          if (details.types && details.types.length > 0) {
            const typeString = details.types.slice(0, 3).join(', ');
            description += ` This is a ${typeString}.`;
          }
          
          if (details.website) {
            description += ` Visit their website at ${details.website}.`;
          }
          
          if (details.formatted_phone_number) {
            description += ` Contact them at ${details.formatted_phone_number}.`;
          }
          
          if (details.opening_hours && details.opening_hours.open_now !== undefined) {
            description += ` They are currently ${details.opening_hours.open_now ? 'open' : 'closed'}.`;
          }
          
          if (details.editorial_summary && details.editorial_summary.overview) {
            description += ` ${details.editorial_summary.overview}`;
          } else if (details.reviews && details.reviews.length > 0) {
            // Use first review snippet if available
            const firstReview = details.reviews[0];
            if (firstReview.text && firstReview.text.length > 50) {
              const reviewSnippet = firstReview.text.substring(0, 200) + '...';
              description += ` According to reviews: "${reviewSnippet}"`;
            }
          }

          return {
            place: placeName,
            description: description
          };
        } catch (error) {
          console.error(`Error fetching details for ${placeName}:`, error);
          return {
            place: placeName,
            description: `Information about ${placeName} is not available.`
          };
        }
      })
    );

    return placeDescriptions;
  } catch (error) {
    console.error("Error fetching place names:", error);
    return [];
  }
};
