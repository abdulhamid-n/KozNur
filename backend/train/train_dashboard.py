#!/usr/bin/env python3
"""Lightweight live training dashboard. Stdlib only. Parses the trainer's stdout
log and serves an auto-refreshing chart. The BROWSER polls /data every 3s, so the
server is idle otherwise — negligible CPU, zero impact on training.

Usage: train_dashboard.py <log_path> [port=8012]
"""
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

LOG_PATH = sys.argv[1]
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8012

EPOCH_RE = re.compile(
    r"\[epoch (\d+)/(\d+)\] train_loss=([\d.]+) val_loss=([\d.]+) "
    r"QWK=([\-\d.]+) sens=([\d.]+) spec=([\d.]+) AUC=([\d.]+)"
)
BEST_RE = re.compile(r"BEST val QWK=([\-\d.]+)")


def parse():
    try:
        text = open(LOG_PATH, encoding="utf-8", errors="replace").read()
    except FileNotFoundError:
        text = ""
    epochs, total = [], 12
    for m in EPOCH_RE.finditer(text):
        total = int(m.group(2))
        epochs.append({
            "epoch": int(m.group(1)), "train_loss": float(m.group(3)),
            "val_loss": float(m.group(4)), "qwk": float(m.group(5)),
            "sens": float(m.group(6)), "spec": float(m.group(7)),
            "auc": float(m.group(8)),
        })
    done = "TRAINING DONE" in text or bool(BEST_RE.search(text))
    status = "done" if done else ("training" if epochs else "starting")
    best = None
    if epochs:
        best = max(epochs, key=lambda e: e["qwk"])
    return {"epochs": epochs, "total": total, "status": status, "best": best}


