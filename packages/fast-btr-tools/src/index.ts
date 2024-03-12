#!/usr/bin/env node

import { Command } from 'commander'
import { HandleBuild, HandleServe } from './cli.js'

const program = new Command()
program
  .name('FAST BTR Build')
  .description('Server for Build Time Rendering')
  .version('0.0.1')

program
  .command('dev-server <entryPoint>')
  .description('Start the development server')
  .option('-p, --port <port>', 'Port to serve the app', (value) => parseInt(value, 10), 3000)
  .action((entryPoint, options) => HandleServe(entryPoint, options.port))

program
  .command('build <entryPoint>')
  .description('Build the app')
  .action((entryPoint) => HandleBuild(entryPoint))

program.parse(process.argv)
