import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type Provider = 'mock' | 'anthropic' | 'openai';

export type DirectorRequest = {
  prompt?: string;
  currentDsl?: string;
  provider?: Provider;
  history?: Array<{ role: string; text: string }>;
};

export const SYSTEM_PROMPT = `You are the Phosphor Director, an AI-native motion design collaborator.

Return only Phosphor .me notation. Do not use Markdown fences. Do not add prose before or after the notation.

Syntax:
scene scene_name 2.4s
# comments narrate intent
at 0ms type "text" slowly
at 400ms pulse "text" amber 600ms
at 800ms glitch "text" 80ms burst
at 880ms reveal "text"
at 880ms cursor "_" blink 500ms

Rules:
- One line is one event.
- Use time anchors, not nested blocks.
- Keep the DSL readable like stage directions.
- No variables or expressions.
- Preserve valid useful lines from the user's current scene unless the user asks to replace them.
- Invalid or unknown effects are worse than a smaller valid scene.
- Prefer these effects for now: type, pulse, glitch, reveal, cursor, flash, scan-line, dither, wave, wipe, trail, loop, shake.`;

export function providerStatus() {
  return {
    provider: selectedProvider(),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY),
    models: {
      anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      openai: process.env.OPENAI_MODEL || 'gpt-5.2',
    },
  };
}

export async function completeDsl(provider: Provider, body: DirectorRequest) {
  const prompt = body.prompt?.trim() || 'Improve the current scene.';
  const currentDsl = body.currentDsl?.trim() || '';
  const userPrompt = buildUserPrompt(prompt, currentDsl);

  if (provider === 'anthropic' && process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model,
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });
    return {
      dsl: response.content
        .map((part) => (part.type === 'text' ? part.text : ''))
        .join('')
        .trim(),
      provider: 'anthropic',
      model,
      mock: false,
    };
  }

  if (provider === 'openai' && process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || 'gpt-5.2';
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.create({
      model,
      instructions: SYSTEM_PROMPT,
      input: userPrompt,
      max_output_tokens: 1200,
    });
    return {
      dsl: response.output_text.trim(),
      provider: 'openai',
      model,
      mock: false,
    };
  }

  return {
    dsl: mockDirector(prompt, currentDsl),
    provider: 'mock',
    model: 'local-rule-director',
    mock: true,
    notes: provider === 'mock' ? 'Mock director selected.' : `No ${provider} API key found; used mock director fallback.`,
  };
}

export function selectedProvider(): Provider {
  const provider = process.env.PHOSPHOR_AI_PROVIDER;
  if (provider === 'anthropic' || provider === 'openai' || provider === 'mock') return provider;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'mock';
}

function buildUserPrompt(prompt: string, currentDsl: string) {
  return `User request:
${prompt}

Current scene:
${currentDsl || '(empty)'}`;
}

function mockDirector(prompt: string, currentDsl: string) {
  const lower = prompt.toLowerCase();

  if (lower.includes('dither') || lower.includes('wipe')) {
    return `scene data_wipe 2.6s
# field appears as ordered phosphor, then resolves
at 0ms dither ramp 0->1 bayer4 900ms
at 600ms scan-line row 18 500ms
at 1100ms wipe "ARCHIVE RESTORED" diagonal 700ms
at 1900ms trail "*" path(8,25 12,23 18,22 26,20 38,19 52,17 70,15) 50ms/step
at 2300ms reveal "> ARCHIVE RESTORED"`;
  }

  if (lower.includes('glitch') || lower.includes('ready') || lower.includes('boot')) {
    return `scene boot_sequence_v3 2.4s
# status lines stagger in at the terminal tick rate
at 0ms type "[OK] phosphor buffer - 240x67 cells" slowly
at 400ms type "[OK] palette loaded - 6 tones"
at 800ms type "[OK] clock locked - 30 Hz"

# warming beat before the final reveal
at 1200ms pulse "[..] warming phosphor" amber 600ms

# corrupt the final title briefly, then settle
at 2000ms glitch "SYSTEM READY" 80ms burst
at 2080ms reveal "> SYSTEM READY"
at 2080ms cursor "_" blink 500ms`;
  }

  if (lower.includes('loop')) {
    return `scene standby_loop 2s
# calm repeating standby signal
at 0ms reveal "STANDBY"
at 200ms loop "<<< >>> <<< >>>"
at 400ms wave "signal carrier locked" 1200ms
at 1600ms cursor "_" blink 400ms`;
  }

  return (
    currentDsl ||
    `scene first_signal 2s
# first signal drafted by the local director fallback
at 0ms type "PHOSPHOR ONLINE" slowly
at 900ms pulse "signal stable" amber 500ms
at 1500ms reveal "> READY"
at 1500ms cursor "_" blink 500ms`
  );
}
