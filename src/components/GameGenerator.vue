<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps({
  responseCode: {
    type: String,
    required: true
  }
})

const showCode = ref(false)
const iframeRef = ref<HTMLIFrameElement>()
const gameCode = ref('')

// Watch for changes in responseCode to update iframe
watch(() => props.responseCode, async () => {
  gameCode.value = props.responseCode
  await nextTick()
  loadGame()
})

function loadGame() {
  if (!iframeRef.value) return

  const iframeDoc = iframeRef.value.contentWindow?.document
  if (!iframeDoc) return

  iframeDoc.open()
  iframeDoc.write(gameCode.value)
  iframeDoc.close()
}

function toggleCodeView() {
  showCode.value = !showCode.value
}

onMounted(() => {
  if (props.responseCode) {
    gameCode.value = props.responseCode
    loadGame()
  }
})
</script>

<template>
  <div class="game-container">
    <!-- Toggle Button -->
    <button class="code-toggle" @click="toggleCodeView">
      &lt;code&gt;
    </button>

    <!-- Game iframe, hidden when code view is shown -->
    <iframe ref="iframeRef" class="game-frame" :class="{ hidden: showCode }"></iframe>

    <!-- Code view overlay -->
    <div v-if="showCode" class="code-overlay">
      <button class="close-button" @click="toggleCodeView">Close & Resume Game</button>
      <pre><code>{{ gameCode }}</code></pre>
    </div>
  </div>
</template>

<style scoped>
.game-container {
  position: relative;
  margin-top: 2rem;
  border: 2px solid #555;
  border-radius: 10px;
  overflow: hidden;
  height: 600px;
}

/* iframe with full size */
.game-frame {
  width: 100%;
  height: 100%;
  border: none;
}

/* Clean hide class instead of setting style directly */
.hidden {
  display: none;
}

.code-toggle {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  background-color: #27272a;
  color: #fff;
  border: 1px solid #888;
  padding: 6px 12px;
  font-family: monospace;
  border-radius: 6px;
  cursor: pointer;
}

.code-toggle:hover {
  background-color: #444;
}

.code-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #0e0e0e;
  color: #fff;
  overflow: auto;
  z-index: 20;
  padding: 1rem;
  box-sizing: border-box;
  font-family: monospace;
}

.code-overlay pre {
  white-space: pre-wrap;
  word-break: break-word;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #1e293b;
  color: white;
  border: none;
  padding: 8px 12px;
  cursor: pointer;
  font-weight: bold;
  border-radius: 6px;
}

.close-button:hover {
  background-color: #334155;
}
</style>
