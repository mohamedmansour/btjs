import type { BuildTimeRenderingProtocol } from '@internal/fast-btr-protocol'

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
            serverHandler.write(`<${stream.template}>
                <template shadowrootmode="open">
                    <style>
                        ${protocol.templates[stream.template].style}
                    </style>
                    ${protocol.templates[stream.template].template}
                </template>
                ${item}
            </${stream.template}>`)
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
      }
    }
  })
  serverHandler.end()
}

const findValueByDottedPath = (part: string | number, state: Object) => {
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
