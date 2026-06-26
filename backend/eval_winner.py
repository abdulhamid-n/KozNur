"""Faithful evaluation of the 4uiiurz1 SE-ResNeXt50 APTOS-2019 model (MIT).
Replicates their inference preprocessing exactly: scale_radius(288) -> Resize(256)
-> ImageNet normalize -> regression -> round at [0.5,1.5,2.5,3.5]. Ensembles 5 folds.

HONESTY NOTE: 4uiiurz1 trained on the FULL APTOS-2019 train set, so our held-out
split was in THEIR training data -> these numbers are an optimistic upper bound,
not a clean held-out test. They confirm the model BEHAVES (catches severe) and the
integration is correct. Their own documented 5-fold CV QWK is ~0.916.
"""
import os, glob
import numpy as np, pandas as pd, cv2, torch, torch.nn as nn
from PIL import Image
import torchvision.transforms as T
from sklearn.model_selection import train_test_split
from sklearn.metrics import cohen_kappa_score, confusion_matrix, recall_score
import pretrainedmodels

ROOT = "/Users/abdulhamidnuriddinov/Documents/Projects/Video Editing with Claude/KozNur"
WDIR = f"{ROOT}/backend/models/aptos_winner/se_resnext50_32x4d"
IMG_DIR = f"{ROOT}/data/aptos_small/train_images"
CSV = f"{ROOT}/data/aptos_small/train.csv"
DEV = "mps"
THRS = [0.5, 1.5, 2.5, 3.5]

def scale_radius(src, img_size=288):
    try:
        x = src[src.shape[0] // 2, ...].sum(axis=1)
        r = (x > x.mean() / 10).sum() // 2
        if r < 10:
            raise ValueError("tiny radius")
        yx = src.sum(axis=2)
        ys, xs = np.nonzero(yx > yx.mean() / 10)   # fundus mask (centroid = center of mass)
        yc, xc = int(round(ys.mean())), int(round(xs.mean()))
        x1, x2 = max(xc - r, 0), min(xc + r, src.shape[1] - 1)
        y1, y2 = max(yc - r, 0), min(yc + r, src.shape[0] - 1)
        dst = src[y1:y2, x1:x2]
        return cv2.resize(dst, None, fx=img_size / (2 * r), fy=img_size / (2 * r))
    except Exception:
        return cv2.resize(src, (img_size, img_size))

TFM = T.Compose([T.Resize((256, 256)), T.ToTensor(),
                 T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])])

def load_img(path):
    img = cv2.cvtColor(cv2.imread(path), cv2.COLOR_BGR2RGB)
    return TFM(Image.fromarray(scale_radius(img, 288)))

def build():
    m = pretrainedmodels.se_resnext50_32x4d(num_classes=1000, pretrained=None)
    m.avg_pool = nn.AdaptiveAvgPool2d(1)
    m.last_linear = nn.Linear(2048, 1)
    return m

print("loading 5 folds...")
MODELS = []
for f in range(1, 6):
    m = build()
    # weights_only=True: these are third-party downloaded weights; this blocks
    # arbitrary-code-execution via pickle. Verified they're plain tensor state-dicts.
    m.load_state_dict(torch.load(f"{WDIR}/model_{f}.pth", map_location='cpu', weights_only=True))
    MODELS.append(m.eval().to(DEV))

def infer(paths, bs=16):
    out = np.zeros(len(paths))
    for i in range(0, len(paths), bs):
        batch = torch.stack([load_img(p) for p in paths[i:i + bs]]).to(DEV)
        with torch.no_grad():
            fp = [m(batch).cpu().numpy()[:, 0] for m in MODELS]
        out[i:i + len(batch)] = np.mean(fp, axis=0)
    return out

def path_for(idc):
    for ext in ('.jpg', '.png', '.jpeg'):
        p = f"{IMG_DIR}/{idc}{ext}"
        if os.path.exists(p):
            return p
    return None

# --- held-out val split (same seed 42 / 0.15 we used) ---
df = pd.read_csv(CSV)
idx = np.arange(len(df))
_, va = train_test_split(idx, test_size=0.15, random_state=42, stratify=df['diagnosis'].values)
pairs = [(path_for(df.iloc[i]['id_code']), int(df.iloc[i]['diagnosis'])) for i in va]
pairs = [(p, y) for p, y in pairs if p]
paths = [p for p, _ in pairs]; ytrue = np.array([y for _, y in pairs])
print(f"evaluating {len(paths)} held-out images (5-fold ensemble)...")
reg = infer(paths)
ypred = np.digitize(reg, THRS)

qwk = cohen_kappa_score(ytrue, ypred, weights='quadratic')
cm = confusion_matrix(ytrue, ypred, labels=[0, 1, 2, 3, 4])
ref_true, ref_pred = (ytrue >= 2).astype(int), (reg >= 1.5).astype(int)
sens = recall_score(ref_true, ref_pred, pos_label=1)
spec = recall_score(ref_true, ref_pred, pos_label=0)

print("\n========== SE-ResNeXt50 (4uiiurz1, MIT) on our held-out APTOS split ==========")
print(f"QWK (quadratic weighted kappa): {qwk:.4f}   [their documented CV: ~0.916]")
print("confusion matrix (rows=true 0..4, cols=pred):")
print(cm)
labs = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]
for g in range(5):
    rec = cm[g, g] / cm[g].sum() if cm[g].sum() else float('nan')
    print(f"  grade {g} {labs[g]:13s} recall: {rec:.2f}  (n={cm[g].sum()})")
print(f"REFERABLE (>=2): sensitivity={sens:.3f}  specificity={spec:.3f}")
print("NOTE: these images were in the model's training set -> optimistic upper bound.")

print("\n========== our 7 demo samples ==========")
for sp in sorted(glob.glob(f"{ROOT}/backend/samples/sample_*_grade*.jpg")):
    r = infer([sp])[0]; g = int(np.digitize([r], THRS)[0])
    claimed = sp.split('grade')[1][0]
    flag = "OK" if str(g) == claimed or (g >= 2) == (int(claimed) >= 2) else "MISS"
    print(f"  {os.path.basename(sp)}: reg={r:5.2f} -> grade {g} (claimed {claimed}) [{flag}]")
