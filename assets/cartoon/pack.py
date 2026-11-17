#!/usr/bin/env python3
"""Normalize cartoon sprite sheets and embed WebP posters/atlases for offline play."""
from __future__ import annotations

import base64
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
ORIGINALS = HERE / "originals"
OUT = HERE / "optimized"
JS_OUT = ROOT / "cartoon-data.js"
IDS = ["background", "castle", "archer", "mortar", "frost", "barracks",
       "arcane", "trap", "raider", "runner", "knight", "shaman", "wraith",
       "golem", "dragon", "boss5", "boss10", "boss15", "boss20", "guard"]
TOWERS = {"archer", "mortar", "frost", "barracks", "arcane", "trap"}
ACTORS = set(IDS) - {"background", "castle"} - TOWERS
FRAME_W, FRAME_H = 192, 224
BASELINE = 193


def run_ffmpeg(args: list[str]) -> None:
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args],
                   check=True)


def webp_args(quality: int = 90) -> list[str]:
    return ["-frames:v", "1", "-c:v", "libwebp", "-quality", str(quality),
            "-compression_level", "6", "-pix_fmt", "yuva420p"]


def alpha_bbox(path: Path) -> tuple[int, int, int, int] | None:
    with Image.open(path) as im:
        if "A" not in im.getbands():
            raise ValueError(f"{path.name}: transparent RGBA artwork required")
        return im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()


def cell_bbox(sheet: Path, x0: int, y0: int, x1: int, y1: int) -> tuple[int, int, int, int] | None:
    with Image.open(sheet) as im:
        alpha = im.getchannel("A").crop((x0, y0, x1, y1))
        box = alpha.point(lambda a: 255 if a > 8 else 0).getbbox()
    return None if box is None else (x0 + box[0], y0 + box[1], x0 + box[2], y0 + box[3])


def encode_static(src: Path, dst: Path, name: str) -> dict:
    if name == "background":
        vf = "scale=1536:1024:force_original_aspect_ratio=increase,crop=1536:1024"
        run_ffmpeg(["-i", str(src), "-vf", vf, *webp_args(), str(dst)])
        bbox = None
    else:
        bbox = alpha_bbox(src)
        if not bbox:
            raise ValueError(f"{name}: empty or non-transparent sprite")
        x, y, r, b = bbox
        bw, bh = r - x, b - y
        scale = min(302 / bw, 304 / bh)
        sw, sh = max(1, round(bw * scale)), max(1, round(bh * scale))
        vf = f"crop={bw}:{bh}:{x}:{y},scale={sw}:{sh}:flags=lanczos,pad=320:374:(ow-iw)/2:322-ih:color=0x00000000"
        run_ffmpeg(["-i", str(src), "-vf", vf, *webp_args(), str(dst)])
    with Image.open(dst) as im:
        return {"source": list(Image.open(src).size), "poster": list(im.size),
                "atlas": None, "frames": 1, "alpha": name != "background",
                "bytes": dst.stat().st_size, "source_bbox": list(bbox) if bbox else None}


def split_sheet(name: str, src: Path, work: Path) -> tuple[list[Path], int, int, list[tuple[int, int, int, int] | None]]:
    cols, rows = (2, 2) if name in TOWERS else (4, 3)
    with Image.open(src) as im:
        if "A" not in im.getbands():
            raise ValueError(f"{name}: transparent RGBA sprite sheet required")
        sw, sh = im.size
    boxes: list[tuple[int, int, int, int] | None] = []
    cells: list[tuple[int, int, int, int]] = []
    for row in range(rows):
        y0, y1 = round(row * sh / rows), round((row + 1) * sh / rows)
        for col in range(cols):
            x0, x1 = round(col * sw / cols), round((col + 1) * sw / cols)
            cells.append((x0, y0, x1, y1))
            boxes.append(cell_bbox(src, x0, y0, x1, y1))
    empty_ok_start = 8 if name in ACTORS else len(boxes)
    for idx, box in enumerate(boxes):
        if box is None and idx < empty_ok_start:
            raise ValueError(f"{name}: missing sprite in frame {idx} (only final death frames may be empty)")
    visible = [(i, b) for i, b in enumerate(boxes) if b is not None]
    if not visible:
        raise ValueError(f"{name}: sheet has no visible sprites")
    # Character death poses do not influence the common scale.
    width_sizing = [b for _, b in visible]
    height_sizing = [b for i, b in visible if name not in ACTORS or i < 8]
    maxw = max(b[2] - b[0] for b in width_sizing)
    maxh = max(b[3] - b[1] for b in height_sizing)
    scale = min(182 / maxw, 182 / maxh)
    frames: list[Path] = []
    for i, (cell, box) in enumerate(zip(cells, boxes)):
        out = work / f"{name}-{i:02d}.png"
        if box is None:
            run_ffmpeg(["-f", "lavfi", "-i", f"color=c=black@0.0:s={FRAME_W}x{FRAME_H}:d=1",
                        "-frames:v", "1", "-vf", "format=rgba", str(out)])
        else:
            x, y, r, b = box
            w, h = r - x, b - y
            dw, dh = max(1, round(w * scale)), max(1, round(h * scale))
            px, py = (FRAME_W - dw) // 2, BASELINE - dh
            if py < 0 or px < 0:
                raise ValueError(f"{name}: normalized frame exceeds target dimensions")
            vf = f"crop={w}:{h}:{x}:{y},scale={dw}:{dh}:flags=lanczos,pad={FRAME_W}:{FRAME_H}:{px}:{py}:color=0x00000000,format=rgba"
            x0, y0, x1, y1 = cell
            run_ffmpeg(["-i", str(src), "-vf", vf, "-frames:v", "1", str(out)])
        frames.append(out)
    return frames, cols, rows, boxes


