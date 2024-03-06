import { html } from '@internal/fast-element'

export default html`
  <app-button appearance="secondary" f-onclick="onRemove">remove</app-button>
  <span>
    <slot f-signal="name" f-onclick="onRename"></slot>
  </span>
`
