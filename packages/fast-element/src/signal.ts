/**
 * A new way of representing a state.
 */
export class Signal<T> {
  private _listeners: Set<(value: T) => void> = new Set()
  public value: T | undefined
  emit(value: T): void {
    this.value = value
    for (const listener of Array.from(this._listeners)) {
      listener(value)
    }
  }
  on(callback: (value: T) => void): void {
    this._listeners.add(callback)
  }
  off(callback: (value: T) => void): void {
    this._listeners.delete(callback)
  }
  get size(): number {
    return this._listeners.size
  }
}
