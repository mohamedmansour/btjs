import { hydrate } from './hydrate.js'

let viewIdTracker = 0

export abstract class FASTElement extends HTMLElement {
  public viewId: number = ++viewIdTracker
  public hydrated = false

  connectedCallback() {
    hydrate(this)
  }
}
