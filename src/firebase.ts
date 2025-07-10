import { initializeApp } from 'firebase/app'
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "aigamesmith.firebaseapp.com",
  projectId: "aigamesmith",
  storageBucket: "aigamesmith.firebasestorage.app",
  messagingSenderId: "622327947786",
  appId: "1:622327947786:web:3caddcd04515934a5db5f3",
  measurementId: 'G-P5Z0WYFZWQ',
}


// Initialize Firebase
const app = initializeApp(firebaseConfig)
//const analytics = getAnalytics(app)

// Initialize the Gemini Developer API backend service
const ai = getAI(app, { backend: new GoogleAIBackend() })

// Create a `GenerativeModel` instance with a model that supports your use case
const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' })

export { model }
