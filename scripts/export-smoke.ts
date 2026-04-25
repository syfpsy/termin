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
import { renderSvgAnimation, renderSvgPoster, svgFileName } from '../src/export/renderWorkers/svg';
import { parseScene } from '../src/engine/dsl';
import {
  addEventToSource,
  addKeyframeToAnimation,
  addMarkerToSource,
  appendAnimation,
  clampEventTime,
  defaultEventTemplate,
  deleteEventInSource,
  deleteEventsInSource,
  deleteMarkerInSource,
  eventToLine,
  eventsToFragment,
  formatEventLine,
  isResizable,
  moveEventInSource,
  moveEventsInSource,
  moveKeyframe,
  pasteEventLines,
  patchEventInSource,
  removeKeyframe,
  rescaleEventsInSource,
  resizeEventInSource,
  setDurationModifier,
  setEventFlagInSource,
  setFlagInModifiers,
  setKeyframeEasing,
  setKeyframeValue,
  splitEventAtMs,
  stripFlagsFromModifiers,
} from '../src/engine/dslEdit';
import {
  clampAnimatedValue,
  easingProgress,
  formatPropertyLine,
  sampleAnimation,
  sampleSceneAppearance,
} from '../src/engine/keyframes';

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
assert.equal(svgFileName('probe'), 'probe.svg', 'animated svg file name has plain .svg suffix');
assert.equal(svgFileName('probe', 'poster'), 'probe.poster.svg', 'poster variant gets .poster.svg suffix');

// animated SVG emission
const animatedSvg = renderSvgAnimation({
  sceneName: bundle.scene.name,
  dsl: bundle.scene.source,
  appearance: bundle.appearance,
});
assert.ok(animatedSvg.includes('<animate attributeName="fill-opacity"'), 'animated svg must declare opacity animation');
assert.ok(animatedSvg.includes('repeatCount="indefinite"'), 'animated svg must loop forever');
assert.ok(animatedSvg.includes(`dur="2.880s"`), 'animated svg duration must match scene duration');
assert.ok(animatedSvg.length > svg.length, 'animated svg must be larger than the poster');
assert.ok(!animatedSvg.includes('<script'), 'animated svg must not embed scripts');

// DSL editing primitives — round-trip through parse to confirm identity preservation
{
  const initial = `scene edit_probe 2s\n# stage one\nat 0ms type "BOOT" slowly\nat 600ms pulse "warming" amber 400ms`;
  const parsed = parseScene(initial);
  assert.equal(parsed.events.length, 2, 'baseline parse must see 2 events');

  // formatEventLine round-trip
  const reformatted = eventToLine(parsed.events[0]);
  assert.ok(reformatted.startsWith('at 0ms type'), 'format must place time + effect');
  assert.ok(reformatted.includes('"BOOT"'), 'format must quote the target');
  assert.ok(reformatted.includes('slowly'), 'format must preserve modifiers');

  // move
  const moved = moveEventInSource({ source: initial, event: parsed.events[1], atMs: 1500, sceneDurationMs: 2000 });
  const movedScene = parseScene(moved);
  assert.equal(movedScene.events[1].at, 1500, 'move must update at time');
  assert.equal(movedScene.events.length, 2, 'move must not change event count');
  assert.ok(moved.includes('# stage one'), 'move must preserve comments');

  // clamp + snap
  assert.equal(clampEventTime(-100, 1000), 0, 'negative time clamps to 0');
  assert.equal(clampEventTime(1500, 1000), 1000, 'overflow clamps to scene duration');
  assert.equal(clampEventTime(317, 2000, 100), 300, 'snap rounds to nearest grid');

  // resize
  const resized = resizeEventInSource({ source: initial, event: parsed.events[1], durationMs: 900 });
  const resizedScene = parseScene(resized);
  assert.ok(resizedScene.events[1].modifiers.includes('900ms'), 'resize must update duration token');
  assert.ok(!resizedScene.events[1].modifiers.includes('400ms'), 'resize must replace prior duration token');

  // resize on a non-resizable effect (type) is a no-op
  const noop = resizeEventInSource({ source: initial, event: parsed.events[0], durationMs: 999 });
  assert.equal(noop, initial, 'resize on type must be a no-op');
  assert.equal(isResizable('type'), false, 'type is not resizable');
  assert.equal(isResizable('pulse'), true, 'pulse is resizable');

  // setDurationModifier inserts when missing
  assert.equal(setDurationModifier('amber', 250), 'amber 250ms', 'duration appended when absent');
  assert.equal(setDurationModifier('amber 400ms', 250), 'amber 250ms', 'first duration token replaced');
  assert.equal(setDurationModifier('', 250), '250ms', 'empty modifiers gets a single duration');

  // delete
  const deleted = deleteEventInSource(initial, parsed.events[0]);
  const deletedScene = parseScene(deleted);
  assert.equal(deletedScene.events.length, 1, 'delete must remove the event line');
  assert.equal(deletedScene.events[0].effect, 'pulse', 'remaining event must be the pulse');

  // patch — change target text + tone
  const patched = patchEventInSource({
    source: initial,
    event: parsed.events[1],
    patch: { target: 'COOLING', modifiers: 'cyan 350ms' },
    sceneDurationMs: 2000,
  });
  const patchedScene = parseScene(patched);
  assert.equal(patchedScene.events[1].target, 'COOLING', 'patch must rewrite target');
  assert.ok(patchedScene.events[1].modifiers.includes('cyan'), 'patch must rewrite modifiers');
  assert.equal(patchedScene.events[1].at, 600, 'patch without atMs must keep time');

  // patch sanitizes quotes in target so source still parses
  const sanitized = patchEventInSource({
    source: initial,
    event: parsed.events[0],
    patch: { target: 'A "hostile" "name"' },
    sceneDurationMs: 2000,
  });
  const sanitizedScene = parseScene(sanitized);
  assert.equal(sanitizedScene.lines.filter((line) => line.kind === 'invalid').length, 0, 'sanitized source must parse');
  assert.ok(!sanitizedScene.events[0].target.includes('"'), 'patched target must drop literal quotes');

  // add
  const { source: added, lineNumber } = addEventToSource({
    source: initial,
    atMs: 1900,
    effect: 'glitch',
    target: 'FAULT',
    modifiers: '120ms burst',
    sceneDurationMs: 2000,
  });
  const addedScene = parseScene(added);
  assert.equal(addedScene.events.length, 3, 'add must produce a third event');
  assert.equal(addedScene.events[2].effect, 'glitch', 'added event must be glitch');
  assert.equal(addedScene.events[2].at, 1900, 'added event must respect atMs');
  assert.ok(typeof lineNumber === 'number' && lineNumber > 0, 'add must return a line number');

  // add clamps over-duration time
  const { source: addedClamped } = addEventToSource({
    source: initial,
    atMs: 9_999_999,
    effect: 'flash',
    target: 'screen',
    sceneDurationMs: 2000,
  });
  const addedClampedScene = parseScene(addedClamped);
  assert.ok(
    addedClampedScene.events.every((event) => event.at <= 2000),
    'add must clamp atMs to scene duration',
  );

  // formatEventLine produces lines that re-parse identically
  const sample = formatEventLine({ atMs: 750, effect: 'wave', target: 'signal', modifiers: '900ms' });
  const reparsed = parseScene(`scene rt 1s\n${sample}`);
  assert.equal(reparsed.events.length, 1, 'formatted line must parse to one event');
  assert.equal(reparsed.events[0].at, 750, 'formatted time must round-trip');
  assert.equal(reparsed.events[0].effect, 'wave', 'formatted effect must round-trip');

  // defaultEventTemplate produces parseable lines for every catalogued effect
  const effects = ['type', 'cursor', 'scan-line', 'glitch', 'pulse', 'decay-trail', 'dither', 'wave', 'wipe', 'loop', 'shake', 'flash'];
  for (const effect of effects) {
    const template = defaultEventTemplate(effect, 200);
    const line = formatEventLine(template);
    const parsedTemplate = parseScene(`scene t 800ms\n${line}`);
    assert.equal(
      parsedTemplate.lines.filter((l) => l.kind === 'invalid').length,
      0,
      `template for ${effect} must parse cleanly`,
    );
  }
}

