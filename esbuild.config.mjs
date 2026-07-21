import esbuild from 'esbuild';
import process from 'node:process';
import { builtinModules } from 'node:module';

const prod = process.argv[2] === 'production';
const INCLUDE_HEIC = false;

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
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
    '@codemirror/lint',
    '@codemirror/search',
    '@codemirror/state',
    '@codemirror/view',
    '@lezer/common',
    '@lezer/highlight',
    '@lezer/lr',
    ...(INCLUDE_HEIC ? [] : ['heic-decode']),
    ...builtinModules,
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
