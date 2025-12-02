import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: false, 
  clean: true,
  minify: true, 
  treeshake: true,
  target: 'esnext',
  outDir: 'dist',
  esbuildOptions(options) {
    options.mangleProps = /^_/; 
    options.mangleQuoted = true; 
    options.keepNames = false;
    options.drop = [];
    options.pure = [];
  },
});
