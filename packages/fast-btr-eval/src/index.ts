export const OPERATORS = new Set(['&&', '||', '!', '==', '>', '>=', '<', '<='])
const OPERATOR_REGEX = new RegExp(`(${Array.from(OPERATORS).map(op => op.replace(/\|/g, '\\|')).join('|')})`)

/**
 * Finds a value by a dotted path.
 *
 * @param part The dotted path to the value
 * @param component The component to search for the value.
 * @returns The value found at the dotted path.
 */
export function findValueByDottedPath(part: string | number, state: Object) {
  let value: any | undefined

  if (isNaN(Number(part))) {
    const properties = (part as string).split('.')
    value = state
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

export function parseExpression(expression: string) {
  return expression.split(OPERATOR_REGEX).filter(part => part.length).map(part => part.trim())
}

export function safeEvaluateExpression(expressionParts: string[], state: Object): boolean {
  let value: any = true
  let operator: string | null = null

  // Evaluate the expression. The only expression supported would be left, operator, right. And can happen
  // multiple times. Parenthesis are not supported.
  expressionParts.forEach(part => {
    if (OPERATORS.has(part)) {
      operator = part
    } else {
      let partValue = findValueByDottedPath(part, state)

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
