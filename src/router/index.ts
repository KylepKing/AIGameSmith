import { createRouter, createWebHistory } from 'vue-router'
import GameGeneratorView from '../views/GameGeneratorView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: GameGeneratorView,
    },

  ],
})

export default router

