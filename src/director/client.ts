import type { DirectorMessage, DirectorProposal } from '../state/types';
import type { Appearance, ProviderKind } from '../engine/types';

export type DirectorRequest = {
  prompt: string;
  currentDsl: string;
  provider: ProviderKind;
  history: DirectorMessage[];
};

export async function requestDirector(request: DirectorRequest): Promise<DirectorProposal> {
  const response = await fetch('/api/director', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Director request failed with ${response.status}`);
  }

  const json = (await response.json()) as Omit<DirectorProposal, 'id'>;
  return {
    id: crypto.randomUUID(),
    ...json,
  };
}

export function exportMeFile(sceneName: string, dsl: string) {
  downloadBlob(`${sceneName || 'phosphor_scene'}.me`, dsl, 'text/plain;charset=utf-8');
}

export function exportHtmlEmbed(sceneName: string, dsl: string, appearance: Appearance) {
  const safeDsl = JSON.stringify(dsl).replace(/<\/script/gi, '<\\/script');
  const safeAppearance = JSON.stringify({
    decay: appearance.decay,
    bloom: appearance.bloom,
    scanlines: appearance.scanlines,
    mode: appearance.mode,
    tickRate: appearance.tickRate,
  });
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(sceneName || 'Phosphor Scene')}</title>
<style>
html,body{margin:0;width:100%;height:100%;background:#050604;overflow:hidden}
body{display:grid;place-items:center}
canvas{width:min(100vw,960px);aspect-ratio:4/3;background:#050604}
</style>
</head>
<body>
<canvas id="phosphor" width="960" height="720"></canvas>
<script>
const DSL=${safeDsl};
const APPEARANCE=${safeAppearance};
const T={phos:'#D6F04A',green:'#7FE093',amber:'#FFA94B',red:'#FF6B6B',cyan:'#7FE3E0',magenta:'#E77FD9',ink:'#CDDDA0',inkDim:'#7A8F56'};
const COLS=96,ROWS=36,canvas=document.getElementById('phosphor'),ctx=canvas.getContext('2d');
const scene=parse(DSL);let tick=0,buf=Array.from({length:COLS*ROWS},()=>({ch:' ',tone:'ink',i:0}));
function parse(src){let name='scene',duration=2400,events=[];src.split(/\\r?\\n/).forEach((raw,n)=>{let s=raw.trim();if(!s||s[0]=='#')return;let sm=s.match(/^scene\\s+([\\w-]+)\\s+(\\d+(?:\\.\\d+)?)(ms|s)$/);if(sm){name=sm[1];duration=Number(sm[2])*(sm[3]=='s'?1000:1);return}let m=s.match(/^at\\s+(\\d+(?:\\.\\d+)?)(ms|s)\\s+([\\w-]+)\\s*(.*)$/);if(!m)return;let q=m[4].match(/"([^"]*)"/);events.push({at:Number(m[1])*(m[2]=='s'?1000:1),fx:m[3],target:q?q[1]:'',mods:m[4].replace(/"[^"]*"/,'').trim(),line:n})});return{name,duration,events}}
function set(grid,x,y,ch,tone='phos',i=1){if(x<0||y<0||x>=COLS||y>=ROWS)return;grid[y*COLS+x]={ch,tone,i}}
function write(grid,x,y,text,tone='phos',i=1){[...text].forEach((ch,n)=>set(grid,x+n,y,ch,tone,i))}
function tone(e){if(e.mods.includes('red'))return'red';if(e.mods.includes('amber'))return'amber';if(e.mods.includes('cyan'))return'cyan';if(e.fx=='glitch')return'magenta';if(e.target.startsWith('[OK]'))return'green';return'phos'}
function evalGrid(time){let grid=Array.from({length:COLS*ROWS},()=>({ch:' ',tone:'ink',i:0}));write(grid,4,1,'PHOSPHOR / '+scene.name,'inkDim',.45);let row=5,rows=new Map();for(const e of scene.events){if(e.fx=='cursor'||e.fx=='flash'||e.fx=='scan-line')continue;let key=(e.target||e.fx+e.line).replace(/^>\\s*/,'').toLowerCase();if(!rows.has(key)){rows.set(key,row);row=Math.min(row+3,ROWS-4)}}for(const e of scene.events){if(time<e.at)continue;let key=(e.target||e.fx+e.line).replace(/^>\\s*/,'').toLowerCase(),r=rows.get(key)||5,elapsed=time-e.at,dur=(e.mods.match(/(\\d+)(ms|s)/)||[,600,'ms']);dur=Number(dur[1])*(dur[2]=='s'?1000:1);if(e.fx=='type'){let chars=Math.min(e.target.length,Math.floor(elapsed/(e.mods.includes('slowly')?66:33))+1);write(grid,6,r,e.target.slice(0,chars),tone(e),1)}else if(e.fx=='pulse'){if(elapsed<=dur)write(grid,6,r,e.target,tone(e),Math.sin((elapsed/dur)*Math.PI))}else if(e.fx=='glitch'){if(elapsed<=dur)write(grid,6,r,e.target.replace(/[A-Z0-9]/g,c=>Math.random()>.5?'#':c),'magenta',1)}else if(e.fx=='cursor'){if((elapsed%dur)/dur<.5)set(grid,6+(scene.events.filter(x=>x.at<=e.at&&x.target).at(-1)?.target.length||0)+1,r,e.target||'_','ink',1)}else if(e.fx=='scan-line'){let rr=Number(e.mods.match(/row\\s+(\\d+)/)?.[1]||Math.floor((elapsed/dur)*(ROWS-1)));for(let x=0;x<COLS;x++)set(grid,x,rr,'-','cyan',.9)}else if(e.fx=='flash'){if(elapsed<=dur)for(let n=0;n<grid.length;n+=5)grid[n]={ch:' ',tone:'phos',i:.35}}else{write(grid,6,r,e.target||e.fx,tone(e),1)}}return grid}
function frame(){let dt=1000/APPEARANCE.tickRate,time=(tick*dt)%scene.duration,grid=evalGrid(time),decay=Math.exp(-dt/Math.max(1,APPEARANCE.decay));buf=buf.map(c=>({...c,i:c.i*decay}));grid.forEach((c,n)=>{if(c.i>0&&c.i>=buf[n].i)buf[n]=c});ctx.fillStyle='#050604';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.font='22px monospace';ctx.textBaseline='top';let cw=canvas.width/COLS,ch=canvas.height/ROWS;buf.forEach((c,n)=>{if(c.i<.02||c.ch==' ')return;ctx.globalAlpha=Math.min(1,c.i);ctx.shadowColor=T[c.tone]||T.phos;ctx.shadowBlur=APPEARANCE.bloom*5;ctx.fillStyle=APPEARANCE.mode=='1-bit'?T.phos:T[c.tone]||T.phos;ctx.fillText(c.ch,(n%COLS)*cw,Math.floor(n/COLS)*ch)});ctx.globalAlpha=1;tick++;setTimeout(frame,dt)}
frame();
</script>
</body>
</html>`;
  downloadBlob(`${sceneName || 'phosphor_scene'}.html`, html, 'text/html;charset=utf-8');
}

export function exportBundleJson(sceneName: string, dsl: string, appearance: Appearance) {
  const bundle = {
    schema: 'phosphor.me.bundle.v1',
    sceneName,
    dsl,
    appearance,
    assets: {
      fonts: [appearance.font],
      palettes: ['phosphor-6'],
    },
    createdAt: new Date().toISOString(),
  };
  downloadBlob(`${sceneName || 'phosphor_scene'}.me.bundle.json`, JSON.stringify(bundle, null, 2), 'application/json;charset=utf-8');
}

export async function readMeFile(file: File) {
  return file.text();
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] ?? char;
  });
}