// AE-style multi-op DSL helpers
{
  const baseSource = `scene multi 3s\nat 0ms type "FIRST" slowly\nat 600ms pulse "second" amber 400ms\nat 1500ms glitch "THIRD" 80ms burst`;
  const parsed = parseScene(baseSource);
  assert.equal(parsed.events.length, 3, 'baseline parse');
  assert.equal(parsed.events.every((event) => event.flags.muted === false), true, 'no events start muted');

  // flag toggling
  const muted = setEventFlagInSource(baseSource, parsed.events[0], 'muted', true);
  const mutedScene = parseScene(muted);
  assert.equal(mutedScene.events[0].flags.muted, true, 'mute flag set');
  assert.equal(mutedScene.events[0].modifiers.includes('muted'), true, 'modifiers contain muted token');

  const unmuted = setEventFlagInSource(muted, mutedScene.events[0], 'muted', false);
  assert.equal(parseScene(unmuted).events[0].flags.muted, false, 'unmute removes flag');
  assert.equal(setFlagInModifiers('amber 400ms', 'solo', true), 'amber 400ms solo');
  assert.equal(setFlagInModifiers('amber solo 400ms', 'solo', false), 'amber 400ms');

  // multi-move respects scene duration clamping
  const groupShifted = moveEventsInSource({
    source: baseSource,
    events: [parsed.events[0], parsed.events[1]],
    deltaMs: 500,
    sceneDurationMs: 3000,
    snapMs: 0,
  });
  const shiftedScene = parseScene(groupShifted);
  assert.equal(shiftedScene.events[0].at, 500, 'group move first event');
  assert.equal(shiftedScene.events[1].at, 1100, 'group move second event');
  assert.equal(shiftedScene.events[2].at, 1500, 'untouched event stays put');

  // group delete removes both
  const groupDeleted = deleteEventsInSource(baseSource, [parsed.events[0], parsed.events[2]]);
  assert.equal(parseScene(groupDeleted).events.length, 1, 'group delete leaves 1 event');

  // split
  const splitResult = splitEventAtMs({
    source: baseSource,
    event: parsed.events[1],
    atMs: 800,
    sceneDurationMs: 3000,
  });
  assert.ok(splitResult.lineNumber !== null, 'split returns the new line number');
  const splitScene = parseScene(splitResult.source);
  assert.equal(splitScene.events.length, 4, 'split produces 4 events');
  const pulses = splitScene.events.filter((e) => e.effect === 'pulse');
  assert.equal(pulses.length, 2, 'two pulse halves');
  assert.equal(pulses[0].at, 600, 'first half keeps original time');
  assert.equal(pulses[1].at, 800, 'second half starts at split point');
  assert.ok(pulses[0].modifiers.includes('200ms'), 'first half duration is split offset');
  assert.ok(pulses[1].modifiers.includes('200ms'), 'second half duration is remainder');

  // split refuses non-resizable
  const splitNoop = splitEventAtMs({
    source: baseSource,
    event: parsed.events[0], // type
    atMs: 200,
    sceneDurationMs: 3000,
  });
  assert.equal(splitNoop.lineNumber, null, 'split refuses non-resizable effect');
  assert.equal(splitNoop.source, baseSource, 'split returns original source on no-op');

  // rescale
  const rescaled = rescaleEventsInSource({
    source: baseSource,
    events: parsed.events.slice(0, 2),
    fromStart: 0,
    fromEnd: 600,
    toStart: 0,
    toEnd: 1200,
    sceneDurationMs: 3000,
    snapMs: 0,
  });
  const rescaledScene = parseScene(rescaled);
  assert.equal(rescaledScene.events[0].at, 0, 'rescale anchor stays at start');
  assert.equal(rescaledScene.events[1].at, 1200, 'rescale stretches second event');

  // markers
  const withMarker = addMarkerToSource({
    source: baseSource,
    name: 'beat one',
    atMs: 500,
    sceneDurationMs: 3000,
  });
  const markerScene = parseScene(withMarker.source);
  assert.equal(markerScene.markers.length, 1, 'marker registered');
  assert.equal(markerScene.markers[0].name, 'beat one', 'marker name preserved');
  assert.equal(markerScene.markers[0].at, 500, 'marker at preserved');

  const removedMarker = deleteMarkerInSource(withMarker.source, markerScene.markers[0]);
  assert.equal(parseScene(removedMarker).markers.length, 0, 'marker removable');

  // copy / paste round-trip
  const fragment = eventsToFragment([parsed.events[0], parsed.events[2]]);
  const pasted = pasteEventLines({
    source: baseSource,
    fragment,
    atMs: 2000,
    sceneDurationMs: 3000,
    snapMs: 0,
  });
  const pastedScene = parseScene(pasted.source);
  assert.equal(pastedScene.events.length, 5, 'paste appends 2 events');
  assert.equal(pasted.insertedLines.length, 2, 'paste returns inserted line numbers');
  // first pasted event lands exactly at 2000ms; second preserves +1500 offset → 3500ms but clamped to 3000
  const newOnes = pastedScene.events.filter((event) => event.line >= pasted.insertedLines[0]);
  assert.equal(newOnes[0].at, 2000, 'first pasted event lands at paste anchor');
  assert.ok(newOnes.some((event) => event.at === 3000), 'second pasted event clamps to scene duration');

  // flag tokens stripped on paste
  const flaggedSource = `scene src 1s\nat 0ms pulse "lock me" amber 200ms muted locked`;
  const flaggedParsed = parseScene(flaggedSource);
  const flaggedFragment = eventsToFragment(flaggedParsed.events);
  assert.ok(!flaggedFragment.includes('muted'), 'fragment strips muted flag');
  assert.ok(!flaggedFragment.includes('locked'), 'fragment strips locked flag');
  assert.equal(stripFlagsFromModifiers('amber muted 400ms locked'), 'amber 400ms');
}

