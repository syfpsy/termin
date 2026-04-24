import assert from 'node:assert/strict';
import { DEFAULT_DSL } from '../src/engine/dsl';
import { DEFAULT_APPEARANCE } from '../src/engine/types';
import {
  buildPhosphorBundle,
  parsePhosphorBundleJson,
  PHOSPHOR_BUNDLE_MIME,
  PHOSPHOR_BUNDLE_SCHEMA_ID,
  serializePhosphorBundle,
  validatePhosphorBundle,
} from '../src/export/bundle';
import { renderPhosphorEmbedHtml } from '../src/export/htmlEmbed';
import { buildStoreZip, crc32 } from '../src/export/zipStore';
import { buildLoopUrlFromBundle, decodeLoopFragment } from '../src/export/loopUrl';
import { renderSvgPoster, svgFileName } from '../src/export/renderWorkers/svg';

const bundle = buildPhosphorBundle({
  sceneName: 'boot_sequence_v3',
  dsl: DEFAULT_DSL,
  appearance: DEFAULT_APPEARANCE,
  createdAt: '2026-04-24T00:00:00.000Z',
});

assert.equal(bundle.schema, PHOSPHOR_BUNDLE_SCHEMA_ID);
assert.equal(bundle.scene.grid.cols, 96);
assert.equal(bundle.scene.grid.rows, 36);
assert.equal(bundle.scene.tickRate, 30);
assert.equal(bundle.scene.events.length, 7);
assert.ok(bundle.scene.source.includes('scene boot_sequence_v3'));
assert.ok(bundle.scene.events.every((event) => Number.isFinite(event.atMs)));

const validation = validatePhosphorBundle(bundle);
assert.equal(validation.ok, true);

const roundTrip = parsePhosphorBundleJson(serializePhosphorBundle(bundle));
assert.equal(roundTrip.ok, true);
assert.equal(roundTrip.bundle?.scene.name, 'boot_sequence_v3');
assert.equal(roundTrip.bundle?.appearance.font, DEFAULT_APPEARANCE.font);

const invalid = parsePhosphorBundleJson('{"schema":"wrong","scene":{"source":""}}');
assert.equal(invalid.ok, false);
assert.ok(invalid.errors.length > 0);

const playerStub = "customElements.define('phosphor-player', class extends HTMLElement {});";
const html = renderPhosphorEmbedHtml({ bundle, playerSource: playerStub });
assert.ok(html.startsWith('<!doctype html>'), 'html embed must start with doctype');
assert.ok(html.includes('<phosphor-player>'), 'html embed must mount <phosphor-player>');
assert.ok(html.includes(`type="${PHOSPHOR_BUNDLE_MIME}"`), 'html embed must declare bundle MIME');
assert.ok(html.includes(PHOSPHOR_BUNDLE_SCHEMA_ID), 'html embed must embed the bundle JSON');
assert.ok(html.includes(playerStub), 'html embed must inline the compiled player source');
assert.ok(!html.includes('function evalGrid'), 'html embed must not ship the legacy mini-runtime');

const hostileBundle = buildPhosphorBundle({
  sceneName: 'boot_sequence_v3',
  dsl: DEFAULT_DSL,
  appearance: DEFAULT_APPEARANCE,
  createdAt: '2026-04-24T00:00:00.000Z',
});
const hostileHtml = renderPhosphorEmbedHtml({
  bundle: hostileBundle,
  playerSource: "const hostile='</script><script>oops()</script>';",
});
assert.ok(!hostileHtml.includes('</script><script>oops'), 'html embed must neutralize </script> in player source');

assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926, 'crc32 must match known IEEE value');

const textEncoder = new TextEncoder();
const zipEntries = [
  { name: 'a.txt', data: textEncoder.encode('hello'), modified: new Date('2026-04-24T12:00:00Z') },
  { name: 'nested/b.txt', data: textEncoder.encode('world'), modified: new Date('2026-04-24T12:00:00Z') },
];
const zip = buildStoreZip(zipEntries);
const zipView = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
assert.equal(zipView.getUint32(0, true), 0x04034b50, 'zip must start with local file header signature');
const endSig = zipView.getUint32(zip.length - 22, true);
assert.equal(endSig, 0x06054b50, 'zip must end with end-of-central-dir signature');
const totalEntries = zipView.getUint16(zip.length - 22 + 10, true);
assert.equal(totalEntries, 2, 'zip must record 2 entries');

// schema compatibility — forward-facing contract
const futureVersion = parsePhosphorBundleJson(
  JSON.stringify({ ...bundle, schemaVersion: 2 }),
);
assert.equal(futureVersion.ok, false, 'schemaVersion 2 must be rejected by v1 validator');
assert.ok(
  futureVersion.errors.some((err) => err.toLowerCase().includes('schemaversion')),
  'future-version rejection must reference schemaVersion',
);

