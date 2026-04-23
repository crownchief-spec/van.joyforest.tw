# tools/

本資料夾放「不會打包進網站、但在本機維護時會用到」的輔助腳本。

## compress_videos.py

批次壓縮 4K 影片為網頁播放用的 H.264 MP4（高度預設限制 1920px，CRF 23、faststart）。

### 安裝需求

僅需 Python 3.9+ 與 ffmpeg：

```bash
# macOS
brew install ffmpeg

# Ubuntu / Debian
sudo apt install ffmpeg
```

### 快速開始

```bash
# 1. 把原始 4K 影片（.mov / .mp4）放到一個資料夾，例如 ~/Downloads/van-clips
# 2. 執行壓縮：
python3 tools/compress_videos.py \
    --input ~/Downloads/van-clips \
    --output ./assets/videos/guide

# 3. 若想先看看會處理哪些檔案（不實際轉檔）：
python3 tools/compress_videos.py -i ~/Downloads/van-clips -o /tmp/out --dry-run
```

### 可調整參數

| 參數 | 預設 | 說明 |
|---|---|---|
| `--max-height` | 1920 | 輸出最大高度（px）。例如 iPhone 直拍 4K (2160×3840) → 1080×1920 |
| `--crf` | 23 | x264 畫質，18~28；越小畫質越好、檔案越大 |
| `--preset` | medium | 編碼速度與壓縮率的平衡；`slow`/`slower` 會產生較小檔案 |
| `--audio-bitrate` | 128k | AAC 音訊位元率 |
| `--recursive` | off | 遞迴搜尋子資料夾 |
| `--overwrite` | off | 若輸出檔已存在就覆蓋 |
| `--dry-run` | off | 不實際轉檔，只列出預計處理的檔案 |

### 輸出特性

- H.264 High Profile Level 4.1 + yuv420p（最廣的瀏覽器相容性）。
- `+faststart`：moov atom 前置，適合網頁串流播放。
- 自動強制寬高為偶數（`scale=-2:H`），避免 H.264 編碼失敗。
- 原始高度 ≤ `--max-height` 時保持原解析度，不做無謂放大。

### 推薦的 SEO 命名慣例

壓縮完成後，建議把檔名改為與頁面 SEO 主題一致的英文短句，例如：

- `taipei-campervan-built-in-generator-start-up-guide.mp4`
- `taipei-campervan-built-in-generator-left-rear-compartment-hookup-guide.mp4`

之後要嵌進頁面時，搭配 `<video>` 的 `poster` 屬性指向同名 JPG 縮圖，並補上中文 `title` 與頁面旁的文字說明即可。
