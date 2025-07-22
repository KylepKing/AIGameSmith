/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onRequest} from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


/*import { genkit, z } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';
import { onCallGenkit } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';

// Initialize Firebase Admin SDK
initializeApp();

// Define the API key as a secret
const apiKey = defineSecret('GOOGLE_GENAI_API_KEY');

// Initialize Genkit with Google AI plugin
const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});

// Define the input schema
const inputSchema = z.object({
  gameId: z.string().nullable(),
  prompt: z.string(),
});

// Define the flow
const gamePromptFlow = ai.defineFlow(
  {
    name: 'gamePromptFlow',
    inputSchema: inputSchema,
    outputSchema: z.string(),
    streamSchema: z.string(),
  },
  async ({ gameId, prompt }, { sendChunk }) => {
    // Construct the prompt, incorporating gameId if provided
    const fullPrompt = gameId
      ? `For game ID ${gameId}: ${prompt}`
      : prompt;

    // Generate response using the Gemini model
    const { stream, response } = ai.generateStream(fullPrompt);

    // Stream the response to the client
    for await (const chunk of stream) {
      sendChunk(chunk.text);
    }

    // Return full response for non-streaming clients
    return (await response).text;
  }
);

// Export the flow as a callable Firebase function
exports.gamePrompt = onCallGenkit(
  {
    secrets: [apiKey],
    authPolicy: (user) => {
      if (!user?.firebase?.sign_in_provider) {
        throw new Error('Authentication required');
      }
    }, // Optional: Require authentication
  },
  gamePromptFlow
);*/
