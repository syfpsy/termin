import {
  PHOSPHOR_BUNDLE_MIME,
  serializePhosphorBundle,
  type PhosphorBundle,
} from './bundle';

export type HtmlEmbedInput = {
  bundle: PhosphorBundle;
  playerSource: string;
};

export function renderPhosphorEmbedHtml({ bundle, playerSource }: HtmlEmbedInput): string {
  const safePlayer = escapeScriptContent(playerSource);
  const safeBundle = escapeScriptContent(serializePhosphorBundle(bundle));
  const title = escapeHtml(bundle.scene.name || 'Phosphor Scene');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="phosphor ${bundle.runtime.engineVersion}">
<title>${title}</title>
<style>
html,body{margin:0;height:100%;background:#050604;overflow:hidden;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
body{display:grid;place-items:center;color:#d6f04a}
phosphor-player{inline-size:min(100vw,960px);aspect-ratio:4/3;display:block}
</style>
</head>
<body>
<phosphor-player>
<script type="${PHOSPHOR_BUNDLE_MIME}">
${safeBundle}</script>
</phosphor-player>
<script type="module">
${safePlayer}
</script>
</body>
</html>
`;
}

function escapeScriptContent(value: string) {
  return value.replace(/<\/(script)/gi, '<\\/$1');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}
