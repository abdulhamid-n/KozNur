#!/usr/bin/env bash
# Fetch the MIT-licensed reference diabetic-retinopathy model used as KoʻzNur's
# production inference engine. We do NOT redistribute these weights — this pulls
# them from the original author's public GitHub release.
#
# Source: 4uiiurz1, "11th place APTOS 2019 Blindness Detection" (MIT, private LB QWK 0.930)
#         https://github.com/4uiiurz1/kaggle-aptos2019-blindness-detection
set -euo pipefail

DEST="$(cd "$(dirname "$0")/.." && pwd)/backend/models/aptos_winner"
URL="https://github.com/4uiiurz1/kaggle-aptos2019-blindness-detection/releases/download/v1.0/se_resnext50_32x4d.zip"

mkdir -p "$DEST"
echo "Downloading reference weights (~476MB) ..."
curl -L -o "$DEST/se_resnext50_32x4d.zip" "$URL"
( cd "$DEST" && unzip -oq se_resnext50_32x4d.zip )
echo "Done -> $DEST/se_resnext50_32x4d/ (5 CV folds)"
