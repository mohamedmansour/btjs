import { html } from '@internal/fast-element'

export default html`
  <button f-click="onRemove">remove</button>
  <span>
    <slot f-signal="name" f-click="onRename"></slot>
  </span>
`
