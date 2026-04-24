import type { ProviderKind } from '../engine/types';

export type ModelProviderConfig = {
  provider: ProviderKind;
  label: string;
  apiKey: string;
  model: string;
  baseUrl?: string;
  note: string;
};

export const PROVIDER_ORDER: ProviderKind[] = ['anthropic', 'openrouter', 'deepseek', 'openai', 'mock'];

export const DEFAULT_MODEL_PROVIDERS: Record<ProviderKind, ModelProviderConfig> = {
  anthropic: {
    provider: 'anthropic',
    label: 'Anthropic',
    apiKey: '',
    model: 'claude-sonnet-4-20250514',
    note: 'Best default for readable DSL drafting and motion-direction edits.',
  },
  openrouter: {
    provider: 'openrouter',
    label: 'OpenRouter',
    apiKey: '',
    model: 'openrouter/auto',
    baseUrl: 'https://openrouter.ai/api/v1',
    note: 'Broker for many hosted models; useful when you want to compare providers quickly.',
  },
  deepseek: {
    provider: 'deepseek',
    label: 'DeepSeek',
    apiKey: '',
    model: 'deepseek-chat',
    baseUrl: 'https://api.deepseek.com',
    note: 'Good cost/performance option for notation rewrites and structured edits.',
  },
  openai: {
    provider: 'openai',
    label: 'OpenAI',
    apiKey: '',
    model: 'gpt-5.2',
    note: 'Strong general fallback for creative coding and instruction following.',
  },
  mock: {
    provider: 'mock',
    label: 'Mock',
    apiKey: '',
    model: 'local-rule-director',
    note: 'Offline deterministic fallback. No external request or key required.',
  },
};

export function normalizeProviderConfig(config: Partial<ModelProviderConfig> & { provider: ProviderKind }): ModelProviderConfig {
  const defaults = DEFAULT_MODEL_PROVIDERS[config.provider];
  return {
    ...defaults,
    ...config,
    apiKey: config.provider === 'mock' ? '' : (config.apiKey ?? ''),
    model: config.model?.trim() || defaults.model,
  };
}

export function providerHasUserKey(config: ModelProviderConfig) {
  return config.provider === 'mock' || config.apiKey.trim().length > 0;
}