const wrongSchemaId = parsePhosphorBundleJson(
  JSON.stringify({ ...bundle, schema: 'phosphor.bundle.v2' }),
);
assert.equal(wrongSchemaId.ok, false, 'unknown schema id must be rejected');

// unknown top-level fields are ignored, not fatal
const withUnknown = parsePhosphorBundleJson(
  JSON.stringify({
    ...bundle,
    futureTopLevelField: { note: 'reader must ignore' },
    extensions: ['device-runtime:unknown'],
  }),
);
assert.equal(withUnknown.ok, true, 'unknown top-level fields must not fail validation');
assert.equal(
  (withUnknown.bundle as unknown as Record<string, unknown>).futureTopLevelField,
  undefined,
  'validator must normalize away unknown fields',
);
assert.equal(withUnknown.bundle?.scene.events.length, 7, 'valid scene must survive extra fields');

// unknown appearance values are clamped to defaults rather than rejected
const clampedAppearance = parsePhosphorBundleJson(
  JSON.stringify({
    ...bundle,
    appearance: {
      ...bundle.appearance,
      font: 'comic-sans-future',
      mode: 'hologram',
      decay: 99999,
      tickRate: 144,
      chromatic: -5,
    },
  }),
);
assert.equal(clampedAppearance.ok, true, 'unknown appearance values must be clamped, not rejected');
assert.equal(clampedAppearance.bundle?.appearance.font, DEFAULT_APPEARANCE.font, 'unknown font clamped');
assert.equal(clampedAppearance.bundle?.appearance.mode, DEFAULT_APPEARANCE.mode, 'unknown mode clamped');
assert.equal(clampedAppearance.bundle?.appearance.tickRate, DEFAULT_APPEARANCE.tickRate, 'unknown tickRate clamped');
assert.equal(clampedAppearance.bundle?.appearance.decay, 5000, 'out-of-range decay clamped to max');
assert.equal(clampedAppearance.bundle?.appearance.chromatic, 0, 'negative chromatic clamped to min');

// missing required fields produce specific errors
const missingSource = parsePhosphorBundleJson(
  JSON.stringify({ schema: PHOSPHOR_BUNDLE_SCHEMA_ID, schemaVersion: 1, scene: { name: 'x' } }),
);
assert.equal(missingSource.ok, false, 'missing scene.source must fail');
assert.ok(
  missingSource.errors.some((err) => err.includes('scene.source')),
  'missing scene.source must produce a scene.source-specific error',
);

// loop URL round-trip
const loopResult = await buildLoopUrlFromBundle(bundle, 'https://example.invalid');
assert.ok(loopResult.url.startsWith('https://example.invalid/play.html#play='), 'loop URL must target /play.html');
assert.ok(loopResult.compressed, 'default-size bundle must compress');
assert.ok(loopResult.encodedLength < loopResult.bytes, 'encoded fragment must be smaller than raw JSON');

const fragment = loopResult.url.split('#')[1];
const decoded = await decodeLoopFragment(`#${fragment}`);
assert.equal(decoded.ok, true, 'loop URL fragment must decode');
if (decoded.ok) {
  const roundBundle = JSON.parse(decoded.json);
  assert.equal(roundBundle.scene.name, bundle.scene.name, 'decoded scene name must match');
  assert.equal(roundBundle.scene.events.length, bundle.scene.events.length, 'decoded events count must match');
}

const malformed = await decodeLoopFragment('#play=not-a-valid-payload');
assert.equal(malformed.ok, false, 'malformed fragment must fail decoding');

// SVG poster emission
const svg = renderSvgPoster({
  sceneName: bundle.scene.name,
  dsl: bundle.scene.source,
  appearance: bundle.appearance,
});
assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'svg must begin with XML declaration');
assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg"'), 'svg must declare SVG namespace');
assert.ok(svg.includes('viewBox="0 0 960 720"'), 'svg must declare 960x720 viewBox');
assert.ok(svg.includes('<rect width="100%" height="100%"'), 'svg must include background rect');
assert.ok(svg.includes('<text'), 'svg must contain at least one <text> element for a non-empty scene');
assert.ok(!svg.includes('<script'), 'svg must not embed executable scripts');
assert.equal(svgFileName('Hostile / Name?'), 'Hostile_Name.svg', 'svg file stem must sanitize');

const hostileDsl = 'scene hostile_scene 400ms\nat 0ms type "<hack>&amp;<\\/script>"';
const hostileSvg = renderSvgPoster({
  sceneName: 'hostile',
  dsl: hostileDsl,
  appearance: DEFAULT_APPEARANCE,
});
assert.ok(!hostileSvg.includes('<hack>'), 'svg must escape raw < in cell text');
assert.ok(!hostileSvg.includes('</script>'), 'svg must escape literal </script> in cell text');

console.log(
  `export smoke passed: ${bundle.scene.events.length} compiled events, loop URL ${loopResult.encodedLength}B/${loopResult.bytes}B, svg ${svg.length}B`,
);
