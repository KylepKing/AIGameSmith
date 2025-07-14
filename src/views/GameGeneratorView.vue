<script setup lang="ts">
//import { RouterLink, RouterView } from 'vue-router'

import { ref, shallowRef, computed, watch } from 'vue'
import { model } from '../firebase.ts'
import GameGenerator from '../components/GameGenerator.vue'



// AI response and loading
const gameGenerated = ref(false)
const loading = ref(false)
const responseCode = ref('')
const customPrompt = ref('')
const finalizedCode = ref('')


//editor options
const MONACO_EDITOR_OPTIONS = {
  automaticLayout: true,
  formatOnType: true,
  formatOnPaste: true,
}

const code = ref('// some code...')
const editor = shallowRef()
const handleMount = (editorInstance: any) => {
  (editor.value = editorInstance)
   editorInstance.getAction('editor.action.formatDocument').run()
}


//Chat history
const chatHistory = ref<any[]>([])
let chatSession: any = null
const codeExists = ref(false)
async function approveGame() {

  if (!customPrompt.value) return

  loading.value = true
  responseCode.value = ''
  editableCode.value = ''
  finalizedCode.value = ''

  try {
    // If there's no active chat session, start one with existing history
    if (!chatSession) {
      chatSession = model.startChat({
        history: chatHistory.value,
        generationConfig: {

        },
      });
    }

    // User message
    const userMessage = codeExists.value
      ? 'Fix or imporve the existing game code based of this input: " ${customPrompt.value.trim()}"'
      :`
You are a web game developer.

Generate a unique and fun video game using this input:
- Game Idea: "${customPrompt.value.trim()}"

You must generate this game code with HTML, CSS, and javaScript in a single output that can be put into a component that can called in the main web page component. Users must be able too see and play the game in the browser using basic mouse and keyboard controls as called for.
-Give me the raw HTML without markdown or any other formatting.

If code is already generated do not regenerate the game, instead just fix the game based on the new or adjusted game idea. This means modifying the existing code not rebuilding it from scratch.

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
-Nothing done inside the game should pause the game, only the "<code>" button should pause the game. (this includes things like movement input changes, collisions, etc.)

Keep it concise and short  and self contained
`.trim()

    // Save user message to history
    chatHistory.value.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    // Send message using chat
    const result = await chatSession.sendMessageStream(userMessage);

    let fullResponse = '';
    let lastLayout = 0;

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponse += chunkText;
      responseCode.value += chunkText;
      editableCode.value += chunkText;

      finalizedCode.value = responseCode.value;

      const now = Date.now();
      if (now - lastLayout > 100) {
        editor.value?.layout();
        lastLayout = now;
      }

      const lineCount = editor.value?.getModel()?.getLineCount() || 1;
      editor.value?.revealLineInCenter(lineCount);
    }

    // Add AI response to chat history
    chatHistory.value.push({
      role: 'model',
      parts: [{ text: fullResponse }],
    });

  } catch (error) {
    responseCode.value = 'Something went wrong. Check the console.';
    editableCode.value = 'Something went wrong. Check the console.';
    finalizedCode.value = '';
    console.error('Gemini error:', error);
  } finally {
    gameGenerated.value = true
    loading.value = false;
    codeExists.value = true
  }


}

function resetApp() {
  window.location.reload()
}


const editableCode = ref('')
const isCodeEdited = computed(() => {
  return editableCode.value !== responseCode.value
})
// Sync code when game is generated
watch(responseCode, () => {
  editableCode.value = responseCode.value
})

function reloadGameFromDebug() {
  responseCode.value = editableCode.value
  finalizedCode.value = editableCode.value
}

const previousCode = ref('')
const showUndo = ref(false)

function undoLastFix() {
  editableCode.value = previousCode.value
  responseCode.value = previousCode.value
  finalizedCode.value = previousCode.value
  showUndo.value = false
}


const fixPrompt = ref('')

async function requestGameFix() {
  if (!fixPrompt.value || !chatSession) return

  loading.value = true

  try {
    const userFix = `
Here is the current game code:

${editableCode.value}

Please modify the game code below to reflect the following change: "${fixPrompt.value.trim()}"

Do not regenerate the game. Do not replace the full code. Only change the parts necessary to apply the fix. Maintain all unchanged parts as-is.

Respond ONLY with valid raw HTML/CSS/JS — no markdown or explanations.
`.trim()

    chatHistory.value.push({
      role: 'user',
      parts: [{ text: userFix }],
    });

    // Save current code before applying fix
    previousCode.value = editableCode.value
    showUndo.value = true

    // Clear for new fix
    responseCode.value = ''
    editableCode.value = ''
    finalizedCode.value = ''
    const result = await chatSession.sendMessageStream(userFix);

    let fixResponse = ''
    for await (const chunk of result.stream) {
      const chunkText = chunk.text()
      fixResponse += chunkText
      responseCode.value += chunkText
      editableCode.value += chunkText
      finalizedCode.value = responseCode.value
    }

    chatHistory.value.push({
      role: 'model',
      parts: [{ text: fixResponse }],
    });

  } catch (err) {
    console.error('Fix request failed:', err)
  } finally {
    loading.value = false
  }
}


