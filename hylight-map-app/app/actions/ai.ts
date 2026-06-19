'use server';

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

export async function generateImageDescription(imageUrl: string) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set in the environment variables.');
    }

    const google = createGoogleGenerativeAI({ apiKey });

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const imageBuffer = await response.arrayBuffer();

    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Describe this image in one short, clear sentence. Focus on the main subject and the location or atmosphere. Do not use conversational filler like "This is an image of".',
            },
            {
              type: 'image',
              image: imageBuffer,
            },
          ],
        },
      ],
    });

    return { description: text };
  } catch (error) {
    console.error('Error generating AI description:', error);
    return { description: null };
  }
}
