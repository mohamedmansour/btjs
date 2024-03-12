import { Signal } from './signal.js'

/**
 * Creates a decorator of @observer that can be used to observe changes to a property within a class.
 *
 * @param target - The HTMLElement to bind the observer to.
 * @param propertyKey - The name of the property to observe
 */
export function observer<T>(target: HTMLElement, propertyKey: any): any {
  const signalKey = Symbol(propertyKey)

  if (delete target[propertyKey]) {
    Object.defineProperty(target, propertyKey, {
      get: function() {
        if (!this[signalKey]) {
          this[signalKey] = new Signal<T>()
        }
        return this[signalKey]?.value
      },
      set: function(newVal: T) {
        if (!this[signalKey]) {
          this[signalKey] = new Signal<T>()
        }
        this[signalKey].emit(newVal)
        if (this.hydrated && this[`${propertyKey}Changed`]) {
          this[`${propertyKey}Changed`].call(this, newVal)
        }
      },
      enumerable: true,
      configurable: true,
    })
  }

  Object.defineProperty(target, `$${String(propertyKey)}`, {
    get: function() {
      if (!this[signalKey]) {
        this[signalKey] = new Signal<T>()
      }
      return this[signalKey]
    },
    enumerable: false,
    configurable: false,
  })
}
