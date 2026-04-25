export type LibraryScene = {
  id: string;
  shelf: 'boot' | 'loading' | 'transitions' | 'alerts' | 'reveals' | 'backdrops';
  name: string;
  description: string;
  dsl: string;
};

const HANDMADE_SCENES: LibraryScene[] = [
  {
    id: 'boot-sequence',
    shelf: 'boot',
    name: 'Boot Sequence',
    description: 'Staggered OK lines, amber warmup, glitch settle.',
    dsl: `scene boot_sequence_v3 2.4s
# three status OKs stagger in, typed one glyph per tick
at 0ms type "[OK] phosphor buffer - 240x67 cells" slowly
at 400ms type "[OK] palette loaded - 6 tones"
at 800ms type "[OK] clock locked - 30 Hz"

# warming beat
at 1200ms pulse "[..] warming phosphor" amber 600ms
at 2000ms glitch "SYSTEM READY" 80ms burst
at 2080ms reveal "> SYSTEM READY"
at 2080ms cursor "_" blink 500ms`,
  },
  {
    id: 'standby-loop',
    shelf: 'loading',
    name: 'Standby Loop',
    description: 'Subtle signal carrier with a cursor anchor.',
    dsl: `scene standby_loop 2s
# a soft repeating terminal standby
at 0ms reveal "STANDBY"
at 200ms loop "<<< >>> <<< >>> <<< >>>"
at 400ms wave "signal carrier locked" 1600ms
at 1600ms cursor "_" blink 400ms`,
  },
  {
    id: 'fault-alert',
    shelf: 'alerts',
    name: 'Fault Alert',
    description: 'Abrupt red shake and corruption burst.',
    dsl: `scene fault_alert 1.8s
# hard terminal warning
at 0ms type "SYSTEM FAULT" slowly red
at 600ms shake "SYSTEM FAULT" 3px 220ms
at 760ms glitch "BUFFER OVERFLOW" 140ms burst
at 980ms flash "screen" 80ms red
at 1160ms reveal "> RETRY / ABORT"
at 1160ms cursor "_" blink 500ms`,
  },
  {
    id: 'data-wipe',
    shelf: 'reveals',
    name: 'Data Wipe',
    description: 'Dither field resolves into a diagonal reveal.',
    dsl: `scene data_wipe 2.6s
# field appears as ordered phosphor, then resolves
at 0ms dither ramp 0->1 bayer4 900ms
at 600ms scan-line row 18 500ms
at 1100ms wipe "ARCHIVE RESTORED" diagonal 700ms
at 1900ms trail "*" path(8,25 12,23 18,22 26,20 38,19 52,17 70,15) 50ms/step
at 2300ms reveal "> ARCHIVE RESTORED"`,
  },
  {
    id: 'status-panel',
    shelf: 'reveals',
    name: 'Status Panel',
    description: 'Data-driven scene: edit the JSON, the readout updates live.',
    dsl: `scene status_panel 2s
data { "users": 1247, "requests": "892k", "service": { "online": 5, "name": "auth" } }
# mix template values with literal text — substitution happens at parse time
at 0ms    type "USERS: {{users}}" slowly
at 500ms  type "REQUESTS: {{requests}}"
at 950ms  pulse "{{service.name}} - {{service.online}} online" amber 600ms
at 1700ms reveal "> ALL SYSTEMS NOMINAL"`,
  },
  {
    id: 'stat-counter',
    shelf: 'reveals',
    name: 'Stat Counter',
    description: 'Numbers roll up — pair with the data block for live dashboards.',
    dsl: `scene stat_counter 2.4s
data { "service": "auth" }
# counter animates digits; ease-out makes the run-up feel decisive
at 0ms    counter "USERS: "  from 0 to 1247 900ms ease-out
at 200ms  counter "REQ: "    from 0 to 12400 900ms ease-out format:k
at 400ms  counter "LOAD: "   from 0 to 0.87 700ms ease-out format:pct
at 1300ms pulse "{{service}} cluster steady" amber 500ms
at 1900ms reveal "> SNAPSHOT CAPTURED"`,
  },
];

