import type {
  BuildTimeRenderingProtocol,
  BuildTimeRenderingStream,
  BuildTimeRenderingStreamTemplateRecords,
} from '@btjs/protocol-js'
import express from 'express'
import { existsSync, readFile, writeFile } from 'node:fs'
import { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { extractHTML } from './extract.js'

interface BuildOptions {
  port: number
  useLinkCss: boolean
}

export function HandleBuild(appPath: string, options: BuildOptions) {
  appPath = resolve(process.env['INIT_CWD'] || process.cwd(), appPath)
  if (!existsSync(appPath)) {
    console.error('App not found:', appPath)
    process.exit(1)
  }

  const app = express()
  app.use(express.static(appPath))

  let streamResponses: BuildTimeRenderingStream[] = []
  let streamTemplates: BuildTimeRenderingStreamTemplateRecords = {}
  let headChunkIndex = 0

  const server = app.listen(async () => {
    console.log('preparing browser')

    const browser = await chromium.launch({
      channel: 'msedge',
    })
    const page = await browser.newPage()

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('ERROR:', msg.text())
      } else {
        console.log('LOG:', msg.text())
      }
    })

    console.log('visiting app')
    const address = server.address() as AddressInfo
    await page.goto(`http://localhost:${address.port}`)

    await page.exposeFunction('readFile', (path: string) => {
      return new Promise((resolve, reject) => {
        readFile(join(appPath, path), 'utf8', (err, data) => {
          if (err) {
            reject('Error reading file:' + err)
          } else {
            const content = data.trim()
            if (!content || content.length === 0) {
              resolve([])
            } else {
              resolve(content.split('\n'))
            }
          }
        })
      })
    })

    await page.exposeFunction('writeStreamResponse', (type: string, value: string, extra: string) => {
      if (type === 'repeat') {
        streamResponses.push({ type, value, template: extra })
      } else if (type === 'signal') {
        streamResponses.push({ type, value, defaultValue: extra })
      } else if (type === 'raw') {
        streamResponses.push({ type, value })
      } else if (type === 'when') {
        streamResponses.push({ type, value })
      } else {
        console.error('Unknown stream type:', type)
      }

      if (value.indexOf('</head>') !== -1) {
        headChunkIndex = streamResponses.length
      }
    })

    await page.exposeFunction('writePreload', (type: string, value: string[], lines: string[]) => {
      if (value.length === 0) {
        return lines
      }

      const preloadCss: string[] = []
      value.forEach((path) => preloadCss.push(`<link rel="preload" href="${path}" as="style">`))

      if (type === 'css') {
        const headChunkValue = streamResponses[headChunkIndex - 1].value
        const headIndex = headChunkValue.indexOf('</head>')
        if (headIndex === -1) {
          console.error('Head tag not found which is a requirement for preload css')
          return
        }

        streamResponses[headChunkIndex - 1].value = headChunkValue.slice(0, headIndex) + preloadCss.join('\n  ') +
          '\n' +
          headChunkValue.slice(headIndex)
      }

      // Update the debugging file.
      const lineIndex = lines.findIndex((line) => {
        return line.indexOf('</head>') !== -1
      })

      if (lineIndex !== -1) {
        const line = lines[lineIndex]
        const headIndex = line.indexOf('</head>')
        lines[lineIndex] = line.slice(0, headIndex) + preloadCss.join('\n  ') + '\n' + line.slice(headIndex)
      } else {
        console.error('Head tag not found which is a requirement for preload css')
      }

      return lines
    })

    await page.exposeFunction('writeTemplates', (templates: string) => {
      streamTemplates = JSON.parse(templates) as BuildTimeRenderingStreamTemplateRecords
    })

    console.log('dumping stream')
    try {
      const htmlLines = await page.evaluate(extractHTML, options)
      writeFile(join(appPath, 'index.debug.html'), htmlLines.join('\n'), (err) => {
        if (err) {
          console.error('Error writing debug file:', err)
        }
      })
    } catch (e) {
      console.error('Error extracting HTML:', e)
    }

    const streamProtocol: BuildTimeRenderingProtocol = {
      streams: streamResponses,
      templates: streamTemplates,
    }

    writeFile(join(appPath, 'index.streams.json'), JSON.stringify(streamProtocol, null, 2), (err) => {
      if (err) {
        console.error('Error writing streams file:', err)
      }
    })

    console.log('stream partials:', streamResponses.length)
    console.log('closing')
    await browser.close()
    server.close()
  })
}