import { existsSync, readFileSync, writeFile } from 'node:fs'
import { join } from 'node:path'

export class StateFile {
  #stateStorePath: string
  #state: Record<string, {}>

  constructor(public appPath: string, initialState: Record<string, {}>) {
    this.#stateStorePath = join(appPath, 'state.json')
    this.#state = initialState

    if (existsSync(this.#stateStorePath)) {
      try {
        this.#state = JSON.parse(readFileSync(this.#stateStorePath, 'utf8'))
      } catch (e) {
        console.error('Invalid database file')
      }
    }
  }

  store(state: Record<string, {}>) {
    this.#state = state
    writeFile(this.#stateStorePath, JSON.stringify(state), () => {})
  }

  get data(): any {
    return this.#state
  }

  flush() {
    writeFile(this.#stateStorePath, JSON.stringify(this.#state), () => {})
  }
}
