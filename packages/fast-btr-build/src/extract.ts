import type { BuildTimeRenderingStreamTemplateRecords } from '@internal/fast-btr-protocol'

declare global {
  interface Window {
    readFile: (path: string) => Promise<string[]>
    writeStreamResponse: (type: string, value: string, extra?: string) => void
    writeTemplates: (value: string) => void
  }

  interface HTMLElement {
    internalCssModule?: string
  }
}

export async function extractHTML(selector: string = 'html') {
  const lines: string[] = []
  let streamResponse: string[] = []
  const prefix = 'f-'
  const cssCache = new Map()
  const templateCache: BuildTimeRenderingStreamTemplateRecords = {}

  /**
   * Reads the contents of a CSS file from the file system. Caches the result.
   * @param {string} path - The path to the CSS file.
   */
  async function readCSS(path: string) {
    if (cssCache.has(path)) {
      return cssCache.get(path)
    }

    const contents = await window.readFile(path)
    cssCache.set(path, contents)
    return contents
  }

  function addLine(line: string | undefined = undefined, indent = '') {
    if (!line) return
    lines.push(indent + line)
    streamResponse.push(indent + line)
  }

  function flushPlainResponse() {
    const streamContent = streamResponse.join('\n')
    streamResponse = []
    window.writeStreamResponse('raw', streamContent)
  }

  function flushStreamResponse(type: string, value: string, defaultValue?: string) {
    flushPlainResponse()
    window.writeStreamResponse(type, value, defaultValue?.trim())
  }

  function processWhenHint(name: string, node: HTMLElement) {
    // If the node has a `when` hint, clear the style attribute since it will be set by the protocol.
    if (name === (prefix + 'when')) {
      node.style.display = ''
      if (node.style.cssText === '') {
        node.removeAttribute('style')
      }
    }
  }

  async function processRepeatHint(name: string, node: HTMLElement) {
    // Special treatment for repeat hints, we need to extract the template and the style.
    // This is needed since css modules are not declarative. https://github.com/WICG/webcomponents/issues/939
    if (name === (prefix + 'repeat')) {
      const tag = node.getAttribute('w-component')
      if (tag && !templateCache[tag]) {
        const repeatNode = document.createElement(tag)

        // Add it to the body so the shadowroot is created.
        document.body.appendChild(repeatNode)

        const lines = []
        const templateNode = repeatNode.shadowRoot ? repeatNode.shadowRoot : repeatNode
        const callback = {
          addLine: (line: string) => {
            if (!line || !line.trim()) return
            lines.push(line)
          },
          flushPlainResponse: () => {},
          flushStreamResponse: () => {},
        }

        for (const child of Array.from(templateNode.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            await visitNode(child as HTMLElement, callback, '  ')
          } else {
            lines.push(child.textContent?.trim())
          }
        }

        let style = ''
        if (repeatNode.internalCssModule) {
          const cssContents = await readCSS(repeatNode.internalCssModule)
          style = cssContents.join('\n')
        } else {
          console.error('No CSS Module found for', tag)
        }

        templateCache[tag] = {
          template: lines.join('\n'),
          style,
        }

        return tag
      }
    }
    return undefined
  }

  interface VisitCall {
    addLine: (line: string | undefined, indent: string) => void
    flushPlainResponse: () => void
    flushStreamResponse: (type: string, value: string, defaultValue?: string) => void
  }

  /**
   * Visits a node and its children, printing the HTML representation of the node and its children.
   *
   * @param {HTMLElement} node - The node to visit
   * @param {string} indent - The current indentation level
   * @returns
   */
  async function visitNode(node: HTMLElement, callback: VisitCall, indent = '') {
    let tag = '<' + node.nodeName.toLowerCase()

    // Print attributes
    const attributeFastMap = new Map()
    let repeatTemplate = undefined

    for (let i = 0; i < node.attributes.length; i++) {
      const name = node.attributes[i].name
      const value = node.attributes[i].value
      tag += ' ' + name + '="' + value + '"'

      if (name.startsWith(prefix)) {
        repeatTemplate = await processRepeatHint(name, node)
        processWhenHint(name, node)
        attributeFastMap.set(name, value)
      }
    }

    // For `when` hints, stream the protocol so that caller can set the style attribute.
    if (attributeFastMap.has(prefix + 'when')) {
      callback.addLine(tag, indent)
      callback.flushStreamResponse('when', attributeFastMap.get(prefix + 'when'))
      callback.addLine('>', indent)
    } else {
      callback.addLine(tag + '>', indent)
    }

    let tagContent = undefined

    // Print text content if it's a leaf node
    if (node.children.length === 0 && node.textContent?.trim() !== '') {
      tagContent = indent + ' ' + node.textContent!.trim()
    }

    // Stream Response construction.
    if (attributeFastMap.has(prefix + 'repeat')) {
      callback.flushStreamResponse('repeat', attributeFastMap.get(prefix + 'repeat'), repeatTemplate)
      callback.addLine(tagContent)
    } else if (attributeFastMap.has(prefix + 'signal')) {
      callback.flushStreamResponse('signal', attributeFastMap.get(prefix + 'signal'), tagContent)
    }

    // For non signal parent nodes, we need to recurse on children.
    // Signal nodes are not recursed since the core assumption is that they are leaf nodes.
    if (!attributeFastMap.has(prefix + 'signal')) {
      // Recurse on shadow root children
      if (node.shadowRoot) {
        callback.addLine('<template shadowrootmode="open">', indent + '  ')
        if (node.internalCssModule) {
          // That is the best we can to eliminate flickering, by placing the contents of the CSS module in component.
          let cssContents = await readCSS(node.internalCssModule)
          if (cssContents && cssContents.length > 0) {
            callback.addLine(
              `<style>\n${cssContents.map((line: string) => indent + '    ' + line.trim()).join('\n')}</style>`,
              indent + '    ',
            )
          }

          // TODO: Doesn't work in Web Platform Yet.
          // addLine(indent + '  <script type="module">import sheet from "' + node.internalCssModule + '" assert { type: "css" };console.log(this);</script>');
        }

        for (const child of Array.from(node.shadowRoot!.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            await visitNode(child as HTMLElement, callback, indent + '    ')
          } else {
            callback.addLine(child.textContent?.trim(), indent + '    ')
          }
        }
        callback.addLine('</template>', indent + '  ')
      }

      // Recurse on normal children
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          await visitNode(child as HTMLElement, callback, indent + '  ')
        } else {
          callback.addLine(child.textContent?.trim(), indent + '  ')
        }
      }

      // If the node is a <template>, recurse on its content. Web Components that have an open shadowroot will not
      // have a <template> tag, so we don't need to worry about that case.
      if (node.nodeName.toLowerCase() === 'template') {
        for (const child of Array.from((node as HTMLTemplateElement).content.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            await visitNode(child as HTMLElement, callback, indent + '  ')
          } else {
            callback.addLine(child.textContent?.trim(), indent + '  ')
          }
        }
      }
    }

    // Print closing tag
    callback.addLine('</' + node.nodeName.toLowerCase() + '>', indent)

    return lines
  }

  const root = document.querySelector<HTMLElement>(selector)
  if (root) {
    await visitNode(root, { addLine, flushPlainResponse, flushStreamResponse })
  }

  flushPlainResponse()

  window.writeTemplates(JSON.stringify(templateCache, null, 2))

  return lines
}
