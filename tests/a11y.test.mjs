import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { DESKTOP, PHONE, SITE_PAGES, openPage, settle, useBrowser } from './helpers.mjs';

const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const ctx = useBrowser();

// learning.html is the public study portal; the sign-in pages depend on the live account service.
for (const file of [...SITE_PAGES, 'learning.html']) {
  for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]]) {
    test(`${file} has no WCAG 2.1 A/AA violations on ${label}`, async () => {
      // bypassCSP lets the audit script be injected; it does not change how the page renders.
      const page = await openPage(ctx, file, viewport, { bypassCSP: true });
      await settle(page);
      await page.addScriptTag({ content: axeSource });
      const violations = await page.evaluate(async () => {
        const result = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] });
        return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}${v.nodes.length > 4 ? ` +${v.nodes.length - 4} more` : ''}`);
      });
      assert.deepEqual(violations, []);
      await page.close();
    });
  }
}
