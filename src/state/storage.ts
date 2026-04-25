import { DEFAULT_APPEARANCE, type Appearance, type ProviderKind, type RendererKind } from '../engine/types';
import { DEFAULT_MODEL_PROVIDERS, normalizeProviderConfig, type ModelProviderConfig } from './modelProviders';

const APPEARANCE_KEY = 'phosphor.appearance';
const RENDERER_KEY = 'phosphor.renderer';
const PROVIDER_KEY = 'phosphor.provider';
const MODEL_PROVIDERS_KEY = 'phosphor.modelProviders';

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