// line diff for director proposals
{
  const { diffLines } = await import('../src/ui/lineDiff');
  const before = `scene a 1s\nat 0ms type "X"\nat 600ms pulse "Y" amber 400ms`;
  const after = `scene a 1s\nat 0ms type "X"\nat 300ms glitch "Z" 80ms\nat 600ms pulse "Y" amber 400ms`;
  const diff = diffLines(before, after);
  assert.equal(diff.added, 1, 'added one new line');
  assert.equal(diff.removed, 0, 'kept the rest');
  assert.equal(diff.kept, 3, 'three lines unchanged');
  assert.ok(
    diff.rows.some((row) => row.kind === 'add' && row.text.includes('glitch')),
    'add row contains the new glitch line',
  );

  const replacement = diffLines('alpha\nbeta\ngamma', 'alpha\ndelta\ngamma');
  assert.equal(replacement.added, 1);
  assert.equal(replacement.removed, 1);
  assert.equal(replacement.kept, 2);

  const empty = diffLines('', 'a\nb');
  assert.equal(empty.added, 2, 'empty source -> all lines added');
  assert.equal(empty.removed, 1, 'the lone empty source line is removed');
  assert.equal(empty.kept, 0);
}

// data-driven scenes: data {...} parsing + {{path}} substitution
{
  const { applyTemplate } = await import('../src/engine/dsl');
  const dataScene = `scene status 2s
data { "users": 1247, "service": { "online": 5, "name": "auth" } }
at 0ms type "USERS:{{users}}" slowly
at 600ms type "ONLINE:{{service.online}}/{{service.name}}"`;
  const parsed = parseScene(dataScene);
  assert.equal(parsed.events.length, 2, 'data line is not counted as an event');
  assert.equal(parsed.data.users, 1247, 'data block parsed');
  assert.deepEqual(parsed.data.service, { online: 5, name: 'auth' });
  assert.equal(parsed.events[0].target, 'USERS:1247', 'top-level placeholder substituted');
  assert.equal(parsed.events[1].target, 'ONLINE:5/auth', 'nested + multiple placeholders substituted');

  // Multiple data lines deep-merge so the director can append patches.
  const merged = parseScene(`scene m 1s
data { "a": 1, "nested": { "x": 1 } }
data { "b": 2, "nested": { "y": 2 } }
at 0ms type "{{a}}/{{b}}/{{nested.x}}/{{nested.y}}"`);
  assert.equal(merged.events[0].target, '1/2/1/2', 'multiple data lines merge deeply');

  // Missing keys preserve the placeholder verbatim so it is visible.
  const missing = parseScene(`scene n 1s
data { "users": 5 }
at 0ms type "{{users}}/{{ghost}}"`);
  assert.equal(missing.events[0].target, '5/{{ghost}}', 'missing key keeps placeholder visible');

  // Invalid JSON in data line reports a friendly error.
  const bogus = parseScene(`scene b 1s\ndata { not real json }`);
  assert.ok(
    bogus.lines.some((line) => line.kind === 'invalid' && line.error.includes('Invalid data JSON')),
    'invalid data JSON reports a friendly error',
  );

  // applyTemplate is exported and works standalone.
  assert.equal(applyTemplate('hello {{name}}', { name: 'world' }), 'hello world');
  assert.equal(applyTemplate('cost: {{p}}', { p: 12.5 }), 'cost: 12.5');
  assert.equal(applyTemplate('flag: {{x}}', { x: true }), 'flag: true');

  // Existing scenes (no data block) parse identically.
  const plain = parseScene('scene p 1s\nat 0ms type "hello"');
  assert.deepEqual(plain.data, {}, 'scenes without data still expose an empty data record');
  assert.equal(plain.events[0].target, 'hello');

  // Bundles still serialize cleanly with a data block in source.
  const bundle = buildPhosphorBundle({
    sceneName: 'with_data',
    dsl: dataScene,
    appearance: DEFAULT_APPEARANCE,
    createdAt: '2026-04-25T00:00:00.000Z',
  });
  assert.ok(bundle.scene.source.includes('data { '), 'bundle preserves data line in source');
  assert.equal(bundle.scene.events[0].target, 'USERS:1247', 'compiled events carry substituted text');
}

