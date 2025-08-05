<script setup lang="ts">
import { RouterLink, RouterView, useRouter, useRoute } from 'vue-router'
import { doc, collection, setDoc, getDoc, onSnapshot, query, orderBy, limit, type Unsubscribe, getDocs, } from 'firebase/firestore'
import { firestore } from '../firebase.ts'
import { ref, shallowRef, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { model } from '../firebase.ts'
import GameGenerator from '../components/GameGenerator.vue'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "firebase/auth";


// Initialize Firebase Functions
const functions = getFunctions()
const generateGameFunction = httpsCallable(functions, 'generateGame')
const getAccountFunction = httpsCallable(functions, 'getAccount')
const userSnapshotRef = ref<Unsubscribe | null>(null)


const user = ref<any>(null) // this is where you assign the return value of the getaccount function from the backend, ex: if user.token < 1
const userTokens = ref<number | null>(null)
const loadingUser = ref(true)
const initialized = ref(false)
const showLoginPopup = ref(false)

const canGenerate = computed(() => userTokens.value !== null && userTokens.value > 0)

const signInWithGoogle = async () => {
  const auth = getAuth()
  const provider = new GoogleAuthProvider()

  try {
    const result = await signInWithPopup(auth, provider)
    showLoginPopup.value = false // Close popup after successful login
  } catch (error) {
    console.error("Google sign-in failed:", error)
    alert("Sign-in failed. Please try again.")
  }
}

const openLoginPopup = () => {
  showLoginPopup.value = true
}

const closeLoginPopup = () => {
  showLoginPopup.value = false
}

const fetchUserTokens = async () => {
  userSnapshotRef.value?.()
  loadingUser.value = true
  try {
    const functions = getFunctions()
    const getAccount = httpsCallable(functions, 'getAccount')
    const response = await getAccount()
    const data = response.data as { tokens: number }
    userTokens.value = data.tokens
    userSnapshotRef.value = onSnapshot(doc(firestore, `users/${user.value.uid}`), (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        userTokens.value = data.tokens || 0
      } else {
        logout()
        userTokens.value = 0

      }
    })
  } catch (error) {
    console.error("Error fetching user tokens:", error)
    userTokens.value = null
  } finally {
    loadingUser.value = false
  }
}

