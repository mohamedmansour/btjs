import esbuild from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { CopyAsset, copyPlugin } from './copy-plugin.js'
import { HandleBuild } from './process.js'

interface Options {
  port: number
  out: string
  www?: string
  client?: string
}

function buildBaseOptions(entryPoint: string, out: string): esbuild.BuildOptions {
  return {
    entryPoints: [entryPoint],
    sourcemap: true,
    format: 'esm',
    target: 'esnext',
    outdir: out,
  }
}

function buildWebOptions(entryPoint: string, out: string, www?: string): esbuild.BuildOptions {
  const config = buildBaseOptions(entryPoint, out)
  const entryPointDir = path.dirname(entryPoint)
  const assets: CopyAsset[] = [
    {
      from: [`${entryPointDir}/**/*.html`, `${entryPointDir}/**/*.css`],
      to: [out],
      flatten: true,
    },
  ]

  if (www) {
    assets.push({
      from: [`${www}/**/*`],
      to: [out],
      flatten: true,
    })
  }

  return {
    ...config,
    bundle: true,
    outdir: out,
    plugins: [
      copyPlugin(assets),
    ],
  }
}

function buildNodeOptions(entryPoint: string, out: string): esbuild.BuildOptions {
  const config = buildBaseOptions(entryPoint, out)
  return {
    ...config,
    platform: 'node',
  }
}

export async function HandleServe(entryPoint: string, options: Options) {
  const config = buildWebOptions(entryPoint, options.out, options.www)
  const context = await esbuild.context(config)

  await context.watch()

  const { port } = await context.serve({
    servedir: options.out,
    port: options.port,
    onRequest: (args) => {
      console.log(`[request] ${args.path}`)
    },
  })

  console.log(`[  ready] http://localhost:${port}/`)
}

export async function HandleWebBuild(entryPoint: string, options: Options) {
  const config = buildWebOptions(entryPoint, options.out, options.www)
  config.minify = true
  config.metafile = true

  const results = await esbuild.build(config).catch(() => process.exit(1))
  for (const output in results.metafile?.outputs) {
    const file = results.metafile?.outputs[output]
    if (file.entryPoint) {
      const normalizedOutput = path.normalize(output.replace(config.outdir as string, ''))
      console.log(normalizedOutput, `${file.bytes / 1000}kb`)
      file.imports.forEach((imported) => {
        const normalizedImport = path.normalize(imported.path.replace(config.outdir as string, ''))
        if (imported.path.search('node_modules') === -1) {
          console.log(normalizedImport, `${getFileSizeInBytes(imported.path) / 1000}kb`)
        }
      })
    }
  }
}

export async function HandleNodeBuild(entryPoint: string, options: Options) {
  const config = buildNodeOptions(entryPoint, options.out)
  await esbuild.build(config).catch(() => process.exit(1))
  HandleBuild(options.client!, { port: 3001, useLinkCss: false })
}

function getFileSizeInBytes(path: string): number {
  const stats = fs.statSync(path)
  const fileSizeInBytes = stats.size
  return fileSizeInBytes
}
