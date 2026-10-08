import test from 'node:test';
import assert from 'node:assert/strict';
import { MEASURE_STEPS, stepSVG, stepNow, tutorialStrip } from '../ra/tutorial.js';

test('Paso a paso: 5 ilustraciones numeradas, SVG bien formado y accesible', () => {
  assert.equal(MEASURE_STEPS.length, 5);
  for (let i = 0; i < 5; i++) {
    const svg = stepSVG(i);
    assert.match(svg, /^<svg viewBox="0 0 160 120"/); assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes(`aria-label="Paso ${i + 1}:`));
    assert.equal((svg.match(/<g /g) || []).length, (svg.match(/<\/g>/g) || []).length);
  }
  assert.ok(stepNow(1).includes('Paso 2 de 4'));
  assert.equal((tutorialStrip().match(/class="rt-step"/g) || []).length, 5);
});
