export function attr(target: HTMLElement, propertyKey: string) {
  Object.defineProperty(target, propertyKey, {
    get: function() {
      console.log('get', this, this.value, this.getAttribute(propertyKey))
      return this.getAttribute(propertyKey)
    },
    set: function(newValue: string) {
      console.log('set', this, this.value, this.getAttribute(propertyKey))
      const oldValue = this.getAttribute(propertyKey)
      this.setAttribute(propertyKey, newValue)
      if (this.hydrated && this[`${propertyKey}Changed`]) {
        this[`${propertyKey}Changed`](oldValue, newValue)
      }
    },
  })
}
