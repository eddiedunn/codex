import { defineConfig } from 'vite';
import path from 'path';
import { builtinModules } from 'module';

// Vite config for CLI build (Node.js target, not web)
export default defineConfig({
  build: {
    target: 'node16',
    lib: {
      entry: path.resolve(__dirname, 'src/cli.tsx'),
      formats: ['es'],
      fileName: () => 'cli.js',
    },
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map(m => `node:${m}`),
      ],
      output: {
        entryFileNames: 'cli.js',
        format: 'es',
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
  },
  ssr: {
    external: [
      ...builtinModules,
      ...builtinModules.map(m => `node:${m}`),
    ],
    noExternal: [],
  },
});