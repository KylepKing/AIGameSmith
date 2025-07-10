<script setup lang="ts">
//import { RouterLink, RouterView } from 'vue-router'

import { ref, computed, watch } from 'vue'
import { model } from './firebase.ts'
import GameGenerator from './components/GameGenerator.vue'

// Mode Selector
const mode = ref<'preset' | 'custom'>('preset')

// Dropdown options
const mediums = ['2D', '3D', 'Text-Based']
const genres = ['Platformer', 'RPG', 'Puzzle', 'Shooter', 'Card Game', 'Strategy', 'Simulation', 'Adventure', 'Action', 'TurnBased']
const themes = ['Fantasy', 'Cyberpunk', 'Post-Apocalyptic', 'Sci-Fi', 'Steampunk', 'Horror', 'Mystery', 'Historical', 'Comedy', 'Superhero', 'Mythology', 'Space Exploration', 'Nature', 'Urban', 'Underwater', 'War']

// User selections
const selectedMedium = ref('')
const selectedGenre = ref('')
const selectedTheme = ref('')

// AI response and loading
const responseText = ref('')
const loading = ref(false)
const expanded = ref(false)
const responseCode = ref('')
const customPrompt = ref('')


// Randomizers
function randomizeMedium() {
  selectedMedium.value = mediums[Math.floor(Math.random() * mediums.length)]
}
function randomizeGenre() {
  selectedGenre.value = genres[Math.floor(Math.random() * genres.length)]
}
function randomizeTheme() {
  selectedTheme.value = themes[Math.floor(Math.random() * themes.length)]
}
function randomizeAll() {
  randomizeMedium()
  randomizeGenre()
  randomizeTheme()
}

// Wrap in an async function so you can use await // submit for both modes
async function submitQuestion() {
  loading.value = true
  responseText.value = ''

  let prompt =''

  if (mode.value === 'preset') {
    if (!selectedMedium.value || !selectedGenre.value || !selectedTheme.value) {
      loading.value = false
      return
    }
    prompt = `
You are a creative game designer.

Generate a unique and fun video game idea using these inputs:
- Medium: ${selectedMedium.value}
- Genre: ${selectedGenre.value}
- Theme: ${selectedTheme.value}

Include:
- A core gameplay loop (including main mechanic and basics of how that system works)
- A short story/setting
- Art style
- Optional characters or power-ups
-At the end provice a short list of steps to take to start building the game. Do not include any code just an outline of steps.

Keep it concise but imaginative.
`.trim()
  } else if (mode.value === 'custom') {
    if (!customPrompt.value.trim()) {
      loading.value = false
      return
    }
    prompt = `
You are a creative game designer.

Generate a unique and fun video game idea based on this input:
"${customPrompt.value.trim()}"

Notice:
-if the game is a reference, clone, copy or similiar to an existing game mentioned in the prompt focus on mimicing that game and not adding additional features or mechanics unless asked.
Include:
- A core gameplay loop (including main mechanic and basics of how that system works)
- A short story/setting
- Art style
- working movement controls and collisions detections (so you dont fall through the floor or walls)


Keep it concise but imaginative.
`.trim()
  }

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    responseText.value = text
  } catch (error) {
    responseText.value = 'Something went wrong. Check the console.'
    console.error('Gemini error:', error)
  } finally {
    loading.value = false
  }
}

