#!/usr/bin/env python3
"""批次將資料夾內的 4K／高解析度影片壓縮成適合網頁播放的 H.264 MP4。

預設行為：
- 掃描輸入資料夾（可遞迴）中的常見影片格式（.mp4 .mov .m4v .MOV）。
- 以 ffprobe 讀取原始解析度，若高度大於 `--max-height`（預設 1920）
  就依比例縮小；否則保留原尺寸避免無謂放大。
- 以 `libx264 + yuv420p + +faststart` 編碼，CRF 23、preset medium、
  音訊 AAC 128k（皆可由參數調整），並強制寬高為偶數以相容 H.264。
- 輸出檔名沿用原檔名但換成 .mp4；已存在則跳過（加 --overwrite 可覆蓋）。

用法範例：
    # 先安裝 ffmpeg（macOS）：
    brew install ffmpeg

    # 把 ~/Downloads/van-clips 內所有影片壓縮到 ./compressed：
    python3 tools/compress_videos.py \\
        --input ~/Downloads/van-clips \\
        --output ./compressed

    # 自訂畫質、預設與最大高度：
    python3 tools/compress_videos.py -i ./src -o ./out \\
        --max-height 1440 --crf 22 --preset slow

    # 只列出將要處理的檔案，不真的轉檔：
    python3 tools/compress_videos.py -i ./src -o ./out --dry-run
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".mkv", ".avi", ".webm"}


@dataclass
class VideoInfo:
    path: Path
    width: int
    height: int


def which_or_exit(binary: str) -> str:
    """找到指定執行檔，找不到就顯示安裝建議並結束。"""
    resolved = shutil.which(binary)
    if not resolved:
        sys.stderr.write(
            f"[錯誤] 找不到 `{binary}`，請先安裝 ffmpeg。\n"
            "  macOS:   brew install ffmpeg\n"
            "  Ubuntu:  sudo apt install ffmpeg\n"
            "  Windows: https://ffmpeg.org/download.html\n"
        )
        sys.exit(1)
    return resolved


def iter_videos(root: Path, recursive: bool) -> Iterable[Path]:
    pattern = "**/*" if recursive else "*"
    for path in sorted(root.glob(pattern)):
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS:
            yield path


def probe_video(ffprobe: str, path: Path) -> VideoInfo | None:
    """以 ffprobe 讀取影片的寬與高；失敗回傳 None。"""
    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height",
        "-of", "json",
        str(path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as exc:
        sys.stderr.write(f"[警告] 無法讀取 {path.name}: {exc.stderr.strip()}\n")
        return None

    streams = json.loads(result.stdout).get("streams") or []
    if not streams:
        sys.stderr.write(f"[警告] {path.name} 沒有影片軌，略過。\n")
        return None

    stream = streams[0]
    return VideoInfo(path=path, width=int(stream["width"]), height=int(stream["height"]))


def compute_scale_filter(info: VideoInfo, max_height: int) -> str | None:
    """依原始高度決定 scale filter；若不需縮放回傳 None。"""
    if info.height <= max_height:
        return None
    # 依高度縮放，寬度自動計算並強制為偶數（H.264 需求）。
    return f"scale=-2:{max_height}"


def build_ffmpeg_cmd(
    ffmpeg: str,
    info: VideoInfo,
    output: Path,
    max_height: int,
    crf: int,
    preset: str,
    audio_bitrate: str,
    overwrite: bool,
) -> list[str]:
    cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-stats"]
    cmd += ["-y" if overwrite else "-n"]
    cmd += ["-i", str(info.path)]

    scale = compute_scale_filter(info, max_height)
    if scale:
        # 加上 format=yuv420p 確保相容瀏覽器的色彩空間。
        cmd += ["-vf", f"{scale},format=yuv420p"]
    else:
        cmd += ["-vf", "format=yuv420p"]

    cmd += [
        "-c:v", "libx264",
        "-preset", preset,
        "-crf", str(crf),
        "-profile:v", "high",
        "-level", "4.1",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-c:a", "aac",
        "-b:a", audio_bitrate,
        "-ac", "2",
        str(output),
    ]
    return cmd


def human_size(bytes_: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if bytes_ < 1024:
            return f"{bytes_:.1f} {unit}"
        bytes_ /= 1024  # type: ignore[assignment]
    return f"{bytes_:.1f} TB"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="批次壓縮 4K 影片為網頁友善的 H.264 MP4。",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("-i", "--input", required=True, type=Path, help="來源影片資料夾")
    parser.add_argument("-o", "--output", required=True, type=Path, help="輸出資料夾")
    parser.add_argument("--max-height", type=int, default=1920, help="輸出最大高度 (px)")
    parser.add_argument("--crf", type=int, default=23, help="x264 CRF 品質 (18~28；越小畫質越好)")
    parser.add_argument(
        "--preset",
        default="medium",
        choices=["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"],
        help="x264 編碼 preset（越慢檔案越小）",
    )
    parser.add_argument("--audio-bitrate", default="128k", help="AAC 音訊位元率")
    parser.add_argument("--recursive", action="store_true", help="遞迴搜尋子資料夾")
    parser.add_argument("--overwrite", action="store_true", help="已存在時覆蓋輸出檔")
    parser.add_argument("--dry-run", action="store_true", help="只列出將要處理的檔案，不執行壓縮")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if not args.input.exists() or not args.input.is_dir():
        sys.stderr.write(f"[錯誤] 來源資料夾不存在：{args.input}\n")
        return 1
    args.output.mkdir(parents=True, exist_ok=True)

    ffmpeg = which_or_exit("ffmpeg")
    ffprobe = which_or_exit("ffprobe")

    videos = list(iter_videos(args.input, args.recursive))
    if not videos:
        print(f"[提示] {args.input} 內沒有找到支援的影片檔。")
        return 0

    print(f"找到 {len(videos)} 支影片，輸出至 {args.output}（max-height={args.max_height}, CRF={args.crf}, preset={args.preset}）\n")

    total_in = total_out = 0
    success = skipped = failed = 0

    for index, src in enumerate(videos, 1):
        info = probe_video(ffprobe, src)
        if info is None:
            failed += 1
            continue

        target = args.output / f"{src.stem}.mp4"
        if target.exists() and not args.overwrite:
            print(f"[{index}/{len(videos)}] 跳過（已存在）：{target.name}")
            skipped += 1
            continue

        scale = compute_scale_filter(info, args.max_height)
        scale_desc = f"{info.width}x{info.height} → {scale or '維持原尺寸'}"
        print(f"[{index}/{len(videos)}] {src.name}  ({scale_desc})")

        if args.dry_run:
            continue

        cmd = build_ffmpeg_cmd(
            ffmpeg=ffmpeg,
            info=info,
            output=target,
            max_height=args.max_height,
            crf=args.crf,
            preset=args.preset,
            audio_bitrate=args.audio_bitrate,
            overwrite=args.overwrite,
        )
        try:
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as exc:
            sys.stderr.write(f"[錯誤] 壓縮失敗：{src.name} ({exc})\n")
            if target.exists():
                target.unlink(missing_ok=True)
            failed += 1
            continue

        in_size = src.stat().st_size
        out_size = target.stat().st_size
        total_in += in_size
        total_out += out_size
        success += 1
        ratio = (1 - out_size / in_size) * 100 if in_size else 0
        print(f"    ✓ {human_size(in_size)} → {human_size(out_size)} (省 {ratio:.1f}%)")

    print("\n完成：")
    print(f"  成功 {success}　跳過 {skipped}　失敗 {failed}")
    if success and total_in:
        overall = (1 - total_out / total_in) * 100
        print(f"  總計 {human_size(total_in)} → {human_size(total_out)}（節省 {overall:.1f}%）")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
