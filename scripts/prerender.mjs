#!/usr/bin/env node
/**
 * Puppeteer-based prerendering for SPA → static HTML
 * Runs after `vite build` to prerender dist/index.html
 *
 * Works on Netlify (uses PUPPETEER_EXECUTABLE_PATH or downloads Chromium)
 */

import { readFile, writeFile } from 'fs/promises';
import { createServer } from 'http';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

const DIST = resolve('dist');
const INDEX = join(DIST, 'index.html');
const PORT = 45678;
const TIMEOUT = 30000;

async function getChromePath() {
  // 1. Netlify / CI sets PUPPETEER_EXECUTABLE_PATH
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. Try common Chromium/Chrome paths
  const paths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const p of paths) {
    if (existsSync(p)) return p;
  }

  // 3. Install Chromium via @puppeteer/browsers
  console.log('  No Chrome found. Installing Chromium via @puppeteer/browsers...');
  const { install, Browser, detectBrowserPlatform } = await import('@puppeteer/browsers');
  const platform = detectBrowserPlatform();
  const buildId = '131.0.6778.204'; // stable known version
  const result = await install({
    browser: Browser.CHROMIUM,
    buildId,
    cacheDir: join(resolve('.'), '.cache', 'puppeteer'),
    platform,
  });
  console.log(`  Chromium installed: ${result.executablePath}`);
  return result.executablePath;
}

async function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };

  const server = createServer(async (req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/') url = '/index.html';

    const filePath = join(DIST, url);
    const ext = '.' + filePath.split('.').pop();

    try {
      const data = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    } catch {
      // SPA fallback
      const html = await readFile(INDEX);
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

async function prerender() {
  console.log('[prerender] Starting...');

  // Read original HTML for comparison
  const originalHtml = await readFile(INDEX, 'utf-8');

  // Start local server
  const server = await startServer();
  console.log(`[prerender] Server running on http://localhost:${PORT}`);

  try {
    // Get Chrome path
    const executablePath = await getChromePath();
    console.log(`[prerender] Using Chrome: ${executablePath}`);

    // Launch puppeteer-core
    const puppeteer = await import('puppeteer-core');
    const browser = await puppeteer.default.launch({
      executablePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();

    // Navigate and wait for React to render
    await page.goto(`http://localhost:${PORT}/`, {
      waitUntil: 'networkidle0',
      timeout: TIMEOUT,
    });

    // Wait a bit more for any async renders
    await page.waitForSelector('#root', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));

    // Extract the rendered HTML
    const renderedHtml = await page.content();

    await browser.close();

    // Check if we got meaningful content
    const rootContent = renderedHtml.match(/<div id="root">([\s\S]*?)<\/div>/);
    if (!rootContent || rootContent[1].trim().length < 100) {
      console.warn('[prerender] WARNING: Rendered content seems empty. Keeping original.');
      return;
    }

    // Write prerendered HTML
    await writeFile(INDEX, renderedHtml, 'utf-8');

    const origSize = Buffer.byteLength(originalHtml, 'utf-8');
    const newSize = Buffer.byteLength(renderedHtml, 'utf-8');
    console.log(`[prerender] Success!`);
    console.log(`  Original: ${(origSize / 1024).toFixed(1)} KB`);
    console.log(`  Prerendered: ${(newSize / 1024).toFixed(1)} KB (+${((newSize - origSize) / 1024).toFixed(1)} KB)`);

  } finally {
    server.close();
  }
}

prerender().catch(err => {
  console.error('[prerender] Failed:', err.message);
  console.log('[prerender] Continuing without prerendering (build still valid)');
  process.exit(0); // Don't fail the build
});
