import { html } from '@internal/fast-element'

export default html`
  <h2 f-signal="appTitle" f-onclick="onChangeTitle" f-ref="headerElement">
    Demo!
  </h2>
`
