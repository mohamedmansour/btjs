import esbuild from 'esbuild'
import copy from 'esbuild-plugin-copy'

esbuild.build({
  entryPoints: ['./src/index.js'],
  bundle: true,
  sourcemap: true,
  format: 'esm',
  target: 'esnext',
  outfile: './dist/js/index.js',
  plugins: [
    copy({
      resolveFrom: 'cwd',
      assets: [
        {
          from: ['./www/*'],
          to: ['./dist'],
        },
      ],
    }),
  ],
}).catch(() => process.exit(1))
