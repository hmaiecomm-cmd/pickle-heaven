import { createServer } from 'node:http'
import type { EdgeAgent } from './agent'

/** 即時面板：16 路 DO 燈號、門鎖、網路、事件佇列；可切換斷網與硬體故障，並模擬輸入密碼與移動偵測 */
export function startPanel(agent: EdgeAgent, port: number) {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    if (url.pathname === '/state') {
      const p = agent.plan
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          siteId: agent.opts.siteId,
          online: agent.online,
          offline: !!agent.net.offline,
          planRev: agent.planRev,
          lastError: agent.lastError,
          localTime: new Date(agent.now()).toISOString(),
          circuits: (p?.circuits ?? []).map((d) => ({ ...d, state: agent.hw.relays[d.channel], override: agent.overrides.get(d.no) ?? null })),
          doorLocked: agent.hw.doorLocked,
          faults: agent.hw.faults,
          outbox: agent.outbox.length,
          recent: [...agent.executed].slice(-8).reverse(),
          played: agent.hw.played.slice(-8).reverse(),
        }),
      )
      return
    }
    if (req.method === 'POST' && url.pathname === '/action') {
      const a = url.searchParams.get('a')
      if (a === 'offline') agent.setOffline(!agent.net.offline)
      if (a === 'modbus') agent.hw.faults.modbusDown = !agent.hw.faults.modbusDown
      if (a === 'door') agent.hw.faults.doorControllerDown = !agent.hw.faults.doorControllerDown
      if (a === 'code') agent.enterCode(url.searchParams.get('v') ?? '')
      if (a === 'motion') agent.motion(url.searchParams.get('v') ?? 'A')
      agent.tick()
      res.writeHead(204).end()
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGE)
  })
  server.listen(port, '127.0.0.1', () => console.log(`模擬面板：http://127.0.0.1:${port}`))
  return server
}

const PAGE = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>場館模擬器</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--fg:#1d2433;--mute:#6b7385;--on:#16a34a;--off:#cbd2dc;--warn:#d97706;--bad:#dc2626;--line:#e3e7ee}
@media (prefers-color-scheme:dark){:root{--bg:#0f1218;--card:#181c24;--fg:#e6e9ef;--mute:#9099ab;--off:#3a4150;--line:#272d38}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,"Noto Sans TC",sans-serif;padding:16px}
h1{font-size:18px;margin:0 0 12px}.row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;flex:1;min-width:260px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.do{border:1px solid var(--line);border-radius:8px;padding:8px}.dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px;background:var(--off)}
.on .dot{background:var(--on)}.k{color:var(--mute);font-size:12px}button{margin:2px;padding:6px 10px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
.bad{color:var(--bad)}.ok{color:var(--on)}input{padding:6px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg);width:90px}
ul{margin:0;padding-left:18px}
</style>
<h1>場館模擬器 <span id="site"></span></h1>
<div class="row">
 <div class="card"><div class="k">連線</div><div id="net"></div><div class="k">計畫版本 / 本機時間</div><div id="plan"></div><div class="k">待上傳事件</div><div id="outbox"></div></div>
 <div class="card"><div class="k">故障注入</div>
  <button onclick="act('offline')">切換斷網</button><button onclick="act('modbus')">切換 RS-485 斷線</button><button onclick="act('door')">切換門禁故障</button>
  <div class="k" style="margin-top:8px">現場操作</div>
  <input id="code" placeholder="密碼"><button onclick="act('code',code.value)">輸入密碼</button>
  <button onclick="act('motion','A')">A 場有人</button><button onclick="act('motion','B')">B 場有人</button>
  <div id="door" style="margin-top:6px"></div></div>
</div>
<div class="card"><div class="k">16 路 DO（M-7045）</div><div class="grid" id="do"></div></div>
<div class="row" style="margin-top:12px"><div class="card"><div class="k">最近指令</div><ul id="cmds"></ul></div><div class="card"><div class="k">廣播</div><ul id="audio"></ul></div></div>
<script>
async function act(a,v){await fetch('/action?a='+a+(v?'&v='+encodeURIComponent(v):''),{method:'POST'});load()}
function esc(s){return String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}
async function load(){const s=await (await fetch('/state')).json();
site.textContent='· '+s.siteId;
net.innerHTML=s.offline?'<b class="bad">斷網（模擬）</b>':(s.online?'<b class="ok">在線</b>':'<b class="bad">連線中斷</b>')+(s.lastError?' <span class="k">'+esc(s.lastError)+'</span>':'');
plan.textContent=(s.planRev??'—')+' / '+new Date(s.localTime).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
outbox.textContent=s.outbox;door.innerHTML='門鎖：'+(s.doorLocked?'上鎖':'<b class="ok">開啟</b>');
document.getElementById('do').innerHTML=s.circuits.map(c=>'<div class="do '+(c.state==='ON'?'on':'')+'"><span class="dot"></span><b>DO'+String(c.channel).padStart(2,'0')+'</b> '+esc(c.name)+'<div class="k">'+c.kind+(c.override?' · 手動 '+c.override.state+' ('+c.override.hold.mode+')':'')+'</div></div>').join('');
cmds.innerHTML=s.recent.map(r=>'<li>'+esc(r.command.type)+' → '+r.result+'</li>').join('')||'<li class="k">尚無</li>';
audio.innerHTML=s.played.map(p=>'<li>'+esc(p.file)+'</li>').join('')||'<li class="k">尚無</li>'}
load();setInterval(load,1000)
</script></html>`
