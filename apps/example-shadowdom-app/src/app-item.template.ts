import { html } from '@internal/fast-element'

export default html`
  <app-button appearance="secondary" f-click="onRemove">remove</app-button>
  <span>
    <slot f-signal="name" f-click="onRename"></slot>
  </span>
`
