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

export async function transcribeAudio(audioUri: string) {
    try {
        const formData = new FormData();
        // @ts-ignore
        formData.append('file', {
            uri: audioUri,
            type: 'audio/m4a',
            name: 'recording.m4a',
        });
        formData.append('model', 'whisper-large-v3');
        formData.append('response_format', 'json');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
            },
            body: formData,
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        return data.text;
    } catch (error) {
        console.error('Groq Transcription Error:', error);
        throw error;
    }
}


export async function extractMedicinesFromText(text: string) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'user',
                        content: `Extract medicine names and dosages from this text. Return only JSON with keys "summary" and "medicines" (array of {name, dosage}). Text: "${text}"`,
                    },
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            }),
        });

        const data = await response.json();
        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Groq Extraction Error:', error);
        throw error;
    }
}

export async function analyzeSymptoms(symptoms: string) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an AI medical assistant using emergency triage protocols. Evaluate the severity of the symptoms based on clinical urgency. \n' +
                            '- HIGH: Life-threatening, severe pain, breathing difficulty, chest pain, stroke signs, "dying", or immediate emergency.\n' +
                            '- MEDIUM: Significant discomfort, infection signs, requires medical attention soon but not immediately life-threatening.\n' +
                            '- LOW: Minor ailments, colds, slight discomfort, can be managed at home.\n' +
                            'Provide a SINGLE sentence of clear, calm advice. Return strict JSON.',
                    },
                    {
                        role: 'user',
                        content: `Analyze these symptoms: "${symptoms}". Return JSON with keys: "severity" (string: "LOW", "MEDIUM", "HIGH") and "advice" (string).`,
                    },
                ],
                temperature: 0.1,
                max_tokens: 256,
                response_format: { type: 'json_object' }
            }),
        });

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('Groq Analysis Error:', error);
        throw error;
    }
}
