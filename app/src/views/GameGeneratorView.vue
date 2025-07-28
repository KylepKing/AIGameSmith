<script setup lang="ts">
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { doc, collection, setDoc, getDoc, onSnapshot, query, orderBy, limit, type Unsubscribe, getDocs, } from 'firebase/firestore'
import { firestore } from '../firebase.ts'
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { model } from '../firebase.ts'
import GameGenerator from '../components/GameGenerator.vue'
import { getFunctions, httpsCallable } from 'firebase/functions'


// Initialize Firebase Functions
const functions = getFunctions()
const generateGameFunction = httpsCallable(functions, 'generateGame')

const view = ref('prompt')
// AI response and loading

const loading = ref(false)
const responseCode = ref('')
const customPrompt = ref('')
const finalizedCode = ref('')


const router = useRouter();
const route = useRoute();
watch(router.currentRoute, (to, from) => {
  if (to.path !== from.path) {
    getGame();
  }
});

const game = ref<any>(null);
const version = ref<any>(null);
const versions = ref<any[]>([]);

const createGame = async () => {
  const ref = doc(collection(firestore, 'games'));
  const data = { id: ref.id, created_at: new Date()};
  await setDoc(ref, data);
  game.value = data;
  await createVersion();
  await router.push(`/game/${ref.id}`);
  game.value = data;
};

const getGame = async () => {
  editableCode.value = ''
  finalizedCode.value = ''
  chatHistory.value = []
  versions.value = []
  game.value = null;
  version.value = null;
  const { id } = route.params;
  if (!id ) {
    chatSession = model.startChat();
    view.value = 'prompt';
    return;
  }
  view.value = 'generator';
  const docRef = await getDoc(doc(firestore, `games/${id}`));
  if (!docRef.exists()) {
    router.push('/');
    return;
  }
  game.value = docRef.data();
  const docs = await getDocs(query(collection(firestore, `games/${id}/versions`), orderBy('created_at', 'desc')))
  versions.value = docs.docs.map(doc => doc.data());
  version.value = versions.value[0];
  editableCode.value = version.value?.code || '';
  finalizedCode.value = version.value?.code || '';

  const prompts = versions.value.reverse().map(( v: any ) => {
    return { text: v.prompt}
  })
  const answers = versions.value.reverse().map(( v: any ) => {
    return { text: v.code }
  })

  chatHistory.value = [ {
    role: 'user',
    parts : prompts
  },
  {
    role: 'model',
    parts: answers
  }]

  chatSession = model.startChat({
        history: chatHistory.value,
        generationConfig: {

        },
      });

};

const createVersion = async () => {
  if (!game.value) throw new Error('No game to create version for');
  const { id } = game.value;
  const ref = doc(collection(firestore, `games/${id}/versions`));
  const data = { id: ref.id, prompt: customPrompt.value, code: finalizedCode.value, created_at: new Date() };
  await setDoc(ref, data);
};

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


async function approveGame() {
  if (!customPrompt.value) return
  view.value = 'generator'
  loading.value = true
  responseCode.value = ''
  editableCode.value = ''
  finalizedCode.value = ''

  try {
    // Call the backend function
    const { stream } = await generateGameFunction.stream({
      prompt: customPrompt.value.trim(),
      isNewGame: !game.value,
      existingCode: game.value ? finalizedCode.value : undefined
    })

   let fullResponse = '';
    let lastLayout = 0;

    for await (const chunk of stream) {
      //const chunkText = chunk.text();
      fullResponse += chunk;
      responseCode.value += chunk;
      editableCode.value += chunk;

      finalizedCode.value = responseCode.value;

      const now = Date.now();
      if (now - lastLayout > 100) {
        editor.value?.layout();
        lastLayout = now;
      }

      const lineCount = editor.value?.getModel()?.getLineCount() || 1;
      editor.value?.revealLineInCenter(lineCount);
    }

    await createGame()
    //console.log('Game created:', game.value)
    customPrompt.value = '' // Clear the fix input after applying

  } catch (error) {
    responseCode.value = 'Something went wrong. Check the console.'
    editableCode.value = 'Something went wrong. Check the console.'
    finalizedCode.value = ''
    console.error('Game generation error:', error)
  } finally {
    loading.value = false
  }
}

