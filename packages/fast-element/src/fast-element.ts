import { hydrate } from './hydrate.js'

let viewIdTracker = 0

export abstract class FASTElement extends HTMLElement {
  public viewId: number = ++viewIdTracker

  connectedCallback() {
    hydrate(this)
  }
}
