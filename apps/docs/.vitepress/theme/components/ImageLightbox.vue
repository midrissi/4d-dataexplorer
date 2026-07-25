<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { closeLightbox, lightboxState } from '../composables/useImageLightbox'

const closeButton = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent): void {
  if (!lightboxState.open) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeLightbox()
  }
}

watch(
  () => lightboxState.open,
  async (open) => {
    document.body.style.overflow = open ? 'hidden' : ''
    if (open) {
      await nextTick()
      closeButton.value?.focus()
    }
  }
)

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="image-lightbox">
      <div
        v-if="lightboxState.open"
        class="image-lightbox"
        role="dialog"
        aria-modal="true"
        :aria-label="lightboxState.alt || 'Enlarged screenshot'"
        @click.self="closeLightbox"
      >
        <button
          ref="closeButton"
          type="button"
          class="image-lightbox__close"
          aria-label="Close fullscreen view"
          @click="closeLightbox"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M18 6L6 18M6 6l12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <figure class="image-lightbox__figure">
          <img
            class="image-lightbox__img"
            :src="lightboxState.src"
            :alt="lightboxState.alt"
            @click.stop
          />
          <figcaption v-if="lightboxState.alt" class="image-lightbox__caption">
            {{ lightboxState.alt }}
          </figcaption>
        </figure>
      </div>
    </Transition>
  </Teleport>
</template>