function resetApp() {
  view.value = 'prompt'
  router.push('/')
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



// Updated requestGameFix function
async function requestGameFix() {
  if (!customPrompt.value) return

  loading.value = true

  try {
    // Save current code before applying fix
    previousCode.value = editableCode.value
    showUndo.value = true

    // Clear for new fix
    responseCode.value = ''
    editableCode.value = ''
    finalizedCode.value = ''

    // Call the backend function for game fixes
    const result = await generateGameFunction({
      prompt: customPrompt.value.trim(),
      isNewGame: false,
      existingCode: previousCode.value
    })

    // Handle streaming response
    if (result.data && typeof result.data === 'string') {
      responseCode.value = result.data
      editableCode.value = result.data
      finalizedCode.value = result.data
    }

    await createVersion()
    customPrompt.value = '' // Clear the fix input after applying

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



onMounted(() => {
  getGame()
})

const leftWidth = ref(500) // Initial width in pixels
let isDragging = false

const startDrag = (e: MouseEvent) => {
  isDragging = true
  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging) return
  const minWidth = 200
  const maxWidth = window.innerWidth - 300
  leftWidth.value = Math.min(Math.max(e.clientX, minWidth), maxWidth)
}

const stopDrag = () => {
  isDragging = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
}

onBeforeUnmount(() => {
  stopDrag()
})

</script>

<template>


  <div class="main-content" :view="view" v-if="view === 'generator'">

    <div class="split-view">

      <!-- LEFT SIDE -->
      <div class="left-pane" :style="{ width: leftWidth + 'px' }">
        <div class="header">
          <h1>Game Generator</h1>
        </div>

      <!-- Prompt Input -->
      <div v-if="!game" class="custom-input">
        <label for="customPrompt">Describe your game idea:</label>
        <textarea
          v-model="customPrompt"
          placeholder="E.g., A detective game set in space with time-loop mechanics..."
        ></textarea>
        <div class="button-container">
          <button @click="approveGame" :disabled="loading">
            {{ loading ? 'Generating...' : 'Generate Game' }}
          </button>
          <button @click="resetApp" class="reset-button">🔄 Reset</button>
        </div>
      </div>

      <!-- Fix Prompt -->
      <div v-else class="fix-input">
        <label for="fixPrompt">Adjust the game:</label>
        <textarea
          v-model="customPrompt"
          placeholder="E.g., Make the enemy faster or change the color scheme..."
        ></textarea>
        <div class="button-container">
          <button @click="requestGameFix" :disabled="loading">
            {{ loading ? 'Adjusting...' : 'Adjust Game' }}
          </button>
          <button @click="resetApp" class="reset-button">🔄 Reset</button>
        </div>
      </div>

      <!-- Debug Console -->
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

    </div>

    <!-- DRAGGABLE DIVIDER -->
    <div
      class="resizer"
      @mousedown="startDrag">
    </div>

    <!-- RIGHT SIDE -->
    <div class="right-pane" :style="{ flex: 1 }" v-if="!loading && finalizedCode">
      <GameGenerator :responseCode="finalizedCode" :key="finalizedCode" />
    </div>

  </div>
  </div>

  <div class="prompt-container" v-else-if ="view === 'prompt'">

    <div class="header">
      <h1>Game Generator</h1>
    </div>

    <!-- Game Prompt OR Fix Input -->
    <div v-if="!game" class="custom-input">
      <label for="customPrompt">Describe your game idea:</label>
      <textarea
        v-model="customPrompt"
        placeholder="E.g., A detective game set in space with time-loop mechanics..."
      ></textarea>
      <div class="button-container">
        <button @click="approveGame" :disabled="loading">
          {{ loading ? 'Generating...' : 'Generate Game' }}
        </button>
      </div>
    </div>



  </div>
</template>

<style scoped>

/*.main-content .debug-console{ use this format for styling the page once the game starts generating

}*/

.split-view {
  display: flex;
  flex-direction: row;
  height: 100vh;
  overflow: hidden;
  gap : 0.5rem;
}

.left-pane {
  border-radius: 4px;
  border: 1px solid #ffffff;
  overflow: auto;
  min-width: 200px;
  max-width: 80vw;
}



.right-pane {
  flex: 1;
  overflow: auto;
  background-color: #111827;
  padding: 1rem;
  border-radius: 4px;
  border: 1px solid #ffffff;
  /*min-width: 200px;
  max-width: 80%;
  display: flex;
  justify-content: center;
  align-items: flex-start;*/
}

.resizer {
   width: 8px;
  background-color: #4f46e5;
  cursor: col-resize;
  user-select: none;
  /* Make it stretch full height */
  height: 100%;
  /* Prevent it from shrinking */
  flex-shrink: 0;
  /* optionally add some hover effect */
  transition: background-color 0.2s ease;
}

.resizer:hover {
  background-color: #666;
}

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

 .main-content .button-container {
  display: flex;
  flex-direction: row;
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
