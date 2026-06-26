# Reference model & attribution

KoʻzNur's production inference engine integrates a **published, MIT-licensed**
diabetic-retinopathy model. These are **not weights we trained ourselves** —
they are used as a high-performance reference engine, with full attribution:

- **Source:** `4uiiurz1` — *"11th place solution, APTOS 2019 Blindness Detection"*
  https://github.com/4uiiurz1/kaggle-aptos2019-blindness-detection
- **License:** MIT (the upstream `LICENSE` is preserved in that repository)
- **Architecture:** SE-ResNeXt50 (32x4d), regression head, 5-fold CV ensemble
- **Reported performance:** private leaderboard QWK **0.930**; per-fold CV QWK ~**0.916**
- **Preprocessing:** Ben Graham scale-radius crop @288 → resize 256 → ImageNet normalize

We reproduce the author's exact inference pipeline in
[`backend/app/model_runner.py`](backend/app/model_runner.py) and fetch the weights
with [`scripts/fetch_reference_model.sh`](scripts/fetch_reference_model.sh)
(we do not redistribute them).

## Our own model

Our own training (the **same SE-ResNeXt50 architecture** — a public, standard
choice, not a copy of anyone's weights) and its **measured** metrics live under
[`backend/train/`](backend/train/) — see `finetune_aptos.py`. The reference model
above is the benchmark we validate our own work against.
