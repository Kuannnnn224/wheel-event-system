import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const rootDir = dirname(fileURLToPath(import.meta.url));
const outDir = 'dist-pm-tool';

function inlinePmToolAssets() {
  return {
    name: 'inline-pm-tool-assets',
    closeBundle() {
      const outputDir = resolve(rootDir, outDir);
      const htmlPath = resolve(outputDir, 'pm-tool.html');
      let html = readFileSync(htmlPath, 'utf-8');
      let inlinedScript = '';

      html = html.replace(/<script type="module" crossorigin src="\.\/assets\/([^"]+)"><\/script>/, (_, filename: string) => {
        const script = readFileSync(resolve(outputDir, 'assets', filename), 'utf-8');
        inlinedScript = `<script>${script.replace(/<\/script/gi, '<\\/script')}</script>`;
        return '';
      });
      html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/([^"]+)">/, (_, filename: string) => {
        const stylesheet = readFileSync(resolve(outputDir, 'assets', filename), 'utf-8');
        return `<style>${stylesheet}</style>`;
      });
      html = html.replace('</body>', () => `${inlinedScript}\n  </body>`);

      writeFileSync(htmlPath, html, 'utf-8');
      rmSync(resolve(outputDir, 'assets'), { recursive: true, force: true });
      mkdirSync(resolve(outputDir, 'probability-files'), { recursive: true });
      writeFileSync(
        resolve(outputDir, 'probability-files', 'README.txt'),
        [
          'PM 機率工具本機保存資料夾',
          '',
          '在 pm-tool.html 裡按「本機資料夾」時，可以選這個資料夾。',
          '工具會把上傳的 ZIP 與解析後的 probability JSON 保存到這裡。',
          '',
        ].join('\n'),
        'utf-8',
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), inlinePmToolAssets()],
  base: './',
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(rootDir, 'pm-tool.html'),
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