// per-event property keyframes (event-targeted prop lines)
{
  const { sampleEventParam } = await import('../src/engine/keyframes');
  const sourceWithEventAnim = `scene anim 1s\nat 0ms pulse "warming" amber 600ms\nprop event-2 intensity 0ms 0.3 600ms 1.0 ease-in`;
  const parsed = parseScene(sourceWithEventAnim);
  assert.equal(parsed.animations.length, 1, 'event-targeted prop parses');
  const animation = parsed.animations[0];
  assert.equal(animation.eventLine, 2, 'eventLine captured from event-2 syntax');
  assert.equal(animation.property, 'intensity', 'param captured');
  assert.equal(animation.keyframes.length, 2);

  // sampleEventParam returns interpolated value at 0/end/middle
  assert.equal(sampleEventParam(parsed.animations, 2, 'intensity', 0, 1), 0.3, 'at start = first keyframe');
  assert.equal(sampleEventParam(parsed.animations, 2, 'intensity', 600, 1), 1.0, 'at end = last keyframe');
  // ease-in pushes the midpoint below linear
  const mid = sampleEventParam(parsed.animations, 2, 'intensity', 300, 1);
  const linearMid = 0.3 + (1.0 - 0.3) * 0.5;
  assert.ok(mid < linearMid, 'ease-in mid is below linear mid');

  // Unknown event/param falls back
  assert.equal(sampleEventParam(parsed.animations, 999, 'intensity', 100, 1), 1, 'unknown event line falls back');
  assert.equal(sampleEventParam(parsed.animations, 2, 'speed', 100, 1), 1, 'unknown param falls back');

  // formatPropertyLine round-trips event-targeted animation
  const { formatPropertyLine } = await import('../src/engine/keyframes');
  const formatted = formatPropertyLine(animation);
  assert.ok(formatted.startsWith('prop event-2 intensity'), `format starts with event-N param: ${formatted}`);
  const reparsed = parseScene(`scene t 1s\n${formatted}`);
  assert.equal(reparsed.animations.length, 1, 'formatted prop event line round-trips');
  assert.equal(reparsed.animations[0].eventLine, 2);
  assert.equal(reparsed.animations[0].property, 'intensity');

  // Unknown event param errors with a clear message
  const bogus = parseScene(`scene t 1s\nprop event-1 zzz 0ms 0.5`);
  assert.ok(
    bogus.lines.some((line) => line.kind === 'invalid' && line.error.toLowerCase().includes('unknown event parameter')),
    'unknown event parameter reports a friendly error',
  );

  // Unknown target (neither appearance nor event-N)
  const bogusTarget = parseScene(`scene t 1s\nprop nonsense 0ms 1.0`);
  assert.ok(
    bogusTarget.lines.some((line) => line.kind === 'invalid' && line.error.toLowerCase().includes('unknown animatable target')),
    'unknown animatable target reports a friendly error',
  );

  // Bundles include eventLine on compiled animations
  const bundle = buildPhosphorBundle({
    sceneName: 'with_event_anim',
    dsl: sourceWithEventAnim,
    appearance: DEFAULT_APPEARANCE,
    createdAt: '2026-04-25T00:00:00.000Z',
  });
  assert.equal(bundle.scene.animations.length, 1);
  assert.equal(bundle.scene.animations[0].eventLine, 2, 'bundle preserves eventLine');
}

