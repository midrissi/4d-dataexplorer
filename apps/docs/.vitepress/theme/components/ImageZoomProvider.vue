<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { openLightbox } from '../composables/useImageLightbox'
import ImageLightbox from './ImageLightbox.vue'

function isZoomableImage(img: HTMLImageElement): boolean {
  if (img.closest('.VPNav, .VPSidebar, .VPLocalNav')) return false
  if (img.hasAttribute('data-zoomable')) return true
  return Boolean(img.closest('.vp-doc, .screenshot-frame, .VPHero, .VPHome, .doc-screenshot'))
}

function resolveImageSrc(img: HTMLImageElement): string {
  return img.currentSrc || img.src
}

function handleImageClick(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Element)) return

  const frameButton = target.closest('.screenshot-frame__zoom')
  if (frameButton) {
    const img = frameButton.querySelector('img')
    if (img instanceof HTMLImageElement) {
      event.preventDefault()
      openLightbox(resolveImageSrc(img), img.alt)
    }
    return
  }

  const img = target.closest('img')
  if (!(img instanceof HTMLImageElement) || !isZoomableImage(img)) return

  event.preventDefault()
  openLightbox(resolveImageSrc(img), img.alt)
}

onMounted(() => {
  document.addEventListener('click', handleImageClick, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleImageClick, true)
})
</script>

<template>
  <ImageLightbox />
</template>