const SHELF_TARGETS: Record<LibraryScene['shelf'], number> = {
  boot: 18,
  loading: 17,
  transitions: 16,
  alerts: 16,
  reveals: 16,
  backdrops: 16,
};

export const SCENE_LIBRARY: LibraryScene[] = buildLibrary();

function buildLibrary() {
  const scenes = [...HANDMADE_SCENES];
  const counts = new Map<LibraryScene['shelf'], number>();

  for (const scene of scenes) {
    counts.set(scene.shelf, (counts.get(scene.shelf) ?? 0) + 1);
  }

  for (const [shelf, target] of Object.entries(SHELF_TARGETS) as Array<[LibraryScene['shelf'], number]>) {
    let index = counts.get(shelf) ?? 0;
    while (index < target) {
      index += 1;
      scenes.push(makeScene(shelf, index));
    }
  }

  return scenes;
}

function makeScene(shelf: LibraryScene['shelf'], index: number): LibraryScene {
  const pad = index.toString().padStart(2, '0');
  const id = `${shelf}-${pad}`;
  const title = titleCase(`${shelf} ${pad}`);

  if (shelf === 'boot') {
    return {
      id,
      shelf,
      name: title,
      description: 'Boot status sequence with a typed lock line.',
      dsl: `scene boot_${pad} 2.4s
# generated boot shelf starter
at 0ms type "[OK] kernel lane ${pad}" slowly
at 420ms type "[OK] phosphor bank armed"
at 840ms type "[OK] clock locked - 30 Hz"
at 1260ms pulse "[..] warming raster" amber 560ms
at 2020ms reveal "> BOOT ${pad} READY"
at 2020ms cursor "_" blink 500ms`,
    };
  }

  if (shelf === 'loading') {
    return {
      id,
      shelf,
      name: title,
      description: 'Reusable loading loop with carrier motion.',
      dsl: `scene loading_${pad} 2s
# generated loading shelf starter
at 0ms reveal "LOADING BANK ${pad}"
at 220ms loop "<<< >>> <<< >>>"
at 420ms wave "carrier ${pad} locked" 1300ms
at 1500ms pulse "awaiting signal" cyan 450ms`,
    };
  }

  if (shelf === 'transitions') {
    return {
      id,
      shelf,
      name: title,
      description: 'Diagonal wipe with a scan sweep.',
      dsl: `scene transition_${pad} 1.8s
# generated transition shelf starter
at 0ms scan-line row ${8 + (index % 18)} 420ms
at 320ms wipe "CHANNEL ${pad}" diagonal 700ms
at 1180ms reveal "> CHANNEL ${pad}"
at 1420ms flash "screen" 70ms`,
    };
  }

  if (shelf === 'alerts') {
    return {
      id,
      shelf,
      name: title,
      description: 'Warning beat with shake, glitch, and recovery.',
      dsl: `scene alert_${pad} 1.9s
# generated alert shelf starter
at 0ms type "ALERT ${pad}" slowly red
at 560ms shake "ALERT ${pad}" 3px 180ms
at 720ms glitch "SIGNAL FAULT ${pad}" 110ms burst
at 1120ms reveal "> ACK REQUIRED"
at 1120ms cursor "_" blink 450ms`,
    };
  }

  if (shelf === 'reveals') {
    return {
      id,
      shelf,
      name: title,
      description: 'Type reveal over ordered dither.',
      dsl: `scene reveal_${pad} 2.2s
# generated reveal shelf starter
at 0ms dither ramp 0->1 bayer4 800ms
at 620ms type "REVEAL ${pad}" slowly
at 1320ms pulse "resolved" amber 420ms
at 1760ms reveal "> REVEAL ${pad} COMPLETE"`,
    };
  }

  return {
    id,
    shelf,
    name: title,
    description: 'Ambient phosphor backdrop with trail motion.',
    dsl: `scene backdrop_${pad} 2.6s
# generated backdrop shelf starter
at 0ms dither ramp 0->1 bayer4 1000ms
at 420ms trail "*" path(8,25 14,23 22,22 34,20 48,18 66,16) 55ms/step
at 1200ms wave "background carrier ${pad}" 1300ms
at 2100ms pulse "field stable" cyan 360ms`,
  };
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}
