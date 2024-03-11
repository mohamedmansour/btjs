import { BTRServer } from '@internal/fast-btr-server-js'
import { existsSync, readFileSync, writeFile } from 'node:fs'
import { join, resolve } from 'node:path'

export function HandleServe(appPath: string, port: number) {
  appPath = resolve(process.env['INIT_CWD'] || process.cwd(), appPath)

  const dbPath = join(appPath, 'db.json')
  const server = new BTRServer(appPath, port)

  // Default State.
  let db: Record<string, {}> = {
    items: [],
    appTitle: 'Welcome Build Time Rendering (BTR)!',
  }

  // Check if state exists and load it.
  if (existsSync(dbPath)) {
    db = JSON.parse(readFileSync(dbPath, 'utf8'))
  }

  // Create API endpoint to handle POST requests.
  server.app.post('/api/items', (req, res) => {
    res.status(201).json(req.body)
    db['items'] = req.body
    writeFile(dbPath, JSON.stringify(db), () => {})
  })

  // Create BTR endpoint for /
  server.addHandler('get', '/', join(appPath, 'index.streams.json'), db)

  // Start the server.
  server.start()
}
