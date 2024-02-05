import type { FASTElement } from './fast-element.js'
export { observer } from './observer.js'

declare global {
  interface HTMLElement {
    [key: string]: any
  }
}

const PREFIX = 'f-'
const OPERATORS = new Set(['&&', '||', '!', '==', '>', '>=', '<', '<='])
const OPERATOR_REGEX = new RegExp(`(${Array.from(OPERATORS).map(op => op.replace(/\|/g, '\\|')).join('|')})`)

/**
 * Finds a value by a dotted path.
 *
 * @param part The dotted path to the value
 * @param component The component to search for the value.
 * @returns The value found at the dotted path.
 */
function FindValueByDottedPath(part: string, component: FASTElement) {
  let value
  if (isNaN(Number(part))) {
    const properties = part.split('.')
    value = component
    for (const property of properties) {
      value = value[property]
      if (value === undefined) {
        break
      }
    }
  } else {
    value = Number(part)
  }

  return value
}

function SetupSignalAttribute(component: FASTElement, signalValue: string, node: Element) {
  const [firstPart] = signalValue.split('.', 1)
  const signal = component[`$${firstPart}`]
  if (!signal) {
    throw new Error(`Signal ${signalValue} not found`)
  }

  let owningNode = node
  if (node.tagName === 'SLOT') {
    owningNode = (node as HTMLSlotElement).assignedNodes()[0] as HTMLSlotElement
  }

  signal.emit(owningNode.textContent?.trim())
  signal.on((_value: string | number) => {
    owningNode.textContent = FindValueByDottedPath(signalValue, component)
  })
}

function SetupClickAttribute(component: FASTElement, clickValue: string, node: Element) {
  if (!component[clickValue]) {
    throw new Error(`Method ${clickValue} not found`)
  }
  node.addEventListener('click', (e) => {
    component[clickValue](e)
  })
}

function SetupWhenAttribute(component: FASTElement, whenValue: string, node: Element) {
  // Split the expression into parts
  const parts = whenValue.split(OPERATOR_REGEX).filter(part => part.length).map(part => part.trim())

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
    let value = evaluateExpression(parts, component)
    ;(node as HTMLElement).style.display = value ? 'block' : 'none'
  }

  updateDisplay()
}

function evaluateExpression(parts: string[], component: FASTElement): boolean {
  let value: any = true
  let operator: string | null = null

  // Evaluate the expression. The only expression supported would be left, operator, right. And can happen
  // multiple times. Parenthesis are not supported.
  parts.forEach(part => {
    if (OPERATORS.has(part)) {
      operator = part
    } else {
      let partValue = FindValueByDottedPath(part, component)

      switch (operator) {
        case '&&':
          value = value && partValue
          break
        case '||':
          value = value || partValue
          break
        case '!':
          value = !partValue
          break
        case '==':
          value = value == partValue
          break
        case '>':
          value = value > partValue
          break
        case '>=':
          value = value >= partValue
          break
        case '<':
          value = value < partValue
          break
        case '<=':
          value = value <= partValue
          break
        default:
          value = partValue
      }

      operator = null
    }
  })

  return Boolean(value)
}

function SetupRepeatAttribute(component: HTMLElement, repeatValue: string, node: Element) {
  const signal = component[`$${repeatValue}`]
  if (!signal) {
    throw new Error(`Signal ${repeatValue} not found`)
  }

  // Store existing children as items to the repeat signal. The assumption here is that the children
  // can only have strings as their content for now. This could be improved to support objects with slots.
  const items: any = []
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]
    items.push(child.textContent?.trim())
  }

  const componentTag = node.getAttribute(`w-component`)
  signal.emit(items)
  signal.on((values: string[]) => {
    // Update some sort of key-based reconcilation strategy. To assign a unique key to each node and using
    // these keys to match nodes between the old and new state.
    node.innerHTML = ''
    const fragment = document.createDocumentFragment()
    values.forEach((value) => {
      const newNode = document.createElement(componentTag!)
      if (typeof value === 'string') {
        newNode.appendChild(document.createTextNode(value))
      }
      // TODO: Add support for objects with slots.
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
        case 'click': {
          SetupClickAttribute(component, attr.value, node)
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
        default:
          console.warn(`Attribute ${key} not found`)
      }
    }
  })
}

export function hydrate(component: FASTElement) {
  // Handle the component itself.
  SetupAttributes(component, component)

  // Handle the component's children.
  const owner = component.shadowRoot || component
  const nodes = owner.querySelectorAll('*')
  nodes.forEach((node) => {
    if (customElements.get(node.tagName.toLowerCase())) {
      return
    }
    SetupAttributes(component, node)
  })
}
