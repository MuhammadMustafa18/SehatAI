const SERPER_API_KEY = process.env.EXPO_PUBLIC_SERPER_API_KEY;

export interface SearchResult {
    title: string;
    link: string;
    source: string;
}

export async function searchMedicineOnline(medicineName: string): Promise<SearchResult[]> {
    try {
        const response = await fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                q: `${medicineName} buy online Pakistan`,
                num: 5, // Get top 5 results
            }),
        });

        const data = await response.json();

        if (data.organic) {
            return data.organic.map((result: any) => ({
                title: result.title,
                link: result.link,
                source: new URL(result.link).hostname.replace('www.', ''),
            }));
        }

        return [];
    } catch (error) {
        console.error('Serper Search Error:', error);
        return [];
    }
}