// ✅ Dynamic editor height based on whether code has been generated
const editorHeight = computed(() => {
  return finalizedCode.value.length > 0 ? '600px' : '150px'
})

const editorWidth = computed(() => {
  const lines = editableCode.value.split('\n')
  const longestLine = lines.reduce((a, b) => (a.length > b.length ? a : b), '').length
  const charWidth = 8.2 // estimate (depends on font)
  const minWidth = 500
  const maxWidth = 1200
  return `${Math.min(Math.max(longestLine * charWidth, minWidth), maxWidth)}px`
})

</script>

<template>
  <div class="header">
    <h1>Game Generator</h1>
  </div>


    <!-- Game Prompt OR Fix Input -->
  <div v-if="!gameGenerated" class="custom-input">
    <label for="customPrompt">Describe your game idea:</label>
    <textarea
      v-model="customPrompt"
      placeholder="E.g., A detective game set in space with time-loop mechanics..."
    ></textarea>
    <div class="button-container">
      <button @click="approveGame" :disabled="loading">
        {{ loading ? 'Generating...' : 'Generate Game' }}
      </button>
      <button @click="resetApp" class="reset-button">
        🔄 Reset
      </button>
    </div>
  </div>

  <!-- Adjust / Fix prompt -->
  <div v-else class="fix-input">
    <label for="fixPrompt">Adjust the game:</label>
    <textarea
      v-model="fixPrompt"
      placeholder="E.g., Make the enemy faster or change the color scheme..."
    ></textarea>
    <div class="button-container">
      <button @click="requestGameFix" :disabled="loading">
        {{ loading ? 'Adjusting...' : 'Adjust Game' }}
      </button>
      <button @click="resetApp" class="reset-button">
        🔄 Reset
      </button>
    </div>
  </div>

  <!-- Monaco Debug Console -->
  <div class="debug-console">
    <h3>🛠 Debug / Edit Code</h3>

    <div class="monaco-wrapper" :style="{ height: editorHeight, width: editorWidth }">
      <vue-monaco-editor
        v-model:value="editableCode"
        language="html"
        theme="vs-dark"
        :options="MONACO_EDITOR_OPTIONS"
        @mount="handleMount"
      />
    </div>

    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
      <button @click="reloadGameFromDebug" :disabled="!isCodeEdited">
      🔁 Reload Game with Edits
      </button>
      <button v-if="showUndo" @click="undoLastFix">
        ⏪ Undo Last Fix
      </button>
    </div>
  </div>
  <!-- Game Runner -->
  <div class="game-container" v-if="!loading && finalizedCode">
    <GameGenerator :responseCode="finalizedCode" :key="finalizedCode" />
  </div>

</template>

<style scoped>
.header {
  text-align: center;
  margin-bottom: 2rem;
  color: #51a2ff;
  font-style: oblique;
}


.button-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}


.reset-button {
  padding: 0.8rem 1.5rem;
  background-color: #9ca3af;
  color: #1e1e2f;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
  align-self: center;
}

.reset-button:hover {
  background-color: #6b7280;
}

button {
  padding: 0.8rem 1.5rem;
  background-color: #4f46e5;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  align-self: flex-start;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #3730a3;
}


textarea {
  width: 200%;
  max-width: 600px;
  height: 100px;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  resize: vertical;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.custom-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
}

.fix-input {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 1rem;
}

.debug-console {
  margin-top: 2rem;
  width: 90%;
  max-width: 1000px;
  margin-left: auto;
  margin-right: auto;
  padding: 1rem;
  background: #1f1f2f;
  border-radius: 8px;
  border: 1px solid #444;
  color: white;
  overflow-x: auto
}

.monaco-wrapper {
 /* width: 100%;*/
  transition: height 0.5s ease, width 0.5s ease;
  border: 1px solid #333;
  border-radius: 6px;
  overflow: hidden;
}

.debug-textarea {
  width: 100%;
  height: 300px;
  background-color: #0d0d15;
  color: #e0e0e0;
  border: 1px solid #666;
  border-radius: 6px;
  padding: 1rem;
  font-family: monospace;
  font-size: 0.9rem;
  margin-bottom: 1rem;
  resize: vertical;
}

.game-container {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 2rem;
  padding: 1rem;
}

button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}

button:has(svg), button:has(.undo-icon) {
  background-color: #eab308; /* amber */
}

button:has(svg):hover {
  background-color: #ca8a04;
}
</style>
