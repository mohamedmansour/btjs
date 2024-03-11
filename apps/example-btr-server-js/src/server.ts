import { BTRServer, StateFile } from '@internal/fast-btr-server-js'
import { join, resolve } from 'node:path'

export function HandleServe(appPath: string, port: number) {
  appPath = resolve(process.env['INIT_CWD'] || process.cwd(), appPath)

  const server = new BTRServer(appPath, port)
  const state = new StateFile(appPath, {
    items: [],
    appTitle: 'Welcome Build Time Rendering (BTR)!',
  })

  // Create API endpoint to handle POST requests.
  server.app.post('/api/items', (req, res) => {
    res.status(201).json(req.body)
    state.data['items'] = req.body
    state.flush()
  })

  // Create BTR endpoint for /
  server.addHandler('get', '/', join(appPath, 'index.streams.json'), state.data)

  // Start the server.
  server.start()
}
