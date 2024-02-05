import { FASTElement, customElement, observer } from '@internal/fast-element'

@customElement({ name: 'app-shell' })
export class AppElement extends FASTElement {
  @observer
  toast: string | null = null

  @observer
  items: string[] = []

  private toastId = 0
  private itemId = 0

  connectedCallback(): void {
    performance.mark('start-hydration')
    super.connectedCallback()
    performance.mark('end-hydration')
    performance.measure('hydration', 'start-hydration', 'end-hydration')

    this.addEventListener('item-removed', (event: Event) => {
      const customEvent = event as CustomEvent<string>
      this.setToast(`${customEvent.detail} removed`)
      this.setItems(this.items.filter((item) => item !== customEvent.detail))
    })

    this.addEventListener('item-renamed', (event: any) => {
      const index = Array.from(event.detail.target.parentNode.children).indexOf(event.detail.target)
      this.setToast(null)
      this.setItems([...this.items.slice(0, index), event.detail.textContent, ...this.items.slice(index + 1)])
    })
  }

  onClick(_e: Event) {
    this.setItems([...this.items, `Item ${++this.itemId}`])
    this.setToast(`Item ${this.itemId} added`)
  }

  onClear(_e: Event) {
    this.setItems([])
    this.setToast('Items cleared')
  }

  setItems(items: string[]) {
    this.items = items
  }

  setToast(msg: string | null) {
    this.toast = msg
    if (msg) {
      clearTimeout(this.toastId)
      this.toastId = window.setTimeout(() => {
        this.toast = null
      }, 2000)
    }
  }
}
