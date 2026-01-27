const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export async function analyzePrescription(base64Image: string) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: 'Extract all the medicines and the dosage instructions from this prescription. Return the response in strict JSON format with two keys: "summary" (a brief text overview) and "medicines" (an array of objects, each with "name" and "dosage"). Example: {"summary": "...", "medicines": [{"name": "Aspirin", "dosage": "100mg once daily"}]}. If illegible, skip but focus on medicine names.',
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                },
                            },
                        ],
                    },
                ],
                temperature: 0.1,
                max_tokens: 1024,
                response_format: { type: 'json_object' }
            }),
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }

        // Parse the content as JSON
        const content = data.choices[0].message.content;
        return JSON.parse(content);
    } catch (error) {
        console.error('Groq API Error:', error);
        throw error;
    }
}