HTML = """<!DOCTYPE html><html><head><meta charset=utf-8>
<title>KoʻzNur — Training</title><style>
:root{--navy:#0B3D66;--teal:#0F838C;--bg:#0c1620;--card:#13212e;--line:#22384a;--ink:#e8f0f6;--mut:#8aa0b2;--good:#2E9E6B;--amber:#E8833A}
*{box-sizing:border-box;margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif}
body{background:var(--bg);color:var(--ink);padding:26px 30px}
h1{font-size:20px;letter-spacing:.3px}h1 span{color:var(--teal)}
.sub{color:var(--mut);font-size:13px;margin-top:3px}
.bar{height:8px;background:#1b2c3a;border-radius:6px;margin:18px 0 22px;overflow:hidden}
.bar>div{height:100%;background:linear-gradient(90deg,var(--teal),#7FD3D9);width:0;transition:width .4s}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}
.c{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.c .l{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--mut)}
.c .v{font-size:34px;font-weight:800;margin-top:6px}.c .b{font-size:11px;color:var(--mut);margin-top:4px}
.c.sens .v{color:var(--good)} .c.qwk .v{color:#7FD3D9}
svg{background:var(--card);border:1px solid var(--line);border-radius:12px;width:100%}
.leg{display:flex;gap:18px;margin:12px 2px;font-size:12px;color:var(--mut)}
.leg b{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:6px;vertical-align:middle}
.pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700}
.pill.training{background:#1c3a2b;color:#5fd39b}.pill.done{background:#143a4a;color:#7FD3D9}.pill.starting{background:#3a2f1c;color:#e8b063}
</style></head><body>
<h1><span>KoʻzNur</span> — Model Training <span id=pill></span></h1>
<div class=sub id=sub>connecting…</div>
<div class=bar><div id=prog></div></div>
<div class=cards>
 <div class="c qwk"><div class=l>QWK (latest)</div><div class=v id=qwk>–</div><div class=b id=qwkb>best –</div></div>
 <div class="c sens"><div class=l>Referable sensitivity</div><div class=v id=sens>–</div><div class=b>catches sight-threatening DR</div></div>
 <div class=c><div class=l>Specificity</div><div class=v id=spec>–</div><div class=b>correctly clears healthy</div></div>
 <div class=c><div class=l>Referable AUC</div><div class=v id=auc>–</div><div class=b>threshold-independent quality</div></div>
</div>
<div class=leg>
 <span><b style="background:#7FD3D9"></b>QWK</span>
 <span><b style="background:#2E9E6B"></b>Sensitivity</span>
 <span><b style="background:#E8833A"></b>Specificity</span>
 <span><b style="background:#cfa6ff"></b>AUC</span>
</div>
<svg id=chart viewBox="0 0 900 360" preserveAspectRatio=none></svg>
<script>
const NS="http://www.w3.org/2000/svg";
function px(x,y,W,H,pad,n,maxx){return [pad+ (n<=1?0:(x/(maxx))*(W-2*pad)), H-pad-(y*(H-2*pad))]}
async function tick(){
 let d; try{d=await (await fetch('/data')).json()}catch(e){return}
 const ep=d.epochs, st=d.status;
 document.getElementById('pill').innerHTML='<span class="pill '+st+'">'+st.toUpperCase()+'</span>';
 const cur = ep.length?ep[ep.length-1]:null;
 document.getElementById('sub').textContent = cur? ('Epoch '+cur.epoch+' / '+d.total+'  ·  reading live training log') : 'Training is starting — waiting for epoch 1…';
 document.getElementById('prog').style.width = (cur? (cur.epoch/d.total*100):2)+'%';
 const f=(x)=> x==null?'–':(x).toFixed(3);
 if(cur){
  document.getElementById('qwk').textContent=f(cur.qwk);
  document.getElementById('sens').textContent=(cur.sens*100).toFixed(1)+'%';
  document.getElementById('spec').textContent=(cur.spec*100).toFixed(1)+'%';
  document.getElementById('auc').textContent=f(cur.auc);
  document.getElementById('qwkb').textContent='best '+f(d.best?d.best.qwk:null);
 }
 // chart
 const svg=document.getElementById('chart'); svg.innerHTML='';
 const W=900,H=360,pad=40, maxx=Math.max(1,d.total-1);
 // gridlines 0..1
 for(let g=0;g<=5;g++){const y=H-pad-(g/5)*(H-2*pad);
  const l=document.createElementNS(NS,'line');l.setAttribute('x1',pad);l.setAttribute('x2',W-pad);l.setAttribute('y1',y);l.setAttribute('y2',y);l.setAttribute('stroke','#22384a');svg.appendChild(l);
  const t=document.createElementNS(NS,'text');t.setAttribute('x',8);t.setAttribute('y',y+4);t.setAttribute('fill','#8aa0b2');t.setAttribute('font-size','11');t.textContent=(g/5).toFixed(1);svg.appendChild(t);}
 const series=[['qwk','#7FD3D9'],['sens','#2E9E6B'],['spec','#E8833A'],['auc','#cfa6ff']];
 for(const [k,col] of series){
  let pts=ep.map((e,i)=>px(i, Math.max(0,Math.min(1,e[k])), W,H,pad, ep.length, maxx).join(',')).join(' ');
  const pl=document.createElementNS(NS,'polyline');pl.setAttribute('points',pts);pl.setAttribute('fill','none');pl.setAttribute('stroke',col);pl.setAttribute('stroke-width','2.5');svg.appendChild(pl);
  ep.forEach((e,i)=>{const [cx,cy]=px(i,Math.max(0,Math.min(1,e[k])),W,H,pad,ep.length,maxx);const c=document.createElementNS(NS,'circle');c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r','3');c.setAttribute('fill',col);svg.appendChild(c);});
 }
}
tick(); setInterval(tick,3000);
</script></body></html>"""


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silence
        pass

    def do_GET(self):
        if self.path.startswith("/data"):
            body = json.dumps(parse()).encode()
            ctype = "application/json"
        else:
            body = HTML.encode()
            ctype = "text/html; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"dashboard on http://localhost:{PORT}  (log: {LOG_PATH})", flush=True)
    HTTPServer(("127.0.0.1", PORT), H).serve_forever()
