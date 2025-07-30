import { setGlobalOptions } from "firebase-functions";
import { onCallGenkit } from "firebase-functions/v2/https";
import { genkit, z } from "genkit";
import { googleAI, gemini20Flash } from "@genkit-ai/googleai";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const apiKey = defineSecret("GOOGLE_GENAI_API_KEY");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();


// Set global options for cost control
setGlobalOptions({ maxInstances: 10 });

// Initialize Genkit with Google AI plugin
const ai = genkit({
  plugins: [googleAI()],
  model: gemini20Flash,
});

// Define the game generation flow
const gameGenerator = ai.defineFlow(
  {
    name: "gameGenerator",
    inputSchema: z.object({
      prompt: z.string(),
      gameID: z.string().nullable(),
      existingCode: z.string().nullable(),
    }),
    outputSchema: z.object({
      fullResponse: z.string(),
      gameID: z.string(),
      isNewGame: z.boolean(),
    }),
    streamSchema: z.string(),
  },
  async ({ prompt, gameID, existingCode }, { sendChunk }) => {
    let userMessage: string;
    logger.log("Generating game with prompt:", prompt, "isNewGame:", gameID, "existingCode:", existingCode);
    let isNewGame = false;
    if (!gameID) {
      userMessage = `
You are a web game developer.

Generate a unique and fun video game using this input:
- Game Idea: "${prompt.trim()}"

You must generate this game code with HTML, CSS, and javaScript in a single output that can be put into a component that can called in the main web page component. Users must be able too see and play the game in the browser using basic mouse and keyboard controls as called for.
-Give me the raw HTML without markdown or any other formatting.

When generating the game idea, include:
- its core gameplay loop listed in the game idea (focus on the main mechanics first and if unable to do that simplify the game idea to a version that can be built)
- A elements of the story listen in the game idea (unless the type of game would not make sense to have a story like a puzzle game )
- Art style possible within the confines of a web game
-At the end provide a small button in the top left corner that says "||" that when clicked will pause the game and when clicked again will unpause the game .
-In the top right corner of the game add a small button that says "Reset" that when clicked will reset the game to its initial state.
-The game should be replayable and not just a one time game.
-include a simple tutorial popup box that explains how to play the game, needs to be able to be closed and not show again.
-Do not include any additional features or mechanics unless asked.
-Do not initialize the game until the DOM is fully loaded.
-Must include a start game button that starts the game when clicked.
-Nothing done inside the game should pause the game, only the "||" button should pause the game. (this includes things like movement input changes, collisions, etc.)

Keep it concise and short and self contained
`.trim();
    } else {
      userMessage = `
Here is the current game code:

${existingCode || ""}

Please modify the game code below to reflect the following change: "${prompt.trim()}"

Do not regenerate the game. Do not replace the full code. Only change the parts necessary to apply the fix. Maintain all unchanged parts as-is.

Respond ONLY with valid raw HTML/CSS/JS — no markdown or explanations.
`.trim();
    }

    const { stream } = await ai.generateStream(userMessage);

    let fullResponse = "";

    // Stream the response to the client
    for await (const chunk of stream) {
      const chunkText = chunk.text;
      fullResponse += chunkText;
      sendChunk(chunkText);
    }

    if (!gameID) {
      // Create a new game document in Firestore
      isNewGame = true;
      const gameData = await createGame();
      await createVersion(gameData.id, prompt, fullResponse);
      gameID = gameData.id;
      logger.log("Game created:", gameData);
    } else {
      const game = await db.collection("games").doc(gameID).get();
      if (!game.exists) {
        throw new Error(`Game with ID ${gameID} does not exist`);
      }
      await createVersion(gameID, prompt, fullResponse);
    }
    // we should not await the writing to database as we want to return the response immediately
    return {fullResponse, gameID, isNewGame};
  }
);

// Export the game generator as a callable Firebase function
export const generateGame = onCallGenkit(
  {
    secrets: [apiKey],
  },
  gameGenerator
);


// Create game function
const createGame =
  async () => {
    try {
      // Create game document
      const gameRef = db.collection("games").doc();
      const gameData = {
        id: gameRef.id,
        created_at: new Date(),
      };
      await gameRef.set(gameData);


      return gameData;
    } catch (error) {
      logger.error("Error creating game:", error);
      throw new Error("Failed to create game");
    }
  };

// Create version function
const createVersion =
  async (gameId : string, prompt: string, code: string) => {
    try {
      // Create new version
      const versionRef = db.collection(`games/${gameId}/versions`).doc();
      const versionData = {
        id: versionRef.id,
        prompt: prompt,
        code: code,
        created_at: new Date(),
      };
      await versionRef.set(versionData);

      return versionData;
    } catch (error) {
      logger.error("Error creating version:", error);
      throw new Error("Failed to create version");
    }
  };
