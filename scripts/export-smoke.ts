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

console.log(`export smoke passed: ${bundle.scene.events.length} compiled events in ${bundle.scene.durationMs}ms bundle`);
