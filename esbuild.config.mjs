import esbuild from 'esbuild';
import process from 'node:process';

const prod = process.argv[2] === 'production';
const INCLUDE_HEIC = false;

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  conditions: ['browser'],
  define: {
    __INCLUDE_HEIC__: JSON.stringify(INCLUDE_HEIC),
  },
  external: [
    'obsidian',
    'electron',
    '@codemirror/autocomplete',
    '@codemirror/collab',
    '@codemirror/commands',
    '@codemirror/language',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...(INCLUDE_HEIC ? [] : ['heic-decode']),
  ],
  format: 'cjs',
  target: 'esnext',
  logLevel: 'info',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
  outfile: 'main.js',
  minify: prod,
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
