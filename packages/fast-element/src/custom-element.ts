type ConstructableHTMLElement = {
  new(...args: any[]): HTMLElement,
}

interface FASTElementDefinition {
  name: string
  template?: string
  styles?: string
  module?: boolean
}

const hydratedComponents = new Map<string, string>((window.btr || []).map(key => [key, '']))
const componentCache = new Map<string, HTMLTemplateElement>()
const mainEntryPoint = document.getElementById('main-entry')!

function cacheTemplate(name: string, html: string, isModule: boolean = true, appendToBody = true) {
  const template = document.createElement('template')
  template.innerHTML = html
  template.id = name
  template.setAttribute('module', String(isModule))
  if (appendToBody) {
    template.className = 'internal-html-module'
    mainEntryPoint.parentNode!.insertBefore(template, mainEntryPoint)
  }
  componentCache.set(name, template)
}

/**
 * Import the module as a <template> element. When the customElement is created, it will
 * use the template to render the shadowRoot.
 */
function importModule(definition: FASTElementDefinition): Promise<void> {
  // Already in the component in cache, no need to fetch it again.
  if (componentCache.has(definition.name)) {
    return Promise.resolve()
  }

  // When the BTR Build Process already discovered the component, we don't need to fetch it again.
  if (hydratedComponents.has(definition.name)) {
    return Promise.resolve()
  }

  // Not a module, just a template. When exists, assume that is the component. Used for repeats.
  const templateTag = document.getElementById(definition.name) as HTMLTemplateElement
  if (templateTag) {
    componentCache.set(definition.name, templateTag)
    definition.module = templateTag.getAttribute('module') === 'true'
    return Promise.resolve()
  }

  // Not a module, just a template and styles.
  if (!definition.module) {
    if (!definition.template && !definition.styles) {
      return Promise.reject('No template or styles provided')
    }

    cacheTemplate(definition.name, `<style>${definition.styles}</style>${definition.template}`, definition.module)
    return Promise.resolve()
  }

  // Module, fetch the HTML and CSS.
  return new Promise<void>((resolve, reject) => {
    const moduleHtml = `./${definition.name}.html`
    const moduleCss = `./${definition.name}.css`

    fetch(moduleHtml)
      .then(response => response.text())
      .then(html => {
        cacheTemplate(definition.name, `<link rel="stylesheet" href="${moduleCss}">${html}`, definition.module)
        resolve()
      })
      .catch(error => {
        console.error(`Failed to load HTML module: ${error}`)
        reject(error)
      })
  })
}

export function customElement(definition: FASTElementDefinition) {
  if (definition.module === undefined) {
    definition.module = true
  }

  return function(type: ConstructableHTMLElement) {
    class NewConstructor extends type {
      module: string | undefined = definition.module ? definition.name : undefined
      constructor(...args: any[]) {
        super(...args)
        if (!this.shadowRoot) {
          const shadowRoot = this.attachShadow({ mode: 'open' })
          shadowRoot.appendChild(componentCache.get(definition.name)!.content.cloneNode(true))
        } else if (!componentCache.has(definition.name)) {
          cacheTemplate(definition.name, this.shadowRoot!.innerHTML, definition.module, false)
        }
      }
    }

    importModule(definition).then(() => {
      customElements.define(definition.name, NewConstructor)
    })
  }
}
