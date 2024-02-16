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
  const metalines = new Set()
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

  /**
   * Visits a node and its children, printing the HTML representation of the node and its children.
   *
   * @param {HTMLElement} node - The node to visit
   * @param {string} indent - The current indentation level
   * @returns
   */
  async function visitNode(node: HTMLElement, indent = '') {
    let tag = '<' + node.nodeName.toLowerCase()

    // Print attributes
    const attributeFastMap = new Map()
    let repeatTemplate = undefined

    for (let i = 0; i < node.attributes.length; i++) {
      const name = node.attributes[i].name
      const value = node.attributes[i].value
      tag += ' ' + name + '="' + value + '"'

      if (name.startsWith(prefix)) {
        // Special treatment for repeat hints, we need to extract the template and the style.
        // This is needed since css modules are not declarative. https://github.com/WICG/webcomponents/issues/939
        if (name === (prefix + 'repeat')) {
          const tag = node.getAttribute('w-component')
          if (tag && !templateCache[tag]) {
            const repeatNode = document.createElement(tag)
            if (repeatNode.internalCssModule) {
              let cssContents = await readCSS(repeatNode.internalCssModule)
              repeatTemplate = {
                tag,
                template: repeatNode.shadowRoot ? repeatNode.shadowRoot.innerHTML : repeatNode.innerHTML,
                style: cssContents.join('\n'),
              }
            } else {
              console.error('No CSS Module found for', tag)
            }
          }
        }
        attributeFastMap.set(name, value)
      }
    }

    tag += '>'

    addLine(tag, indent)

    let tagContent = undefined

    // Print text content if it's a leaf node
    if (node.children.length === 0 && node.textContent?.trim() !== '') {
      tagContent = indent + ' ' + node.textContent!.trim()
    }

    // Stream Response construction.
    if (attributeFastMap.has(prefix + 'repeat')) {
      templateCache[repeatTemplate!.tag] = {
        template: repeatTemplate!.template,
        style: repeatTemplate!.style,
      }
      flushStreamResponse('repeat', attributeFastMap.get(prefix + 'repeat'), repeatTemplate!.tag)
      addLine(tagContent)
    } else if (attributeFastMap.has(prefix + 'signal')) {
      flushStreamResponse('signal', attributeFastMap.get(prefix + 'signal'), tagContent)
    }

    // For non signal parent nodes, we need to recurse on children.
    // Signal nodes are not recursed since the core assumption is that they are leaf nodes.
    if (!attributeFastMap.has(prefix + 'signal')) {
      // Recurse on shadow root children
      if (node.shadowRoot) {
        // Keep track of the CSS modules in case we need it later.
        metalines.add(node.internalCssModule)
        addLine('<template shadowrootmode="open">', indent + '  ')
        if (node.internalCssModule) {
          // That is the best we can to eliminate flickering, by placing the contents of the CSS module in component.
          let cssContents = await readCSS(node.internalCssModule)
          if (cssContents && cssContents.length > 0) {
            addLine(
              `<style>\n${cssContents.map((line: string) => indent + '    ' + line.trim()).join('\n')}</style>`,
              indent + '    ',
            )
          }

          // TODO: Doesn't work in Web Platform Yet.
          // addLine(indent + '  <script type="module">import sheet from "' + node.internalCssModule + '" assert { type: "css" };console.log(this);</script>');
        }

        for (const child of Array.from(node.shadowRoot!.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            await visitNode(child as HTMLElement, indent + '    ')
          } else {
            addLine(child.textContent?.trim(), indent + '    ')
          }
        }
        addLine('</template>', indent + '  ')
      }

      // Recurse on normal children
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          await visitNode(child as HTMLElement, indent + '  ')
        } else {
          addLine(child.textContent?.trim(), indent + '  ')
        }
      }

      // If the node is a <template>, recurse on its content. Web Components that have an open shadowroot will not
      // have a <template> tag, so we don't need to worry about that case.
      if (node.nodeName.toLowerCase() === 'template') {
        for (const child of Array.from((node as HTMLTemplateElement).content.childNodes)) {
          if (child.nodeType === Node.ELEMENT_NODE) {
            await visitNode(child as HTMLElement, indent + '  ')
          } else {
            addLine(child.textContent?.trim(), indent + '  ')
          }
        }
      }
    }

    // Print closing tag
    addLine('</' + node.nodeName.toLowerCase() + '>', indent)

    return lines
  }

  const root = document.querySelector<HTMLElement>(selector)
  if (root) {
    await visitNode(root)
  }

  // TODO: Doesn't work in Web Platform Yet.
  // metalines.forEach((line) => {
  //   const link = `<link as="style" rel="modulepreload" href="${line}">`;
  //   lines.unshift(link);
  // });

  flushPlainResponse()

  window.writeTemplates(JSON.stringify(templateCache, null, 2))

  return lines
}
