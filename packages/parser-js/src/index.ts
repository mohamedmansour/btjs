import { findValueByDottedPath, parseExpression, safeEvaluateExpression } from '@btjs/eval-js'

import type { BuildTimeRenderingProtocol } from '@btjs/protocol-js'

export interface ServerHandler {
  write: (value: string) => void
  end: () => void
}

export function handleBTR(protocol: BuildTimeRenderingProtocol, state: Object, serverHandler: ServerHandler) {
  protocol.streams.forEach(stream => {
    switch (stream.type) {
      case 'raw': {
        serverHandler.write(stream.value)
        break
      }
      case 'repeat': {
        const value = findValueByDottedPath(stream.value, state)
        if (value) {
          value.forEach((item: any) => {
            serverHandler.write(`<${stream.template}><template shadowrootmode="open">`)
            if (protocol.templates[stream.template].style) {
              serverHandler.write(`<style>${protocol.templates[stream.template].style}</style>`)
            }
            serverHandler.write(`${protocol.templates[stream.template].template}</template>`)
            const itemType = typeof item
            if (itemType === 'string' || itemType === 'number' || itemType === 'boolean' || Array.isArray(item)) {
              serverHandler.write(String(item))
            } else if (itemType === 'object') {
              Object.keys(item).forEach((key) => {
                serverHandler.write(`<span slot="${key}">${item[key]}</span>`)
              })
            }
            serverHandler.write(`</${stream.template}>`)
          })
        }
        break
      }
      case 'signal': {
        const value = findValueByDottedPath(stream.value, state)
        if (value !== undefined) {
          serverHandler.write('' + value)
        } else if (stream.defaultValue !== undefined) {
          serverHandler.write(stream.defaultValue)
        }
        break
      }
      case 'when': {
        const parts = parseExpression(stream.value)
        const value = safeEvaluateExpression(parts, state)
        if (!value) {
          serverHandler.write('style="display: none"')
        }
        break
      }
    }
  })
  serverHandler.end()
}
