export default {
  root: '.',
  publicDir: 'public',
  server: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8788' } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
  },
};
