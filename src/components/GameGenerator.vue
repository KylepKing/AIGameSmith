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
  iframeDoc.write('')
  iframeDoc.write(gameCode.value)
  iframeDoc.close()
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
    <!-- Game iframe, hidden when code view is shown -->
    <iframe ref="iframeRef" class="game-frame" :class="{ hidden: showCode }"></iframe>
  </div>
</template>

<style scoped>
.game-container {
  position: relative;
  margin-top: 2rem;
  border: 2px solid #555;
  border-radius: 10px;
  overflow: hidden;
  width: 800px;
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


</style>