// counter primitive: parsing, time progression, formatting
{
  const { evaluateScene } = await import('../src/engine/primitives');
  const { Grid } = await import('../src/engine/grid');

  const counterSrc = `scene c 1s\nat 0ms counter "USERS: " from 0 to 1247 800ms ease-out`;
  const counterScene = parseScene(counterSrc);
  assert.equal(counterScene.events.length, 1, 'counter event parses');
  assert.equal(counterScene.events[0].effect, 'counter', 'effect is counter');
  assert.equal(counterScene.events[0].target, 'USERS: ', 'target keeps trailing space');
  assert.ok(counterScene.events[0].modifiers.includes('from 0 to 1247'), 'modifiers carry from/to');

  // Read the topmost row that contains a given marker substring.
  function findRowText(grid: InstanceType<typeof Grid>, marker: string): string {
    for (let r = 0; r < grid.rows; r += 1) {
      let line = '';
      for (let c = 0; c < grid.cols; c += 1) {
        line += grid.cell(c, r).char;
      }
      if (line.includes(marker)) return line.replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  const grid = new Grid(96, 36);

  evaluateScene(counterScene, grid, 0, 30);
  const startText = findRowText(grid, 'USERS:');
  assert.ok(startText.includes('USERS:'), 'counter renders label at t=0');
  assert.ok(/USERS:\s*0\b/.test(startText), `counter starts at 0, got "${startText}"`);
  assert.ok(!startText.includes('1247'), 'counter is not yet at end at t=0');

  // At end of duration (24 ticks at 30Hz = 800ms) value lands on the target.
  evaluateScene(counterScene, grid, 24, 30);
  const endText = findRowText(grid, 'USERS:');
  assert.ok(endText.includes('1,247'), `counter ends at 1,247 with thousands sep, got "${endText}"`);

  // ease-out: at midpoint (12 ticks = 400ms) value should be past the linear midpoint.
  evaluateScene(counterScene, grid, 12, 30);
  const midText = findRowText(grid, 'USERS:');
  const midDigits = midText.match(/[\d,]+/g);
  const midValue = midDigits ? Number(midDigits[midDigits.length - 1].replace(/,/g, '')) : 0;
  assert.ok(midValue > 624, `ease-out midpoint should exceed linear (623.5), got ${midValue}`);
  assert.ok(midValue < 1247, `ease-out midpoint should not exceed end value, got ${midValue}`);

  // format:k abbreviates thousands.
  const kScene = parseScene(`scene k 1s\nat 0ms counter "REQ: " from 0 to 12400 800ms format:k`);
  evaluateScene(kScene, grid, 24, 30);
  const kText = findRowText(grid, 'REQ:');
  assert.ok(kText.includes('12.4k') || kText.includes('12k'), `format:k should render 12.4k or 12k, got "${kText}"`);

  // format:pct renders percentage.
  const pctScene = parseScene(`scene p 1s\nat 0ms counter "LOAD: " from 0 to 0.87 800ms format:pct`);
  evaluateScene(pctScene, grid, 24, 30);
  const pctText = findRowText(grid, 'LOAD:');
  assert.ok(pctText.includes('87%'), `format:pct should render 87%, got "${pctText}"`);

  // counter participates in defaultEventTemplate (effect picker can add it).
  const tmpl = defaultEventTemplate('counter', 0);
  assert.equal(tmpl.effect, 'counter', 'counter has a default template');
  assert.ok(tmpl.modifiers.includes('from'), 'default template includes from/to');

  // counter is resizable: dragging a counter clip changes the duration modifier.
  const resized = resizeEventInSource({
    source: counterSrc,
    event: counterScene.events[0],
    durationMs: 1200,
  });
  assert.ok(resized.includes('1200ms'), 'resizing a counter writes a new ms duration');
  assert.ok(!resized.includes('800ms'), 'old duration removed after resize');

  // bundles preserve counter events.
  const counterBundle = buildPhosphorBundle({
    sceneName: 'with_counter',
    dsl: counterSrc,
    appearance: DEFAULT_APPEARANCE,
    createdAt: '2026-04-25T00:00:00.000Z',
  });
  assert.equal(counterBundle.scene.events[0].effect, 'counter', 'bundle preserves counter effect');
  assert.equal(counterBundle.scene.events[0].target, 'USERS: ', 'bundle preserves counter target');
}

// audio: sound: modifier extraction
{
  const { eventSound, isSoundPreset, SOUND_PRESETS } = await import('../src/engine/audio');
  assert.equal(SOUND_PRESETS.length, 6, 'six audio presets shipped');
  assert.equal(isSoundPreset('beep-high'), true);
  assert.equal(isSoundPreset('made-up'), false);

  const audioScene = parseScene(`scene a 1s\nat 0ms type "X" sound:beep-low\nat 200ms pulse "Y" amber sound:swish 400ms`);
  const beep = eventSound(audioScene.events[0]);
  const swish = eventSound(audioScene.events[1]);
  assert.equal(beep, 'beep-low', 'first event sound preset');
  assert.equal(swish, 'swish', 'second event sound preset');

  const noSoundEvent = parseScene(`scene a 1s\nat 0ms type "X" amber`).events[0];
  assert.equal(eventSound(noSoundEvent), null, 'event without sound: modifier returns null');

  const unknownSound = parseScene(`scene a 1s\nat 0ms type "X" sound:zzz`).events[0];
  assert.equal(eventSound(unknownSound), null, 'unknown sound name returns null instead of throwing');
}

// markers + flag-aware engine smoke
{
  const sceneSrc = `scene mute_test 1s\nat 0ms type "A"\nat 200ms type "B" muted\nat 400ms type "C" solo\nmark "beat" 500ms`;
  const parsed = parseScene(sceneSrc);
  assert.equal(parsed.markers.length, 1, 'marker line parses');
  const muted = parsed.events.find((e) => e.target === 'B');
  const solo = parsed.events.find((e) => e.target === 'C');
  assert.equal(muted?.flags.muted, true, 'B is muted');
  assert.equal(solo?.flags.solo, true, 'C is solo');
}

// property keyframes — parsing, sampling, easing, edit helpers, scene appearance
{
  // easing curves
  assert.equal(easingProgress('linear', 0.5), 0.5, 'linear midpoint');
  assert.equal(easingProgress('hold', 0.99), 0, 'hold stays at start until next keyframe');
  assert.ok(easingProgress('ease-in', 0.5) < 0.5, 'ease-in slows the start');
  assert.ok(easingProgress('ease-out', 0.5) > 0.5, 'ease-out front-loads progress');
  assert.equal(easingProgress('ease-in-out', 0), 0, 'ease-in-out anchors at 0');
  assert.equal(easingProgress('ease-in-out', 1), 1, 'ease-in-out anchors at 1');

  assert.equal(clampAnimatedValue('decay', 9999), 5000, 'decay clamps to its 5000ms max');
  assert.equal(clampAnimatedValue('decay', -10), 0, 'decay clamps to 0 floor');
  assert.equal(clampAnimatedValue('bloom', 50), 8, 'bloom clamps to 8 max');

  const animatedSrc = `scene anim 2s\nprop bloom 0ms 1.0 1000ms 2.5 ease-out 2000ms 0.5\nprop decay 0ms 240 1000ms 600`;
  const animatedScene = parseScene(animatedSrc);
  assert.equal(animatedScene.animations.length, 2, 'two prop lines parse');
  const bloom = animatedScene.animations.find((a) => a.property === 'bloom');
  const decay = animatedScene.animations.find((a) => a.property === 'decay');
  assert.equal(bloom?.keyframes.length, 3, 'bloom has 3 keyframes');
  assert.equal(bloom?.keyframes[1].easing, 'ease-out', 'easing token captured');
  assert.equal(decay?.keyframes[0].value, 240, 'decay starts at 240');

  // sampling
  if (bloom) {
    assert.equal(sampleAnimation(bloom, -100), 1.0, 'before-first holds first value');
    assert.equal(sampleAnimation(bloom, 99999), 0.5, 'after-last holds last value');
    assert.equal(sampleAnimation(bloom, 0), 1.0, 'sample at first keyframe');
    assert.equal(sampleAnimation(bloom, 1000), 2.5, 'sample at second keyframe');
    assert.equal(sampleAnimation(bloom, 2000), 0.5, 'sample at last keyframe');
    // mid segment 0..1000 with ease-out: at 500ms, eased(0.5) > 0.5, so value > midpoint
    const mid = sampleAnimation(bloom, 500);
    const linearMid = 1.0 + (2.5 - 1.0) * 0.5;
    assert.ok(mid > linearMid, 'ease-out pushes 500ms above linear midpoint');
  }

  // scene appearance sampling falls back to base for unanimated props
  const baseAppearance = { ...DEFAULT_APPEARANCE, decay: 240, bloom: 1.0 };
  const sampledMid = sampleSceneAppearance(animatedScene, baseAppearance, 1000);
  assert.equal(sampledMid.bloom, 2.5, 'bloom hit 2.5 at 1000ms');
  assert.equal(sampledMid.decay, 600, 'decay hit 600 at 1000ms');
  assert.equal(sampledMid.scanlines, baseAppearance.scanlines, 'unanimated scanlines stays at base');

  // formatPropertyLine round-trips through the parser
  if (bloom) {
    const formatted = formatPropertyLine(bloom);
    const reparsed = parseScene(`scene rt 2s\n${formatted}`);
    const reparsedBloom = reparsed.animations.find((a) => a.property === 'bloom');
    assert.equal(reparsedBloom?.keyframes.length, 3, 'formatted prop line round-trips');
    assert.equal(reparsedBloom?.keyframes[1].easing, 'ease-out', 'easing survives round-trip');
  }

  // dslEdit helpers: add / move / remove / setEasing / setValue
  if (bloom) {
    const inserted = addKeyframeToAnimation(animatedSrc, bloom, { at: 500, value: 1.8, easing: 'linear' });
    const insertedScene = parseScene(inserted);
    const insertedBloom = insertedScene.animations.find((a) => a.property === 'bloom');
    assert.equal(insertedBloom?.keyframes.length, 4, 'addKeyframeToAnimation inserts new');
    assert.equal(insertedBloom?.keyframes[1].at, 500, 'inserted keyframe sorted by time');

    const moved = moveKeyframe(animatedSrc, bloom, 1, 1500, 2000);
    const movedBloom = parseScene(moved).animations.find((a) => a.property === 'bloom');
    assert.equal(movedBloom?.keyframes[1].at, 1500, 'moveKeyframe shifts time');

    const valueSet = setKeyframeValue(animatedSrc, bloom, 1, 4.0);
    const valueScene = parseScene(valueSet).animations.find((a) => a.property === 'bloom');
    assert.equal(valueScene?.keyframes[1].value, 4, 'setKeyframeValue updates value');

    const easingSet = setKeyframeEasing(animatedSrc, bloom, 2, 'ease-in-out');
    const easingScene = parseScene(easingSet).animations.find((a) => a.property === 'bloom');
    assert.equal(easingScene?.keyframes[2].easing, 'ease-in-out', 'setKeyframeEasing updates easing');

    const removed = removeKeyframe(animatedSrc, bloom, 1);
    const removedBloom = parseScene(removed).animations.find((a) => a.property === 'bloom');
    assert.equal(removedBloom?.keyframes.length, 2, 'removeKeyframe drops one');

    // removing the last keyframe drops the entire prop line
    const single = `scene s 1s\nprop bloom 200ms 1.5`;
    const singleParsed = parseScene(single);
    const cleared = removeKeyframe(single, singleParsed.animations[0], 0);
    assert.equal(parseScene(cleared).animations.length, 0, 'removing the last keyframe removes the prop line');
  }

  // appendAnimation
  const blank = `scene b 1s\nat 0ms type "x"`;
  const appended = appendAnimation({
    source: blank,
    property: 'flicker',
    keyframes: [
      { at: 0, value: 0, easing: 'linear' },
      { at: 800, value: 0.6, easing: 'ease-in' },
    ],
  });
  assert.ok(appended.lineNumber !== null, 'appendAnimation returns line number');
  const appendedScene = parseScene(appended.source);
  assert.equal(appendedScene.animations.length, 1, 'appended animation parses');
  assert.equal(appendedScene.animations[0].keyframes[1].easing, 'ease-in', 'appended easing preserved');

  // unknown property fails clearly
  const bogus = parseScene(`scene b 1s\nprop zzz 0ms 1.0`);
  assert.ok(
    bogus.lines.some((line) => line.kind === 'invalid' && line.error.includes('Unknown')),
    'unknown property reports an error line',
  );
}

// Project schema: normalize, mutate, round-trip
{
  const {
    normalizeProject,
    makeEmptyProject,
    addScene,
    duplicateScene,
    patchScene,
    removeScene,
    renameScene,
    PROJECT_SCHEMA_ID,
    PROJECT_SCHEMA_VERSION,
  } = await import('../src/state/projectSchema');

  // makeEmptyProject seeds one scene, sets it active
  const empty = makeEmptyProject('Demo', DEFAULT_DSL, 'first_scene');
  assert.equal(empty.schema, PROJECT_SCHEMA_ID, 'schema id stamped');
  assert.equal(empty.schemaVersion, PROJECT_SCHEMA_VERSION, 'schema version stamped');
  assert.equal(empty.scenes.length, 1, 'starts with one scene');
  assert.equal(empty.activeSceneId, empty.scenes[0].id, 'first scene is active');
  assert.equal(empty.scenes[0].dsl, DEFAULT_DSL);
  assert.deepEqual(empty.assets, [], 'no assets initially');
  assert.deepEqual(empty.renderPresets, [], 'no presets initially');

  // addScene appends and switches active
  const withTwo = addScene(empty, { name: 'second', dsl: 'scene s 1s\nat 0ms type "x"', durationMs: 1000 });
  assert.equal(withTwo.scenes.length, 2, 'second scene added');
  assert.equal(withTwo.activeSceneId, withTwo.scenes[1].id, 'add switches active');

  // patchScene updates fields and bumps updatedAt
  const patched = patchScene(withTwo, withTwo.scenes[0].id, { name: 'renamed', dsl: 'scene renamed 1s' });
  assert.equal(patched.scenes[0].name, 'renamed');
  assert.equal(patched.scenes[0].dsl, 'scene renamed 1s');
  assert.notEqual(patched.scenes[0].updatedAt, withTwo.scenes[0].updatedAt, 'updatedAt bumps');

  // renameScene is sugar for patchScene
  const renamed = renameScene(withTwo, withTwo.scenes[0].id, 'fresh_name');
  assert.equal(renamed.scenes[0].name, 'fresh_name');

  // duplicateScene clones the dsl and gives it a new id
  const dup = duplicateScene(withTwo, withTwo.scenes[0].id);
  assert.equal(dup.scenes.length, 3, 'duplicate adds a third scene');
  assert.notEqual(dup.scenes[2].id, withTwo.scenes[0].id, 'duplicate has fresh id');
  assert.equal(dup.scenes[2].dsl, withTwo.scenes[0].dsl, 'duplicate copies dsl');
  assert.equal(dup.activeSceneId, dup.scenes[2].id, 'duplicate becomes active');

  // removeScene refuses to remove the last scene
  const removedToOne = removeScene(empty, empty.scenes[0].id);
  assert.equal(removedToOne.scenes.length, 1, 'cannot remove the only scene');

  // removeScene reassigns active when active is removed
  const afterRemove = removeScene(withTwo, withTwo.activeSceneId!);
  assert.equal(afterRemove.scenes.length, 1, 'removed scene is gone');
  assert.equal(afterRemove.activeSceneId, afterRemove.scenes[0].id, 'active reassigned');

  // normalizeProject rejects wrong schema id
  const wrongSchema = normalizeProject({ schema: 'something.else', schemaVersion: 1 });
  assert.equal(wrongSchema, null, 'wrong schema id rejected');

  // normalizeProject rejects wrong schema version
  const wrongVersion = normalizeProject({ schema: PROJECT_SCHEMA_ID, schemaVersion: 99 });
  assert.equal(wrongVersion, null, 'unknown schema version rejected');

  // normalizeProject round-trips a serialized project
  const serialized = JSON.parse(JSON.stringify(empty));
  const restored = normalizeProject(serialized);
  assert.ok(restored, 'valid project round-trips');
  assert.equal(restored?.id, empty.id, 'id preserved');
  assert.equal(restored?.scenes.length, 1);
  assert.equal(restored?.scenes[0].dsl, DEFAULT_DSL);

  // normalizeProject drops scenes with no dsl and unknown asset kinds
  const dirty = normalizeProject({
    schema: PROJECT_SCHEMA_ID,
    schemaVersion: 1,
    id: 'p1',
    name: 'Dirty',
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T00:00:00.000Z',
    scenes: [
      { id: 's1', name: 'ok', dsl: 'scene ok 1s\nat 0ms type "x"', durationMs: 1000, createdAt: '', updatedAt: '' },
      { id: 's2', name: 'broken', dsl: '', durationMs: 0, createdAt: '', updatedAt: '' },
      'not an object',
    ],
    assets: [
      { id: 'a1', kind: 'text', name: 'snippet', text: 'hi', createdAt: '', updatedAt: '' },
      { id: 'a2', kind: 'unknown-future-kind', name: 'mystery', createdAt: '', updatedAt: '' },
      { id: 'a3', kind: 'palette', name: 'no-tones', createdAt: '', updatedAt: '' }, // missing tones
    ],
  });
  assert.ok(dirty, 'partially-broken project still loads');
  assert.equal(dirty?.scenes.length, 1, 'empty-dsl scene dropped');
  assert.equal(dirty?.assets.length, 1, 'unknown asset kind + palette without tones dropped');
  assert.equal(dirty?.assets[0].kind, 'text');

  // Forward-compat: unknown future asset kind is silently dropped, not crashed on
  const future = normalizeProject({
    schema: PROJECT_SCHEMA_ID,
    schemaVersion: 1,
    id: 'p2',
    name: 'F',
    createdAt: '',
    updatedAt: '',
    scenes: [{ id: 's', name: 'ok', dsl: 'scene ok 1s', durationMs: 1000, createdAt: '', updatedAt: '' }],
    assets: [{ id: 'a', kind: 'video', name: 'oops', createdAt: '', updatedAt: '' }],
    renderPresets: [{ id: 'r', name: 'bad-target', target: 'unknown-target', createdAt: '' }],
    futureField: 'whatever', // unknown top-level field tolerated
  });
  assert.ok(future, 'forward-compat: unknown asset/preset/top-level fields tolerated');
  assert.equal(future?.assets.length, 0, 'unknown asset kind dropped');
  assert.equal(future?.renderPresets.length, 0, 'unknown render target dropped');
}

// Asset CRUD + DSL conversion
{
  const {
    addAsset,
    addScene: addScene2,
    makeEmptyProject,
    patchAsset,
    removeAsset,
    renameAsset,
    DEFAULT_PALETTE,
  } = await import('../src/state/projectSchema');
  const {
    applyDataAssetToSource,
    assetToEventLines,
    insertEventLinesIntoSource,
    assetPreview,
  } = await import('../src/state/assetUtils');

  // addAsset / patchAsset / renameAsset / removeAsset
  const empty = makeEmptyProject('A', 'scene a 1s\nat 0ms type "x"', 'a');
  const withText = addAsset(empty, { kind: 'text', text: 'SYSTEM ONLINE' }, 'snippet1');
  assert.equal(withText.assets.length, 1, 'asset added');
  assert.equal(withText.assets[0].kind, 'text', 'kind preserved');

  const renamed = renameAsset(withText, withText.assets[0].id, 'system_message');
  assert.equal(renamed.assets[0].name, 'system_message');

  const patched = patchAsset(renamed, renamed.assets[0].id, { kind: 'text', text: 'NEW TEXT' });
  assert.equal(patched.assets[0].kind === 'text' && patched.assets[0].text === 'NEW TEXT', true);

  const removed = removeAsset(patched, patched.assets[0].id);
  assert.equal(removed.assets.length, 0, 'asset removed');

  // assetToEventLines: text snippet → single line, sanitized
  const textAsset = renamed.assets[0];
  const lines = assetToEventLines(textAsset, 0);
  assert.deepEqual(lines, ['at 0ms type "SYSTEM ONLINE" slowly']);
  assert.equal(assetPreview(textAsset).startsWith('SYSTEM ONLINE'), true);

  // assetToEventLines: ascii art → staggered lines
  const asciiAsset = addAsset(empty, { kind: 'ascii', lines: ['LINE A', 'LINE B', 'LINE C'] }, 'frame1').assets[0];
  const asciiLines = assetToEventLines(asciiAsset, 1000);
  assert.equal(asciiLines.length, 3, 'one line per ascii row');
  assert.ok(asciiLines[0].startsWith('at 1000ms type "LINE A"'));
  assert.ok(asciiLines[1].startsWith('at 1200ms type "LINE B"'));
  assert.ok(asciiLines[2].startsWith('at 1400ms type "LINE C"'));

  // insertEventLinesIntoSource: appends to end
  const sceneSource = `scene boot 1s\nat 0ms type "ABC"`;
  const inserted = insertEventLinesIntoSource(sceneSource, ['at 500ms type "INSERTED"']);
  const insertedScene = parseScene(inserted);
  assert.equal(insertedScene.events.length, 2, 'inserted line is now an event');
  assert.equal(insertedScene.events[1].target, 'INSERTED');

  // applyDataAssetToSource: injects data line right after scene header
  const baseScene = `scene s 1s\nat 0ms type "x"`;
  const dataAsset = { users: 5, status: 'ok' };
  const withData = applyDataAssetToSource(baseScene, dataAsset);
  const dataParsed = parseScene(withData);
  assert.deepEqual(dataParsed.data, dataAsset, 'data block parsed back into project');
  // No duplication on second apply
  const reapplied = applyDataAssetToSource(withData, { users: 99 });
  const reparsed = parseScene(reapplied);
  assert.deepEqual(reparsed.data, { users: 99 }, 'second apply replaces, not duplicates');
  assert.equal(
    reparsed.lines.filter((line) => line.kind === 'data').length,
    1,
    'only one data line after reapply',
  );

  // Palette asset survives normalize round-trip
  const paletteProject = addAsset(empty, { kind: 'palette', tones: DEFAULT_PALETTE }, 'phosphor_default');
  assert.equal(paletteProject.assets[0].kind, 'palette');
  if (paletteProject.assets[0].kind === 'palette') {
    assert.equal(paletteProject.assets[0].tones.phos, '#D6F04A');
  }

  // Project with multiple scenes + assets round-trips through normalizeProject
  const richProject = addScene2(
    addAsset(empty, { kind: 'data', data: { x: 1 } }, 'config'),
    { name: 'second', dsl: 'scene s 1s\nat 0ms type "y"', durationMs: 1000 },
  );
  const { normalizeProject } = await import('../src/state/projectSchema');
  const ser = JSON.parse(JSON.stringify(richProject));
  const restored = normalizeProject(ser);
  assert.ok(restored, 'rich project normalizes');
  assert.equal(restored?.scenes.length, 2);
  assert.equal(restored?.assets.length, 1);
  assert.equal(restored?.assets[0].kind, 'data');
}

console.log(
  `export smoke passed: ${bundle.scene.events.length} events, loop URL ${loopResult.encodedLength}B/${loopResult.bytes}B, svg poster ${svg.length}B / animated ${animatedSvg.length}B`,
);
