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
  addMarkerToSource,
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
  pasteEventLines,
  patchEventInSource,
  rescaleEventsInSource,
  resizeEventInSource,
  setDurationModifier,
  setEventFlagInSource,
  setFlagInModifiers,
  splitEventAtMs,
  stripFlagsFromModifiers,
} from '../src/engine/dslEdit';

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

console.log(
  `export smoke passed: ${bundle.scene.events.length} events, loop URL ${loopResult.encodedLength}B/${loopResult.bytes}B, svg poster ${svg.length}B / animated ${animatedSvg.length}B`,
);