def pack_sheet(name: str, src: Path, work: Path, poster: Path, atlas: Path) -> dict:
    frames, cols, rows, boxes = split_sheet(name, src, work)
    # xstack preserves the independently normalized RGBA frames without resampling.
    args: list[str] = []
    for frame in frames:
        args += ["-i", str(frame)]
    positions = "|".join(f"{(i % cols) * FRAME_W}_{(i // cols) * FRAME_H}" for i in range(len(frames)))
    labels = "".join(f"[{i}:v]" for i in range(len(frames)))
    graph = f"{labels}xstack=inputs={len(frames)}:layout={positions}:fill=black,format=rgba[out]"
    run_ffmpeg([*args, "-filter_complex", graph, "-map", "[out]", "-frames:v", "1",
                "-c:v", "libwebp", "-quality", "90", "-compression_level", "6",
                "-pix_fmt", "yuva420p", str(atlas)])
    run_ffmpeg(["-i", str(frames[0]), "-vf", "scale=320:374:flags=lanczos,pad=320:374:0:0:color=0x00000000",
                *webp_args(), str(poster)])
    with Image.open(src) as im:
        source = list(im.size)
    with Image.open(poster) as im:
        poster_size = list(im.size)
    with Image.open(atlas) as im:
        atlas_size = list(im.size)
    return {"source": source, "poster": poster_size, "atlas": atlas_size,
            "cols": cols, "rows": rows, "frames": len(frames),
            "empty_frames": [i for i, box in enumerate(boxes) if box is None],
            "alpha": True, "bytes": poster.stat().st_size + atlas.stat().st_size}


def main() -> int:
    allow_partial = "--allow-partial" in sys.argv[1:]
    available = {name: ORIGINALS / f"{name}.png" for name in IDS}
    missing = [name for name, path in available.items() if not path.is_file()]
    if missing and not allow_partial:
        raise SystemExit("Missing cartoon originals: " + ", ".join(missing))
    names = [name for name in IDS if available[name].is_file()]
    if not names:
        raise SystemExit("No cartoon originals are available")
    OUT.mkdir(parents=True, exist_ok=True)
    assets: dict[str, str] = {}
    animation: dict[str, dict] = {}
    manifest: dict[str, dict] = {}
    with tempfile.TemporaryDirectory(prefix="cartoon-pack-") as temp:
        work = Path(temp)
        for name in names:
            src = available[name]
            poster, atlas = OUT / f"{name}.webp", OUT / f"{name}-atlas.webp"
            cache_time = max(src.stat().st_mtime, Path(__file__).stat().st_mtime)
            is_sheet = name in TOWERS or name in ACTORS
            outputs = (poster, atlas) if is_sheet else (poster,)
            if not all(p.exists() and p.stat().st_mtime >= cache_time for p in outputs):
                if is_sheet:
                    manifest[name] = pack_sheet(name, src, work, poster, atlas)
                else:
                    manifest[name] = encode_static(src, poster, name)
            else:
                with Image.open(src) as im:
                    source = list(im.size)
                with Image.open(poster) as im:
                    psize = list(im.size)
                asize = None
                if is_sheet:
                    with Image.open(atlas) as im:
                        asize = list(im.size)
                manifest[name] = {"source": source, "poster": psize, "atlas": asize,
                                  "cols": 2 if name in TOWERS else (4 if name in ACTORS else None),
                                  "rows": 2 if name in TOWERS else (3 if name in ACTORS else None),
                                  "frames": 4 if name in TOWERS else (12 if name in ACTORS else 1),
                                  "alpha": name != "background",
                                  "bytes": sum(p.stat().st_size for p in outputs)}
            assets[name] = "data:image/webp;base64," + base64.b64encode(poster.read_bytes()).decode("ascii")
            if is_sheet:
                cols, rows = (2, 2) if name in TOWERS else (4, 3)
                states = ({"idle": {"frames": [0], "fps": 1, "loop": True},
                           "attack": {"frames": [0, 1, 2, 3], "fps": 12, "loop": False}}
                          if name in TOWERS else
                          {"walk": {"frames": [0, 1, 2, 3], "fps": 8, "loop": True},
                           "attack": {"frames": [4, 5, 6, 7], "fps": 9, "loop": True},
                           "die": {"frames": [8, 9, 10, 11], "fps": 5, "loop": False},
                           "idle": {"frames": [0], "fps": 1, "loop": True}})
                animation[name] = {"src": "data:image/webp;base64," + base64.b64encode(atlas.read_bytes()).decode("ascii"),
                                   "cols": cols, "rows": rows, "frameWidth": FRAME_W,
                                   "frameHeight": FRAME_H, "anchorY": 0.86, "states": states}
    js = ("/* Generated from assets/cartoon/originals; offline WebP artwork. */\n"
          "Object.assign(window.ART," + json.dumps(assets, separators=(",", ":")) + ");\n"
          "window.GENERATED_ART_IDS=" + json.dumps(names) + ";\n"
          "window.ANIMATION_ATLAS=" + json.dumps(animation, separators=(",", ":")) + ";\n")
    # Only publish the JS bundle after every requested asset has been processed successfully.
    JS_OUT.write_text(js, encoding="utf-8")
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Cartoon artwork packaged: {len(names)}/{len(IDS)}; {sum(v['bytes'] for v in manifest.values()):,} bytes WebP")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, subprocess.CalledProcessError) as exc:
        raise SystemExit(f"Cartoon packaging failed: {exc}")
