import { chromium } from 'playwright';
import axe from 'axe-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';

// Never run writes against a supplied URL: create our own app and database.
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'coffee-ui-e2e-'));
const appRoot = path.join(fixtureRoot, 'web');
fs.cpSync(webRoot, appRoot, {
  recursive: true,
  filter: (source) => !['node_modules', '.next', '.git'].includes(path.basename(source))
    && !path.basename(source).startsWith('.env'),
});
fs.symlinkSync(path.join(webRoot, 'node_modules'), path.join(appRoot, 'node_modules'), 'dir');
fs.copyFileSync(path.join(webRoot, 'scripts/ui-db.fixture.txt'), path.join(appRoot, 'lib/db.ts'));
fs.writeFileSync(path.join(appRoot, 'next.config.ts'),
  'export default { serverExternalPackages: ["@electric-sql/pglite"], devIndicators: false };\n');
const listener = net.createServer();
await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise(resolve => listener.close(resolve));
const base = 'http://localhost:' + port;
const salt = randomBytes(16);
const child = spawn(process.execPath, [
  path.join(webRoot, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--port', String(port),
], {
  cwd: appRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/isolated',
    AUTH_SECRET: randomBytes(32).toString('hex'),
    AUTH_ALLOWED_EMAIL: 'owner@example.test',
    AUTH_PASSWORD_HASH: salt.toString('hex') + ':' + scryptSync('local-e2e-only-not-production', salt, 64).toString('hex'),
    AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '', AUTH_TRUST_HOST: 'true',
  },
});
let serverLog = '';
child.stdout.on('data', data => { serverLog = (serverLog + data).slice(-12000); });
child.stderr.on('data', data => { serverLog = (serverLog + data).slice(-12000); });
async function waitForServer() {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Isolated Next server exited: ' + serverLog);
    try {
      const response = await fetch(base + '/login', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch { /* Server is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Isolated Next server startup timed out: ' + serverLog);
}
const results = [];
async function main() {
  await waitForServer();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const page = await context.newPage();
    const clientErrors=[];
    page.on('pageerror', error => clientErrors.push(error.message));
    page.setDefaultTimeout(20000);
    await page.goto(base + '/rak');
    await page.waitForURL('**/login');
    await page.getByLabel('Email', {exact:true}).fill('owner@example.test');
    await page.locator('input[name=password]').fill('incorrect');
    await page.getByRole('button', {name:'Masuk',exact:true}).click();
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(), 'owner@example.test');
    await page.locator('input[name=password]').fill('local-e2e-only-not-production');
    await page.getByRole('button', {name:'Masuk',exact:true}).click();
    await page.waitForURL('**/dashboard');
    results.push('Auth boundary, failed login and successful credentials login');
    await page.goto(base + '/rak#lot-1');
    const form = page.locator('#lot-form-1');
    await form.getByLabel('Gram',{exact:true}).fill('18');
    await form.getByRole('button',{name:'Catat',exact:true}).click();
    await page.getByRole('status').filter({hasText:'Seduh 18 g'}).waitFor();
    await page.locator('#lot-1').getByText('232 g',{exact:true}).waitFor();
    await page.getByRole('link',{name:'Lihat riwayat'}).click();
    await page.waitForURL('**/history?lot=1');
    assert.equal(await page.locator('select').first().inputValue(),'1');
    await page.getByRole('cell',{name:'−18 g',exact:true}).waitFor();
    results.push('Record brew → committed receipt → refreshed balance → filtered history');
    await page.goto(base + '/rak#lot-1');
    await form.getByLabel('Gram',{exact:true}).fill('999');
    await form.getByLabel('Catatan (opsional)').fill('tetap ada setelah gagal');
    await form.getByRole('button',{name:'Catat',exact:true}).click();
    await form.getByRole('alert').waitFor();
    assert.equal(await form.getByLabel('Gram',{exact:true}).inputValue(),'999');
    await page.locator('#lot-1').getByText('232 g',{exact:true}).waitFor();
    results.push('Overdraft rejected; fields preserved; stock unchanged');
    await form.locator('select[name=kind]').selectOption('GIFT');
    await form.getByLabel('Gram',{exact:true}).fill('5');
    await form.getByLabel('Penerima (opsional)').fill('Rina');
    await form.getByRole('button',{name:'Catat',exact:true}).click();
    await page.getByRole('status').filter({hasText:'5 g'}).waitFor();
    await page.locator('#lot-1').getByText('227 g',{exact:true}).waitFor();
    results.push('Gift recipient and balance refresh');
    await page.goto(base + '/rak#lot-2');
    const second=page.locator('#lot-form-2');
    await second.getByLabel('Gram',{exact:true}).fill('125');
    await second.getByRole('button',{name:'Catat',exact:true}).click();
    await page.getByRole('status').filter({hasText:'125 g'}).waitFor();
    await second.getByText(/Stok sudah habis/).waitFor();
    await page.getByRole('button',{name:'Catat untuk Kerinci Anaerobic Natural'}).click();
    assert.equal(await page.locator('#lot-2').isVisible(),false);
    await page.getByRole('status').filter({hasText:'125 g'}).waitFor();
    results.push('Zero stock moves out of active results; receipt survives panel close');
    const a11y=[];
    const layout=[];
    const smallControls=[];
    for(const route of ['/','/login','/dashboard','/rak','/history']) {
      await page.goto(base + route);
      await page.evaluate(()=>document.fonts.ready);
      await page.addScriptTag({content:axe.source});
      const report=await page.evaluate(async()=>{
        const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa','best-practice']}});
        return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
      });
      a11y.push({route,violations:report});
      smallControls.push(...await page.locator('main').evaluate((main, route) =>
        [...main.querySelectorAll('button,input,select,summary')]
          .filter(el => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 44)
          .map(el => ({ route, control: el.textContent?.slice(0, 60) || el.getAttribute('type'), height: el.getBoundingClientRect().height })), route));
      for(const width of [320,390,640,768,1280]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        layout.push({route,width,scroll:await page.evaluate(()=>document.documentElement.scrollWidth)});
      }
    }
    await page.setViewportSize({width:1200,height:900});
    await page.goto(base+'/rak');
    await page.keyboard.press('Tab');
    const firstFocus=await page.evaluate(()=>document.activeElement?.textContent);
    if(firstFocus?.includes('Lewati ke konten')){
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');
      results.push('Keyboard skip-link targets main content');
    } else results.push('Keyboard initial focus: '+firstFocus);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto(base+'/');
    assert.ok(await page.getByRole('heading',{level:1}).isVisible());
    const noJs=await browser.newContext({javaScriptEnabled:false});
    const noJsPage=await noJs.newPage();
    await noJsPage.goto(base+'/');
    assert.ok(await noJsPage.getByRole('heading',{level:1}).isVisible());
    await noJs.close();
    results.push('Landing visible with reduced motion and JavaScript disabled');
    const zoomLayout=[];
    await page.setViewportSize({width:1280,height:900});
    for (const route of ['/','/login','/dashboard','/rak','/history']) {
      await page.goto(base+route);
      await page.evaluate(()=>{document.documentElement.style.zoom='2';});
      zoomLayout.push({route,zoom:2,width:1280,scroll:await page.evaluate(()=>document.documentElement.scrollWidth)});
    }
    if(process.env.UPDATE_UI_SCREENSHOTS==='1') {
      const capturePage=await page.context().newPage();
      for(const route of ['dashboard','rak']) {
        await capturePage.setViewportSize({width:1200,height:900});
        await capturePage.goto(base+'/'+route);
        await capturePage.getByRole('heading',{level:1}).waitFor();
        if(route==='rak') await capturePage.getByRole('button',{name:'Catat untuk Gayo Wine Natural'}).click();
        await capturePage.evaluate(()=>document.fonts.ready);
        // Development's expected failed-login badge is not part of the app UI.
        await capturePage.addStyleTag({content:'nextjs-portal { display: none !important; }'});
        await capturePage.screenshot({path:path.join(webRoot,'public',route+'-preview.png')});
        await capturePage.setViewportSize({width:390,height:844});
        await capturePage.screenshot({path:path.join(fixtureRoot,route+'-mobile.png'),fullPage:true});
      }
      await capturePage.close();
      results.push('Updated desktop landing screenshots and mobile evidence using isolated sample data');
    }
    fs.writeFileSync(path.join(fixtureRoot, 'results.json'),JSON.stringify({results,a11y,layout,zoomLayout,smallControls,clientErrors},null,2));
    console.log(JSON.stringify({results,a11y,layout,zoomLayout,smallControls,clientErrors}));
    if(a11y.some(r=>r.violations.length)||layout.some(r=>r.scroll>r.width)||zoomLayout.some(r=>r.scroll>r.width)||smallControls.length||clientErrors.length)process.exitCode=2;
  } finally { await browser.close(); }
}
try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const closed = new Promise(resolve => child.once('close', resolve));
    child.kill('SIGTERM');
    await closed;
  }
  console.log('Isolated verification artifacts:', fixtureRoot);
}
