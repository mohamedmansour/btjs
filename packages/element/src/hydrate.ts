import { OPERATORS, findValueByDottedPath, parseExpression, safeEvaluateExpression } from '@btjs/eval-js'
import type { FASTElement } from './fast-element.js'
export { observer } from './observer.js'

declare global {
  interface HTMLElement {
    [key: string]: any
  }
  interface Window {
    btr: string[]
  }
}

const PREFIX = 'f-'

function SetupSignalAttribute(component: FASTElement, signalValue: string, node: Element) {
  const signalValueSplits = signalValue.split('.')
  const firstPart = signalValueSplits[0]
  const signal = component[`$${firstPart}`]
  if (!signal) {
    throw new Error(`Signal ${signalValue} not found`)
  }

  let owningNode = node
  if (node.tagName === 'SLOT') {
    owningNode = (node as HTMLSlotElement).assignedNodes()[0] as HTMLSlotElement
  }

  if (!owningNode) {
    throw new Error(`No nodes are currently projected into the slot: ${node.outerHTML}`)
  }

  // For now we don't support hydrating objects, only strings and numbers.
  // This could be improved to support objects with slots.
  if (signalValueSplits.length === 1) {
    // Make sure emitting the contents of the node if any nodes exists, including text nodes.
    if (signal.value === undefined || (owningNode.nodeType === Node.ELEMENT_NODE && owningNode.childNodes.length > 0)) {
      let value = owningNode.textContent?.trim()
      if (typeof signal.value === 'string') {
        signal.emit(value)
      } else if (typeof signal.value === 'number') {
        signal.emit(Number(value))
      } else if (signal.value) {
        throw new Error(
          `TODO: Signal ${signalValue} is not a string or number, current signal value "${signal.value}", dom value: ${value}`,
        )
      } else {
        // Emit the value of the node if the signal has no value.
        // TODO: This could be improved if the signal has type information so we can infer what time to decode.
        signal.emit(value)
      }
    } else if (signal.value !== undefined) {
      // Update display for the initial value of the signal.
      owningNode.textContent = signal.value
    }
  }

  signal.on((_value: string | number) => {
    owningNode.textContent = findValueByDottedPath(signalValue, component)
  })
}

function SetupEventAttribute(component: FASTElement, eventValue: string, node: Element, eventName: string) {
  if (!component[eventValue]) {
    throw new Error(`Event Method ${eventValue} not found`)
  }
  node.addEventListener(eventName, (e) => {
    component[eventValue](e)
  })
}

function SetupRefAttribute(component: FASTElement, refValue: string, node: Element) {
  component[refValue] = node
}

function SetupWhenAttribute(component: FASTElement, whenValue: string, node: Element) {
  // Split the expression into parts
  const parts = parseExpression(whenValue)

  // Listen for signal changes to each part.
  parts.forEach(part => {
    if (!OPERATORS.has(part)) {
      // Only listen for signals on the first part of the dotted path.
      // This could be improved to listen for all parts if each part is a signal as well.
      const [firstPart] = part.split('.', 1)
      const signal = component[`$${firstPart}`]
      if (signal) {
        signal.on(() => {
          updateDisplay()
        })
      }
    }
  })

  function updateDisplay() {
    const value = safeEvaluateExpression(parts, component)
    const element = node as HTMLElement
    element.style.display = value ? 'block' : 'none'
  }

  updateDisplay()
}

function SetupRepeatAttribute(component: HTMLElement, repeatValue: string, node: Element) {
  const signal = component[`$${repeatValue}`]
  if (!signal) {
    throw new Error(`Signal ${repeatValue} not found`)
  }

  // Store existing children as items to the repeat signal. When the child has slots
  // the slots are stored as objects with the slot name as the key and the slot value as the value.
  const items: any = []
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    const slots = child.querySelectorAll<HTMLElement>('[slot]')
    if (slots.length > 0) {
      const slotObject: { [key: string]: string } = {}
      slots.forEach((slot: HTMLElement) => {
        const slotName = slot.slot!
        const slotValue = slot.textContent?.trim()
        if (slotValue) {
          slotObject[slotName] = slotValue
        }
      })
      items.push(slotObject)
    } else {
      items.push(child.textContent?.trim())
    }
  }

  const componentTag = node.getAttribute(`w-component`)
  signal.emit(items)
  signal.on((values: any[]) => {
    // Update some sort of key-based reconcilation strategy. To assign a unique key to each node and using
    // these keys to match nodes between the old and new state.
    node.innerHTML = ''
    const fragment = document.createDocumentFragment()
    values.forEach((value) => {
      const newNode = document.createElement(componentTag!)
      const valueType = typeof value
      if (valueType === 'string' || valueType === 'number' || valueType === 'boolean' || Array.isArray(value)) {
        newNode.appendChild(document.createTextNode(String(value)))
      } else if (valueType === 'object') {
        Object.keys(value).forEach((key) => {
          const slot = document.createElement('span')
          slot.textContent = value[key]
          slot.slot = key
          newNode.appendChild(slot)
        })
      }
      fragment.appendChild(newNode)
    })
    node.appendChild(fragment)
  })
}

function SetupAttributes(component: FASTElement, node: Element) {
  Array.from(node.attributes).forEach((attr) => {
    if (attr.name.startsWith(PREFIX)) {
      const key = attr.name.substring(PREFIX.length)
      switch (key) {
        case 'signal': {
          SetupSignalAttribute(component, attr.value, node)
          break
        }
        case 'repeat': {
          SetupRepeatAttribute(component, attr.value, node)
          break
        }
        case 'when': {
          SetupWhenAttribute(component, attr.value, node)
          break
        }
        case 'ref': {
          SetupRefAttribute(component, attr.value, node)
          break
        }
        default: {
          if (key.startsWith('on')) {
            SetupEventAttribute(component, attr.value, node, key.substring(2).toLowerCase())
            break
          }

          console.warn(`Attribute ${key} not found`)
          break
        }
      }
    }
  })
}

export function hydrate(component: FASTElement) {
  // Handle the component's children.
  const owner = component.shadowRoot || component
  const nodes = owner.querySelectorAll('*')
  nodes.forEach((node) => {
    SetupAttributes(component, node)
  })
  component.hydrated = true
}
