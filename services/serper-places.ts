import Constants from 'expo-constants';

const SERPER_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_SERPER_API_KEY || process.env.EXPO_PUBLIC_SERPER_API_KEY;

export interface Pharmacy {
    name: string;
    rating?: number;
    address: string;
    isOpen?: boolean;
    distance?: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    placeId?: string;
}

export async function getNearbyPharmacies(latitude: number, longitude: number, areaName?: string): Promise<Pharmacy[]> {
    try {
        // Build query with area name for better accuracy
        const searchQuery = areaName
            ? `pharmacies and medical stores near ${areaName}`
            : 'medical store pharmacy';

        const response = await fetch('https://google.serper.dev/places', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: searchQuery,
                location: `${latitude},${longitude}`,
            }),
        });

        if (!response.ok) {
            throw new Error(`Serper API error: ${response.status}`);
        }

        const data = await response.json();

        // Transform Serper response to our Pharmacy interface
        const pharmacies: Pharmacy[] = (data.places || []).map((place: any) => ({
            name: place.title || place.name || 'Unknown Pharmacy',
            rating: place.rating || undefined,
            address: place.address || 'Address not available',
            isOpen: place.openingHours?.openNow,
            distance: place.distance,
            coordinates: {
                lat: place.position?.lat || place.latitude || 0,
                lng: place.position?.lng || place.longitude || 0,
            },
            placeId: place.placeId,
        }));

        // Sort by distance (parse distance string like "0.5 mi" or "1.2 km")
        pharmacies.sort((a, b) => {
            const parseDistance = (d?: string) => {
                if (!d) return Infinity;
                const num = parseFloat(d.replace(/[^\d.]/g, ''));
                return isNaN(num) ? Infinity : num;
            };
            return parseDistance(a.distance) - parseDistance(b.distance);
        });

        return pharmacies;
    } catch (error) {
        console.error('Failed to fetch nearby pharmacies:', error);
        throw error;
    }
}

export interface Clinic {
    name: string;
    rating?: number;
    address: string;
    isOpen?: boolean;
    distance?: string;
    coordinates: {
        lat: number;
        lng: number;
    };
    placeId?: string;
}

export async function getNearbyClinics(latitude: number, longitude: number, areaName?: string): Promise<Clinic[]> {
    try {
        // Build query with area name for better accuracy
        const searchQuery = areaName
            ? `hospitals and clinics near ${areaName}`
            : 'hospital clinic medical center';

        const response = await fetch('https://google.serper.dev/places', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: searchQuery,
                location: `${latitude},${longitude}`,
            }),
        });

        if (!response.ok) {
            throw new Error(`Serper API error: ${response.status}`);
        }

        const data = await response.json();

        const clinics: Clinic[] = (data.places || []).map((place: any) => ({
            name: place.title || place.name || 'Unknown Clinic',
            rating: place.rating || undefined,
            address: place.address || 'Address not available',
            isOpen: place.openingHours?.openNow,
            distance: place.distance,
            coordinates: {
                lat: place.position?.lat || place.latitude || 0,
                lng: place.position?.lng || place.longitude || 0,
            },
            placeId: place.placeId,
        }));

        // Sort by distance (parse distance string like "0.5 mi" or "1.2 km")
        clinics.sort((a, b) => {
            const parseDistance = (d?: string) => {
                if (!d) return Infinity;
                const num = parseFloat(d.replace(/[^\d.]/g, ''));
                return isNaN(num) ? Infinity : num;
            };
            return parseDistance(a.distance) - parseDistance(b.distance);
        });

        return clinics;
    } catch (error) {
        console.error('Failed to fetch nearby clinics:', error);
        throw error;
    }
}
