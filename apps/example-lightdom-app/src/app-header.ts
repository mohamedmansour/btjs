import { FASTElement, customElement, html, observer } from '@internal/fast-element'

const template = html`
  <h2 f-signal="appTitle" f-click="onChangeTitle">
    Demo!
  </h2>
`

@customElement({ name: 'app-header', template })
export class AppHeaderElement extends FASTElement {
  @observer
  public appTitle: string | undefined

  onChangeTitle() {
    this.appTitle = 'Demo time!'
  }
}
