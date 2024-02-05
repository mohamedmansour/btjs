import { handleBTR } from '@internal/fast-btr-parser-js'
import type { BuildTimeRenderingProtocol } from '@internal/fast-btr-protocol'
import express from 'express'
import { existsSync, readFileSync, writeFile } from 'node:fs'
import { join, resolve } from 'node:path'

export function HandleServe(appPath: string, port: number) {
  appPath = resolve(process.env['INIT_CWD'] || process.cwd(), appPath)

  const itemsDbPath = join(appPath, 'items.json')
  const indexStreamsPath = join(appPath, 'index.streams.json')

  const app = express()
  app.use(express.json())

  let streamingProtocol: BuildTimeRenderingProtocol | undefined
  if (existsSync(indexStreamsPath)) {
    streamingProtocol = JSON.parse(readFileSync(indexStreamsPath, 'utf8')) as BuildTimeRenderingProtocol
  }

  app.post('/api/items', (req, res) => {
    res.status(201).json(req.body)
    writeFile(itemsDbPath, JSON.stringify(req.body), () => {})
  })

  app.get('/', (_req, res) => {
    let items = []
    if (existsSync(itemsDbPath)) {
      items = JSON.parse(readFileSync(itemsDbPath, 'utf8'))
    }

    const state = {
      items,
      appTitle: 'Welcome SSR!',
    }

    if (!streamingProtocol) {
      res.sendStatus(500)
      res.send({ error: 'No streaming protocol found' })
      return
    }

    handleBTR(streamingProtocol, state, res)
  })

  app.use(express.static(appPath))

  app.listen(port, async () => {
    console.log(`BTR Server is listening on port http://localhost:${port}`)
  })
}
