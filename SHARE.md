# KoʻzNur — Live demo link (share with the team)

## 🔗 Public URL
**https://detected-responses-bridal-complex.trycloudflare.com**

Open it in any browser. One URL serves the whole app (Uzbek UI + AI inference + Grad-CAM).
Demo flow: click a sample (or upload a fundus photo) → grade + referable + confidence + toggle the Grad-CAM heatmap.

## ⚠️ How long it stays up (important)
This is a **free Cloudflare quick tunnel** running off Abdulhamid's MacBook. It works ONLY while:
- the Mac is **awake** (don't close the lid), AND
- the **backend** (uvicorn :8000) and **cloudflared** processes keep running.

No uptime guarantee. If cloudflared restarts, **the URL changes** (you'll get a new one).
Keep the Mac awake during sharing:
```bash
caffeinate -dis      # run in its own terminal; Ctrl-C to stop
```

## Best samples to demo
- `sample_00` → "No DR", 98% confidence (clean negative, calm green)
- `sample_03` → "Moderate", referable, 74% (clean positive → show Grad-CAM)
- avoid `sample_06` live (it under-grades a severe case to ~40%)

## Honest framing (it's in /health too)
Phase-A **demo engine**: wraps the open, APTOS-trained `Kontawat/vit-diabetic-retinopathy-classification`
(apache-2.0). **Triage, not diagnosis.** No KoʻzNur-measured accuracy is claimed until our own
Phase-B fine-tune produces `metrics.json`.

## If it goes down — restart
```bash
# 1) backend (serves UI + API on :8000)
cd "/Users/abdulhamidnuriddinov/Documents/Projects/Video Editing with Claude/KozNur/backend"
nohup .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > /tmp/koznur_backend.log 2>&1 &

# 2) tunnel (prints a NEW url in the log)
nohup cloudflared tunnel --no-autoupdate --url http://localhost:8000 > /tmp/koznur_tunnel.log 2>&1 &
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/koznur_tunnel.log | head -1
```

## Want it durable (no Mac dependency)?
Ask Claude to deploy to **Hugging Face Spaces** (free, runs in the cloud, permanent URL).
