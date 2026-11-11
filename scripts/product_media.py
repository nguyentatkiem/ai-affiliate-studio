"""Ảnh sản phẩm → (1) PNG tách nền, (2) ảnh cận cảnh các chi tiết đáng zoom (nhãn, kết cấu, cổng sạc...).

usage:
  python product_media.py cutout <in.jpg> <out.png>            → in JSON {"ok":true,"method":"flood|rembg","box":[...]}
  python product_media.py details <in.jpg> <out_prefix> [--n 2] [--mask cut.png]
                                                              → <out_prefix>-1.jpg ... + JSON {"crops":[[x,y,w,h,score],...]}
Tách nền: ảnh shop nền trơn (trắng/xám) → loang màu từ mép (nhanh, sắc nét, không cần model); nền phức tạp → rembg (u2net) nếu có.
Cận cảnh: vùng có mật độ cạnh cao nhất (chữ trên nhãn, hoa văn, chi tiết máy), không chồng nhau, nằm trong sản phẩm.
"""
import json
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

MAGIC = (255, 0, 254)


def load(p, maxd=1400):
    im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
    if max(im.size) > maxd:
        im.thumbnail((maxd, maxd), Image.LANCZOS)
    return im


def border_uniform(a):
    b = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)]).astype(float)
    return b.std(axis=0).mean() < 14, b.mean(axis=0)


def cutout(src, dst):
    im = load(src)
    a = np.asarray(im)
    uni, _ = border_uniform(a)
    method = None
    alpha = None
    if uni:
        f = im.copy()
        w, h = f.size
        seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
        for s in seeds:
            if f.getpixel(s) != MAGIC:
                ImageDraw.floodfill(f, s, MAGIC, thresh=34)
        fa = np.asarray(f)
        bg = (fa[..., 0] == MAGIC[0]) & (fa[..., 1] == MAGIC[1]) & (fa[..., 2] == MAGIC[2])
        fg = ~bg
        if 0.04 < fg.mean() < 0.97:
            alpha = Image.fromarray((fg * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
            method = "flood"
    if alpha is None:
        try:
            from rembg import new_session, remove
            for model in ("isnet-general-use", "u2net", "u2netp"):
                try:
                    sess = new_session(model)
                    break
                except Exception:
                    sess = None
            if sess is None:
                raise RuntimeError("no rembg model")
            alpha = remove(im, session=sess, only_mask=True)
            if not isinstance(alpha, Image.Image):
                alpha = Image.fromarray(np.asarray(alpha))
            alpha = alpha.convert("L")
            m = np.asarray(alpha) > 128
            if not (0.04 < m.mean() < 0.97):
                raise RuntimeError("mask rỗng")
            method = "rembg"
        except Exception as e:
            print(json.dumps({"ok": False, "error": f"không tách được nền: {e}"}))
            return
    rgba = im.copy()
    rgba.putalpha(alpha)
    box = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    if box:
        pad = 6
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(im.width, box[2] + pad), min(im.height, box[3] + pad))
        rgba = rgba.crop(box)
    rgba.thumbnail((1000, 1000), Image.LANCZOS)
    rgba.save(dst)
    print(json.dumps({"ok": True, "method": method, "box": box, "size": rgba.size}))


def details(src, prefix, n=2, mask=None):
    im = load(src)
    g = np.asarray(im.convert("L").filter(ImageFilter.FIND_EDGES), dtype=np.float32)
    g[:3], g[-3:], g[:, :3], g[:, -3:] = 0, 0, 0, 0
    if mask:
        try:
            # cutout PNG is cropped: only use it when it still matches the photo size
            m = Image.open(mask).split()[-1]
            if m.size == im.size:
                g *= (np.asarray(m) > 64)
        except Exception:
            pass
    h, w = g.shape
    side = int(min(w, h) * 0.42)
    if side < 120:
        print(json.dumps({"crops": []}))
        return
    ii = np.pad(g.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    step = max(8, side // 8)
    cands = []
    for y in range(0, h - side + 1, step):
        for x in range(0, w - side + 1, step):
            s = ii[y + side, x + side] - ii[y, x + side] - ii[y + side, x] + ii[y, x]
            cands.append((s / (side * side), x, y))
    whole = g.mean() + 1e-6
    cands.sort(reverse=True)
    picked = []
    for sc, x, y in cands:
        if sc < whole * 1.25:
            break
        if any(abs(x - px) < side * 0.7 and abs(y - py) < side * 0.7 for _, px, py in picked):
            continue
        picked.append((sc, x, y))
        if len(picked) >= n:
            break
    crops = []
    for i, (sc, x, y) in enumerate(picked):
        c = im.crop((x, y, x + side, y + side)).resize((900, 900), Image.LANCZOS).filter(ImageFilter.UnsharpMask(2, 60, 2))
        c.save(f"{prefix}-{i + 1}.jpg", quality=90)
        crops.append([x, y, side, side, round(float(sc / whole), 2)])
    print(json.dumps({"crops": crops}))


if __name__ == "__main__":
    a = sys.argv[1:]
    if a and a[0] == "cutout":
        cutout(a[1], a[2])
    elif a and a[0] == "details":
        n = int(a[a.index("--n") + 1]) if "--n" in a else 2
        mk = a[a.index("--mask") + 1] if "--mask" in a else None
        details(a[1], a[2], n, mk)
    else:
        print(__doc__)
        sys.exit(1)
