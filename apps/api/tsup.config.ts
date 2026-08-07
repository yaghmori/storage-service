import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    main: 'src/main.ts',
    migrate: 'src/scripts/migrate.ts',
    seed: 'src/scripts/seed.ts',
  },
  format: ['cjs'],
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  bundle: true,
  minify: false,
  treeshake: true,
  // Workspace packages are not published to the prod image — force them into the bundle.
  // (tsup leaves node_modules external by default even with bundle: true.)
  noExternal: ['@workspace/validation'],
  // Nest DI needs design:paramtypes — requires @swc/core (see package.json).
  // Without it, constructor deps without @Inject() become undefined at runtime.
  external: ['sharp', 'pg-native', 'fluent-ffmpeg', 'pg'],
});
