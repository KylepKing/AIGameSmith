<script setup lang="ts">
//import { RouterLink, RouterView } from 'vue-router'

import { ref, shallowRef, computed, watch } from 'vue'
import { model } from '../firebase.ts'
import GameGenerator from '../components/GameGenerator.vue'



// AI response and loading
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


async function approveGame() {
  if (!customPrompt.value) return

  loading.value = true
  responseCode.value = ''
  editableCode.value = ''
  finalizedCode.value = ''

  const prompt = `
You are a web game developer.

Generate a unique and fun video game using this input:
- Game Idea: "${customPrompt.value.trim()}"

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
-Nothing done inside the game should pause the game, only the "<code>" button should pause the game. (this includes things like movement input changes, collisions, etc.)

Keep it concise and short  and self contained
`.trim()

  try {
    const result = await model.generateContentStream({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })

    // Stream chunks directly into both responseCode and editableCode


   let lastLayout = 0

  for await (const chunk of result.stream) {
    const chunkText = chunk.text()
    responseCode.value += chunkText
    editableCode.value += chunkText

    finalizedCode.value = responseCode.value

    const now = Date.now()
    if (now - lastLayout > 100) {
      editor.value?.layout()
      lastLayout = now
    }

    // Scroll editor to bottom
    // Get model line count (last line number)
    const lineCount = editor.value?.getModel()?.getLineCount() || 1
    // Reveal last line at the bottom of the viewport
    editor.value?.revealLineInCenter(lineCount)

  }


  } catch (error) {
    responseCode.value = 'Something went wrong. Check the console.'
    editableCode.value = 'Something went wrong. Check the console.'
    finalizedCode.value = ''
    console.error('Gemini error:', error)
  } finally {
    loading.value = false
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

// ✅ Dynamic editor height based on whether code has been generated
const editorHeight = computed(() => {
  return finalizedCode.value.length > 0 ? '600px' : '150px'
})

</script>

<template>
  <div class="header">
    <h1>Game Generator</h1>
  </div>


  <!-- Custom Prompt UI -->
  <div class="custom-input">
    <label for="customPrompt">Describe your game idea:</label>
    <textarea v-model="customPrompt" placeholder="E.g., A detective game set in space with time-loop mechanics..."></textarea>
    <div class="button-container">
      <button @click="approveGame" :disabled="loading">
      {{ loading ? 'Generating...' : 'Generate Game' }}
    </button>
    <button @click="resetApp" class="reset-button">
      🔄 Reset
    </button>
    </div>
  </div>





<!-- Monaco Debug Console -->
<div class="debug-console">
  <h3>🛠 Debug / Edit Code</h3>

  <div class="monaco-wrapper" :style="{ height: editorHeight }">
    <vue-monaco-editor
      v-model:value="editableCode"
      language="html"
      theme="vs-dark"
      :options="MONACO_EDITOR_OPTIONS"
      @mount="handleMount"
    />
  </div>

  <button @click="reloadGameFromDebug" :disabled="!isCodeEdited" style="margin-top: 1rem;">
    🔁 Reload Game with Edits
  </button>
</div>

<!-- Game Runner -->
<GameGenerator v-if="!loading && finalizedCode" :responseCode="finalizedCode" />
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
}

.monaco-wrapper {
  width: 100%;
  transition: height 0.5s ease;
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

button:disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
