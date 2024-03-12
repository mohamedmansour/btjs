import esbuild from 'esbuild'
import copy from 'esbuild-plugin-copy'
import fs from 'node:fs'
import path from 'node:path'

function buildOptions(entryPoint: string): esbuild.BuildOptions {
  return {
    entryPoints: [entryPoint],
    bundle: true,
    sourcemap: true,
    format: 'esm',
    target: 'esnext',
    outdir: './dist',
    plugins: [
      copy({
        resolveFrom: 'cwd',
        assets: [
          {
            from: ['./www/*'],
            to: ['./dist'],
          },
          {
            from: ['./src/**/*.html', './src/**/*.css'],
            to: ['./dist'],
          },
        ],
      }),
    ],
  }
}

export async function HandleServe(entryPoint: string, servingPort: number) {
  const config = buildOptions(entryPoint)
  const context = await esbuild.context(config)

  await context.watch()

  const { port } = await context.serve({
    servedir: './dist',
    port: servingPort,
    onRequest: (args) => {
      console.log(`[request] ${args.path}`)
    },
  })

  console.log(`[  ready] http://localhost:${port}/`)
}

export async function HandleBuild(entryPoint: string) {
  const config = buildOptions(entryPoint)
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

function getFileSizeInBytes(path: string): number {
  const stats = fs.statSync(path)
  const fileSizeInBytes = stats.size
  return fileSizeInBytes
}
