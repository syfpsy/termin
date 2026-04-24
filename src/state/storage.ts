import { DEFAULT_DSL } from '../engine/dsl';
import { DEFAULT_APPEARANCE, type Appearance, type ProviderKind, type RendererKind } from '../engine/types';
import { DEFAULT_MODEL_PROVIDERS, normalizeProviderConfig, type ModelProviderConfig } from './modelProviders';

const DSL_KEY = 'phosphor.scene.dsl';
const APPEARANCE_KEY = 'phosphor.appearance';
const RENDERER_KEY = 'phosphor.renderer';
const PROVIDER_KEY = 'phosphor.provider';
const MODEL_PROVIDERS_KEY = 'phosphor.modelProviders';
const RECENTS_KEY = 'phosphor.recents';

export type RecentScene = {
  id: string;
  name: string;
  dsl: string;
  updatedAt: number;
};

export function loadDsl() {
  return localStorage.getItem(DSL_KEY) ?? DEFAULT_DSL;
}

export function saveDsl(dsl: string) {
  localStorage.setItem(DSL_KEY, dsl);
}

export function loadAppearance(): Appearance {
  const raw = localStorage.getItem(APPEARANCE_KEY);
  if (!raw) return DEFAULT_APPEARANCE;
  try {
    return { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) } satisfies Appearance;
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function saveAppearance(appearance: Appearance) {
  localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
}

export function loadRenderer(): RendererKind {
  const renderer = localStorage.getItem(RENDERER_KEY);
  return renderer === 'canvas' || renderer === 'webgl' ? renderer : 'webgl';
}

export function saveRenderer(renderer: RendererKind) {
  localStorage.setItem(RENDERER_KEY, renderer);
}

export function loadProvider(): ProviderKind {
  const provider = localStorage.getItem(PROVIDER_KEY);
  return provider === 'anthropic' || provider === 'openrouter' || provider === 'deepseek' || provider === 'openai' || provider === 'mock' ? provider : 'anthropic';
}

export function saveProvider(provider: ProviderKind) {
  localStorage.setItem(PROVIDER_KEY, provider);
}

export function loadModelProviders(): Record<ProviderKind, ModelProviderConfig> {
  const raw = localStorage.getItem(MODEL_PROVIDERS_KEY);
  if (!raw) return DEFAULT_MODEL_PROVIDERS;
  try {
    const parsed = JSON.parse(raw) as Partial<Record<ProviderKind, ModelProviderConfig>>;
    return {
      anthropic: normalizeProviderConfig({ provider: 'anthropic', ...parsed.anthropic }),
      openrouter: normalizeProviderConfig({ provider: 'openrouter', ...parsed.openrouter }),
      deepseek: normalizeProviderConfig({ provider: 'deepseek', ...parsed.deepseek }),
      openai: normalizeProviderConfig({ provider: 'openai', ...parsed.openai }),
      mock: normalizeProviderConfig({ provider: 'mock', ...parsed.mock }),
    };
  } catch {
    return DEFAULT_MODEL_PROVIDERS;
  }
}

export function saveModelProviders(configs: Record<ProviderKind, ModelProviderConfig>) {
  localStorage.setItem(MODEL_PROVIDERS_KEY, JSON.stringify(configs));
}

export function loadRecentScenes(): RecentScene[] {
  const raw = localStorage.getItem(RECENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as RecentScene[];
    return Array.isArray(parsed) ? parsed.filter((scene) => scene.dsl && scene.name) : [];
  } catch {
    return [];
  }
}

export function touchRecentScene(name: string, dsl: string): RecentScene[] {
  const current = loadRecentScenes();
  const id = stableRecentId(name, dsl);
  const next = [
    {
      id,
      name: name || 'untitled_scene',
      dsl,
      updatedAt: Date.now(),
    },
    ...current.filter((scene) => scene.id !== id),
  ].slice(0, 8);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

function stableRecentId(name: string, dsl: string) {
  const stableName = (name || 'untitled_scene').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  if (stableName !== 'untitled_scene') return stableName;
  let hash = 0;
  for (let index = 0; index < dsl.length; index += 1) hash = (hash * 31 + dsl.charCodeAt(index)) >>> 0;
  return `${stableName}-${hash.toString(16)}`;
}
