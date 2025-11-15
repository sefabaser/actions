import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'], // Only ESM - modern, optimal format
  dts: true,
  splitting: false,
  sourcemap: false, // Don't expose source maps
  clean: true,
  minify: true, // Built-in esbuild minification - fast runtime, no overhead
  treeshake: true,
  target: 'esnext',
  outDir: 'dist',
  outExtension: () => ({ js: '.js' }), // Use .js extension (not .mjs)
  esbuildOptions(options) {
    // Built-in mangling and optimization
    options.mangleProps = /^_/; // Mangle properties starting with _
    options.mangleQuoted = false; // Don't mangle quoted properties
    options.keepNames = false; // Remove function names for smaller size
    options.drop = []; // Keep console.log - useful for users debugging
    options.pure = []; // Mark functions as side-effect free for better tree-shaking
  },
});