const logout = () => {
  userSnapshotRef.value?.()
  signOut(getAuth())
}

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

  console.log(finalizedCode.value)
  try {
    // Call the backend function
    const { stream, data } = await generateGameFunction.stream({
      prompt: customPrompt.value.trim(),
      existingCode: game.value ? finalizedCode.value : undefined,
      gameID: game.value ? game.value.id : ""
    })

    responseCode.value = ''
    editableCode.value = ''
    finalizedCode.value = ''
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

    const result : any = await data

    if ( !game.value){
      await router.push(`/game/${result.gameID}`);
    }

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



onMounted(async () => {
  const auth = getAuth()
  if (auth.currentUser) {
    user.value = auth.currentUser
    await fetchUserTokens()
  } else {
    loadingUser.value = false
  }
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


onAuthStateChanged(getAuth(), async (result) => {
  if (result) {
    user.value = result
    await fetchUserTokens()
  } else {
    user.value = null
    userTokens.value = null
  }
  initialized.value = true
})

</script>

<template>

  <!-- Login Popup -->
  <div v-if="showLoginPopup" class="login-popup-overlay" @click="closeLoginPopup">
    <div class="login-popup" @click.stop>
      <div class="login-header">
        <h2>Login Required</h2>
        <button class="close-button" @click="closeLoginPopup">×</button>
      </div>
      <div class="login-content">
        <p>You need to be logged in to generate games.</p>
        <p>You'll receive 10 free tokens to start!</p>
        <button @click="signInWithGoogle" class="google-login-button">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  </div>

<!-- TOP BAR WITH LOGOUT BUTTON -->
  <div class="top-bar">
    <button
      v-if="user"
      @click="logout()"
      class="logout-button"
    >Logout</button>
    <button
      v-else
      @click="openLoginPopup"
      class="login-button"
    >🔑 Login</button>
  </div>

  <div class="header">
    <h1>Game Generator</h1>
  </div>

  <div v-if="!initialized" class="loading-screen">
    <h1>Loading...</h1>
  </div>
  <div class="main-content" :view="view" v-else-if="view === 'generator'">



    <div class="split-view">

      <!-- LEFT SIDE -->
      <div v-if="user && user.uid === game.user_id" class="left-pane" :style="{ width: leftWidth + 'px' }">

      <!-- Prompt Input -->
      <div v-if="!game" class="custom-input">
        <label for="customPrompt">Describe your game idea:</label>
        <textarea
          v-model="customPrompt"
          placeholder="E.g., A detective game set in space with time-loop mechanics..."
        ></textarea>
        <div class="button-container">
          <button @click="approveGame" :disabled="loading || !canGenerate">
            {{ loading ? 'Generating...' : 'Generate Game' }}
          </button>
          <p v-if="!canGenerate && !loading" style="color: #f87171; font-weight: bold; text-align: center;">
          You must be logged in and have tokens to generate a game.
          </p>

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
          <button @click="approveGame" :disabled="loading || !canGenerate">
            {{ loading ? 'Adjusting...' : 'Adjust Game' }}
          </button>
          <p v-if="!canGenerate && !loading" style="color: #f87171; font-weight: bold; text-align: center;">
          You must be logged in and have tokens to generate a game.
          </p>
          <!-- Show token count if logged in -->
          <div v-if="user && userTokens !== null" class="token-display">
            🪙 Tokens: <strong>{{ userTokens }}</strong>
          </div>
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
      @mousedown="startDrag"
      v-if="user && user.uid === game.user_id">
    </div>

    <!-- RIGHT SIDE -->
    <div class="right-pane" :style="{ flex: 1 }" v-if="!loading && finalizedCode">
      <GameGenerator :responseCode="finalizedCode" :key="finalizedCode" />
    </div>

  </div>
  </div>

  <div class="prompt-container" v-else-if ="view === 'prompt'">


    <!-- Game Prompt OR Fix Input -->
    <div v-if="!game" class="custom-input">
      <label for="customPrompt">Describe your game idea:</label>
      <textarea
        v-model="customPrompt"
        placeholder="E.g., A detective game set in space with time-loop mechanics..."
      ></textarea>
      <div class="button-container">
        <button v-if="user" @click="approveGame" :disabled="loading">
          {{ loading ? 'Generating...' : 'Generate Game' }}
        </button>
        <button v-else @click="openLoginPopup":disabled="loading">
          {{ loading ? 'Generating...' : 'Generate Game' }}
        </button>
        <!-- Show token count if logged in -->
          <div v-if="user && userTokens !== null" class="token-display">
            🪙 Tokens: <strong>{{ userTokens }}</strong>
          </div>
      </div>
    </div>



  </div>
</template>

<style scoped>

/* Login Popup Styles */
.login-popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.login-popup {
  background-color: #1f1f2f;
  border: 1px solid #444;
  border-radius: 12px;
  padding: 2rem;
  max-width: 400px;
  width: 90%;
  color: white;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}

.login-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.login-header h2 {
  margin: 0;
  color: #51a2ff;
  font-size: 1.5rem;
}

.close-button {
  background: none;
  border: none;
  color: #999;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: #333;
  color: white;
}

.login-content {
  text-align: center;
}

.login-content p {
  margin-bottom: 1rem;
  color: #ccc;
  line-height: 1.5;
}

.google-login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.8rem 1.5rem;
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  font-size: 1rem;
  transition: background-color 0.2s;
}

.google-login-button:hover {
  background-color: #3367D6;
}

.login-button {
  padding: 0.8rem 1.5rem;
  background-color: #eab308;
  color: #1e1e2f;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.2s;
  justify-self: center;
  align-self: center;

}

.login-button:hover {
  background-color: #ca8a04;
}

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

.top-bar {
  width: 95vmax;
  display: flex;
  justify-content: center; /* right align button */
  align-items: center;
  padding: 0.5rem 1rem;
  background: #1f1f2f;
  border-bottom: 1px solid #444;
  min-height: 48px;
  box-sizing: border-box;
  position: sticky;
  top: 0;
  z-index: 10;
}
.logout-button {
  background-color: #ef4444;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  padding: 0.8rem 1.5rem;
  transition: background-color 0.2s;
}

.logout-button:hover {
  background-color: #b91c1c;
}

</style>
