<template>
  <figure class="app-layout" aria-label="Data Explorer interface layout">
    <div class="app-layout__shell">
      <div class="app-layout__region app-layout__header">
        <span class="app-layout__label">Header</span>
        <span class="app-layout__hint">Search bar · edit / read-only toggle</span>
        <div class="app-layout__mock app-layout__mock--search" aria-hidden="true" />
      </div>

      <div class="app-layout__body">
        <div class="app-layout__region app-layout__sidebar">
          <span class="app-layout__label">Sidebar</span>
          <span class="app-layout__hint">Dataclass list</span>
          <div class="app-layout__mock-list" aria-hidden="true">
            <span v-for="i in 5" :key="i" class="app-layout__mock-row" />
          </div>
        </div>

        <div class="app-layout__main">
          <div class="app-layout__region app-layout__tabs">
            <span class="app-layout__label">Tab bar</span>
            <div class="app-layout__mock-tabs" aria-hidden="true">
              <span class="app-layout__mock-tab app-layout__mock-tab--active" />
              <span class="app-layout__mock-tab" />
              <span class="app-layout__mock-tab" />
            </div>
          </div>

          <div class="app-layout__region app-layout__content">
            <span class="app-layout__label">Main content</span>
            <span class="app-layout__hint">Home · dataclass · Structure · Settings · tools</span>
            <div class="app-layout__mock-grid" aria-hidden="true">
              <span class="app-layout__mock-card" />
              <span class="app-layout__mock-card" />
              <span class="app-layout__mock-card" />
            </div>
          </div>
        </div>
      </div>

      <div class="app-layout__region app-layout__footer">
        <span class="app-layout__label">Footer</span>
        <span class="app-layout__hint">Version · assistant · palette · tools · theme</span>
        <div class="app-layout__mock-footer" aria-hidden="true">
          <span v-for="i in 8" :key="i" class="app-layout__mock-dot" />
        </div>
      </div>
    </div>
    <figcaption class="app-layout__caption">Four main areas — header, sidebar + content, and footer</figcaption>
  </figure>
</template>
