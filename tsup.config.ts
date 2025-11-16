import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  dts: true,
  splitting: false,
  sourcemap: false, 
  clean: true,
  minify: true, 
  treeshake: true,
  target: 'esnext',
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }),
  esbuildOptions(options) {
    options.mangleProps = /^_/; 
    options.mangleQuoted = true; 
    options.keepNames = false;
    options.drop = [];
    options.pure = [];
  },
});