async function approveGame() {
  if (!responseText.value) return

  loading.value = true

  const prompt = `
You are a web game developer.

Generate a unique and fun video game using this input:
- Game Idea: ${responseText.value}

You must generate this game code with HTML, CSS, and javaScript in a single output that can be put into a component that can called in the main web page component. Users must be able too see and play the game in the browser using basic mouse and keyboard controls as called for.
-Give me the raw HTML without markdown or any other formatting.

When generating the game idea, include:
- its core gameplay loop listed in the game idea (focus on the main mechanics first and if unable to do that simplify the game idea to a version that can be built)
- A elements of the story listen in the game idea (unless the type of game would not make sense to have a story like a puzzle game )
- Art style possible within the confines of a web game
-At the end provide a small button in the top left corner that says "<code>" that when clicked will pause the game and show the generated code used to build the game. This needs to not be in the game just outside it.
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
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    responseCode.value = text
  } catch (error) {
    responseCode.value = 'Something went wrong. Check the console.'
    console.error('Gemini error:', error)
  } finally {
    loading.value = false
  }
}

function resetApp() {
  window.location.reload()
}

function toggleExpanded() {
  expanded.value = !expanded.value
}

const previewText = computed(() =>
  responseText.value.length > 300
    ? responseText.value.slice(0, 300) + '...'
    : responseText.value
)


const editableCode = ref('')

// Sync code when game is generated
watch(responseCode, () => {
  editableCode.value = responseCode.value
})

function reloadGameFromDebug() {
  responseCode.value = editableCode.value
}


</script>

<template>
  <div class="header">
    <h1>Game Idea Generator</h1>
  </div>

  <!-- Mode Selector -->
  <div class="mode-selector">
    <label>Generation Mode:</label>
    <select v-model="mode">
      <option value="preset">Preset (Medium / Genre / Theme)</option>
      <option value="custom">Custom Prompt</option>
    </select>
  </div>

  <!-- Preset Mode UI -->
  <div v-if="mode === 'preset'">
    <div class="select-group">
      <label>Medium</label>
      <select v-model="selectedMedium">
        <option disabled value="">-- Select Medium --</option>
        <option v-for="m in mediums" :key="m" :value="m">{{ m }}</option>
      </select>
      <button @click="randomizeMedium">🎲</button>
    </div>

    <div class="select-group">
      <label>Genre</label>
      <select v-model="selectedGenre">
        <option disabled value="">-- Select Genre --</option>
        <option v-for="g in genres" :key="g" :value="g">{{ g }}</option>
      </select>
      <button @click="randomizeGenre">🎲</button>
    </div>

    <div class="select-group">
      <label>Theme</label>
      <select v-model="selectedTheme">
        <option disabled value="">-- Select Theme --</option>
        <option v-for="t in themes" :key="t" :value="t">{{ t }}</option>
      </select>
      <button @click="randomizeTheme">🎲</button>
    </div>

    <div class="button-container">
      <div class="main-buttons">
        <button @click="randomizeAll">🎲 Randomize All</button>
        <button @click="submitQuestion" :disabled="loading">
          Ask Gemini {{ loading ? 'Thinking...' : '' }}
        </button>
      </div>
    </div>
  </div>

  <!-- Custom Prompt UI -->
  <div v-else-if="mode === 'custom'" class="custom-input">
    <label for="customPrompt">Describe your game idea:</label>
    <textarea v-model="customPrompt" placeholder="E.g., A detective game set in space with time-loop mechanics..."></textarea>
    <div class="button-container">
      <button @click="submitQuestion" :disabled="loading">
        Ask Gemini {{ loading ? 'Thinking...' : '' }}
      </button>
    </div>
  </div>

  <!-- Common Controls -->
  <div class="button-container">
    <button @click="resetApp" class="reset-button">
      🔄 Reset
    </button>
    <button @click="approveGame" :disabled="!responseText || loading">
      Generate Game
    </button>
  </div>

  <!-- Response Box -->
  <div v-if="responseText" class="response-box">
    <h2>Response:</h2>
    <div @click="toggleExpanded" class="response-toggle">
      <div class="response-preview" v-html="(expanded ? responseText : previewText)">
      </div>
      <span class="dropdown-arrow">{{ expanded ? '▲ Show Less' : '▼ Show More' }}</span>
    </div>
  </div>

  <!-- Game Runner -->
  <GameGenerator v-if="responseCode" :responseCode="responseCode" />

  <!-- Debug Console -->
<div v-if="responseCode" class="debug-console">
  <h3>🛠 Debug / Edit Code</h3>
  <textarea
    v-model="editableCode"
    class="debug-textarea"
    placeholder="Edit the generated code here..."
  ></textarea>
  <button @click="reloadGameFromDebug">Reload Game with Edits</button>
</div>


</template>

<style scoped>
.header {
  text-align: center;
  margin-bottom: 2rem;
  color: #51a2ff;
  font-style: oblique;
}

.mode-selector {
  margin: 1rem;
  text-align: center;
}

.select-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  justify-content: center;
}

.button-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-top: 2rem;
}

.main-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
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

.response-box {
  margin-top: 2rem;
  background: #2d2d44;
  padding: 1.5rem;
  border-radius: 8px;
  white-space: pre-wrap;
  line-height: 1.5;
}

.response-box h2 {
  margin-bottom: 1rem;
  font-size: 1.25rem;
  color: #51a2ff;
}

.response-box pre {
  white-space: pre-wrap;
  font-family: monospace;
  color: #e0e0e0;
}

textarea {
  width: 80%;
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
</style>
