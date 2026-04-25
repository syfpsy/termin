import { Bot, Check, Eye, FileCode2, GitCompareArrows, RefreshCw, Send, WandSparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { requestDirector } from '../director/client';
import type { ProviderKind } from '../engine/types';
import { DEFAULT_MODEL_PROVIDERS, providerHasUserKey, PROVIDER_ORDER, type ModelProviderConfig } from '../state/modelProviders';
import type { DirectorMessage, DirectorProposal } from '../state/types';
import { Button, Panel } from './components';
import { diffLines } from './lineDiff';

type DirectorPanelProps = {
  dsl: string;
  provider: ProviderKind;
  providerConfig: ModelProviderConfig;
  providerConfigs: Record<ProviderKind, ModelProviderConfig>;
  onProviderChange: (provider: ProviderKind) => void;
  onCommit: (proposal: DirectorProposal) => void;
  onPreview: (proposal: DirectorProposal) => void;
};

const SUGGESTIONS = ['add glitch burst', 'slow it down', 'loop it', 'make 1-bit'];

type ProviderStatus = {
  provider: ProviderKind;
  anthropic: boolean;
  openrouter: boolean;
  deepseek: boolean;
  openai: boolean;
  models: {
    anthropic: string;
    openrouter: string;
    deepseek: string;
    openai: string;
  };
};

export function DirectorPanel({ dsl, provider, providerConfig, providerConfigs, onProviderChange, onCommit, onPreview }: DirectorPanelProps) {
  const configs = providerConfigs ?? DEFAULT_MODEL_PROVIDERS;
  const activeConfig = providerConfig ?? configs[provider] ?? DEFAULT_MODEL_PROVIDERS[provider];
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<DirectorMessage[]>([
    {
      id: 'welcome',
      role: 'director',
      text: 'Describe the motion. I will draft .me notation you can preview, commit, or rewrite.',
      at: formatClock(),
    },
  ]);
  const [proposal, setProposal] = useState<DirectorProposal | null>(null);
  const [proposalView, setProposalView] = useState<'diff' | 'full'>('diff');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);

  const proposalDiff = useMemo(
    () => (proposal ? diffLines(dsl, proposal.dsl) : null),
    [dsl, proposal],
  );

  useEffect(() => {
    let cancelled = false;
    fetch('/api/providers')
      .then((response) => (response.ok ? response.json() : null))
      .then((nextStatus: ProviderStatus | null) => {
        if (!cancelled) setStatus(nextStatus);
      })
      .catch(() => {
        if (!cancelled) setStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function runPrompt(prompt: string) {
    const text = prompt.trim();
    if (!text || pending) return;

    const userMessage: DirectorMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      at: formatClock(),
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setPending(true);
    setError(null);

    try {
      const nextProposal = await requestDirector({
        prompt: text,
        currentDsl: dsl,
        provider,
        providerConfig: {
          apiKey: activeConfig.apiKey,
          model: activeConfig.model,
          baseUrl: activeConfig.baseUrl,
        },
        history: [...messages, userMessage],
      });
      setProposal(nextProposal);
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'director',
          text: nextProposal.mock
            ? `Drafted with ${nextProposal.model}. Add an API key when you want a live model.`
            : `Drafted with ${nextProposal.model}. Preview it before committing if you want to compare.`,
          at: formatClock(),
        },
      ]);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Director request failed.';
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel
      title="DIRECTOR"
      tone="cyan"
      flags={provider}
      flush
      className="director-panel"
      tools={
        <select className="provider-select" value={provider} onChange={(event) => onProviderChange(event.target.value as ProviderKind)}>
          {PROVIDER_ORDER.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      }
      footer="Ctrl+Enter run - preview does not commit"
    >
      <div className="director-log">
        <div className="provider-status">
          <span data-ready={providerHasUserKey(configs.anthropic) || Boolean(status?.anthropic)}>anthropic {configs.anthropic.model || status?.models.anthropic}</span>
          <span data-ready={providerHasUserKey(configs.openrouter) || Boolean(status?.openrouter)}>openrouter {configs.openrouter.model || status?.models.openrouter}</span>
          <span data-ready={providerHasUserKey(configs.deepseek) || Boolean(status?.deepseek)}>deepseek {configs.deepseek.model || status?.models.deepseek}</span>
          <span data-ready={providerHasUserKey(configs.openai) || Boolean(status?.openai)}>openai {configs.openai.model || status?.models.openai}</span>
          <span data-ready={provider === 'mock'}>fallback mock</span>
        </div>
        {messages.map((message) => (
          <div key={message.id} className={`chat-turn chat-turn--${message.role}`}>
            <div className="chat-turn__meta">
              {message.role === 'director' ? 'director' : 'you'} - {message.at}
            </div>
            <div className="chat-turn__text">{message.text}</div>
          </div>
        ))}
        {pending && (
          <div className="director-thinking">
            <span />
            drafting
          </div>
        )}
        {error && <div className="director-error">{error}</div>}
        {proposal && (
          <div className="proposal-card">
            <div className="proposal-card__meta">
              <Bot size={13} /> proposed - {proposal.provider} / {proposal.model}
              {proposalDiff && (
                <span className="proposal-card__diff-stats">
                  +{proposalDiff.added} −{proposalDiff.removed}
                </span>
              )}
              <span className="proposal-card__view">
                <button
                  type="button"
                  className={proposalView === 'diff' ? 'is-active' : ''}
                  onClick={() => setProposalView('diff')}
                  aria-pressed={proposalView === 'diff'}
                  title="Show changes from current scene"
                >
                  <GitCompareArrows size={11} /> diff
                </button>
                <button
                  type="button"
                  className={proposalView === 'full' ? 'is-active' : ''}
                  onClick={() => setProposalView('full')}
                  aria-pressed={proposalView === 'full'}
                  title="Show full proposed scene"
                >
                  <FileCode2 size={11} /> full
                </button>
              </span>
            </div>
            {proposalView === 'diff' && proposalDiff ? (
              <pre className="proposal-card__diff" aria-label="Proposed changes">
                {proposalDiff.rows.map((row, index) => (
                  <span key={index} className={`proposal-diff-line proposal-diff-line--${row.kind}`}>
                    <span className="proposal-diff-line__sigil" aria-hidden="true">
                      {row.kind === 'add' ? '+' : row.kind === 'remove' ? '−' : ' '}
                    </span>
                    <span className="proposal-diff-line__text">{row.text || '\u00A0'}</span>
                  </span>
                ))}
              </pre>
            ) : (
              <pre>{proposal.dsl}</pre>
            )}
            {proposal.notes && <small>{proposal.notes}</small>}
            <div className="proposal-card__actions">
              <Button tone="prim" icon={<Check size={13} />} onClick={() => onCommit(proposal)}>
                commit
              </Button>
              <Button icon={<RefreshCw size={13} />} onClick={() => runPrompt(`Rewrite this more cleanly:\n${proposal.dsl}`)}>
                rewrite
              </Button>
              <Button icon={<Eye size={13} />} onClick={() => onPreview(proposal)}>
                preview only
              </Button>
            </div>
          </div>
        )}
      </div>

      <form
        className="director-input"
        onSubmit={(event) => {
          event.preventDefault();
          void runPrompt(input);
        }}
      >
        <div className="director-input__box">
          <WandSparkles size={14} />
          <textarea
            value={input}
            placeholder="describe a motion..."
            aria-label="Director prompt"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                void runPrompt(input);
              }
            }}
          />
          <Button type="submit" tone="prim" icon={<Send size={13} />} disabled={pending}>
            run
          </Button>
        </div>
        <div className="suggestions">
          {SUGGESTIONS.map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => void runPrompt(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </form>
    </Panel>
  );
}

function formatClock() {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
}
