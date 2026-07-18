import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  minify: false,
  treeshake: true,
  external: ['sharp', 'pg-native', 'fluent-ffmpeg'],
});
