export type {
  Appearance,
  PreviewChrome,
  PreviewMode,
  ProviderKind,
  RendererKind,
  TickRate,
} from '../engine/types';

export type PhosphorFont = 'vt323' | 'plex' | 'jet' | 'atkinson' | 'fira' | 'space';

export type DirectorMessage = {
  id: string;
  role: 'user' | 'director';
  text: string;
  at: string;
};

export type DirectorProposal = {
  id: string;
  dsl: string;
  provider: string;
  model: string;
  mock: boolean;
  notes?: string;
};
