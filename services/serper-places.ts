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

export async function getNearbyPharmacies(latitude: number, longitude: number): Promise<Pharmacy[]> {
    try {
        const response = await fetch('https://google.serper.dev/places', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: 'medical store pharmacy',
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

        return pharmacies;
    } catch (error) {
        console.error('Failed to fetch nearby pharmacies:', error);
        throw error;
    }
}
