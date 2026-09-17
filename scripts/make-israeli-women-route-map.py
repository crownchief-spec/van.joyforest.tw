#!/usr/bin/env python3
"""Create bilingual schematic route maps for the Israeli travelers' 9-day trip."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/images/trip-ideas/israeli-women-taiwan-campervan-road-trip"
ZH_FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
EN_FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"

W, H = 1600, 1120
BG = "#F7F2E8"
CARD = "#FFFDFC"
INK = "#173C3A"
MUTED = "#667B76"
LAND = "#DDE9D5"
OCEAN = "#DDEFF1"
ORANGE = "#E77D4F"
BLUE = "#2A8798"
PURPLE = "#7357A5"
SHADOW = "#D8CEC0"

# Simplified Taiwan main-island outline, used as a clear schematic rather than
# a turn-by-turn navigation map.
TAIWAN = [
    (121.92, 25.02), (121.80, 24.70), (121.87, 24.55), (121.73, 24.28),
    (121.63, 24.02), (121.53, 23.70), (121.43, 23.30), (121.28, 23.00),
    (121.10, 22.78), (120.90, 22.55), (120.84, 22.20), (120.75, 21.94),
    (120.62, 22.30), (120.35, 22.50), (120.18, 22.82), (120.08, 23.10),
    (120.14, 23.45), (120.18, 23.80), (120.35, 24.05), (120.55, 24.40),
    (120.76, 24.65), (120.96, 24.90), (121.18, 25.12), (121.50, 25.28),
    (121.75, 25.16), (121.92, 25.02),
]

PLACES = {
    "taipei": (121.5654, 25.0330),
    "dongao": (121.8310, 24.5180),
    "hualien": (121.6068, 23.9911),
    "fugang": (121.1930, 22.7920),
    "green": (121.4900, 22.6600),
    "zhiben": (121.0400, 22.7050),
    "kenting": (120.7980, 21.9460),
    "sunmoon": (120.9100, 23.8600),
}


def fnt(lang: str, size: int, bold: bool = False):
    path = ZH_FONT if lang == "zh" else EN_FONT
    return ImageFont.truetype(path, size)


def project(point):
    lon, lat = point
    min_lon, max_lon = 120.02, 122.05
    min_lat, max_lat = 21.86, 25.32
    left, top, width, height = 560, 155, 500, 860
    x = left + (lon - min_lon) / (max_lon - min_lon) * width
    y = top + (max_lat - lat) / (max_lat - min_lat) * height
    return round(x), round(y)


def dashed(draw, points, color, width=8, dash=18, gap=12):
    for a, b in zip(points, points[1:]):
        x1, y1 = a
        x2, y2 = b
        dx, dy = x2 - x1, y2 - y1
        length = max((dx * dx + dy * dy) ** 0.5, 1)
        ux, uy = dx / length, dy / length
        pos = 0
        while pos < length:
            end = min(pos + dash, length)
            draw.line((x1 + ux * pos, y1 + uy * pos, x1 + ux * end, y1 + uy * end), fill=color, width=width)
            pos += dash + gap


def marker(draw, point, number, color=ORANGE):
    x, y = point
    draw.ellipse((x - 19, y - 19, x + 19, y + 19), fill=CARD, outline=color, width=5)
    bbox = draw.textbbox((0, 0), str(number), font=fnt("en", 20))
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text((x - tw / 2, y - th / 2 - 2), str(number), font=fnt("en", 20), fill=color)


def info_card(draw, lang, x, y, number, title, detail, target, side):
    w, h = 430, 92
    draw.rounded_rectangle((x + 6, y + 7, x + w + 6, y + h + 7), 20, fill=SHADOW)
    draw.rounded_rectangle((x, y, x + w, y + h), 20, fill=CARD, outline="#E7DDD0", width=2)
    draw.ellipse((x + 18, y + 22, x + 66, y + 70), fill=ORANGE)
    draw.text((x + 34, y + 31), str(number), font=fnt("en", 21), fill="white")
    draw.text((x + 82, y + 14), title, font=fnt(lang, 23), fill=INK)
    draw.text((x + 82, y + 52), detail, font=fnt(lang, 16), fill=MUTED)
    anchor = (x + w, y + h // 2) if side == "left" else (x, y + h // 2)
    elbow = (545, anchor[1]) if side == "left" else (1070, anchor[1])
    dashed(draw, [anchor, elbow, target], "#AAB7AE", width=3, dash=7, gap=7)


def render(lang: str, filename: str):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    if lang == "zh":
        title = "九天八夜｜從台北沿東海岸到綠島、墾丁與日月潭"
        subtitle = "兩位以色列女生的台灣露營車公路旅行（旅客姓名使用化名）"
        cards = [
            (1, "台北交車", "9/7 出發｜自排六人座露營車", "taipei", "left"),
            (2, "東澳 / 睡海邊", "9/7 海邊營地｜粉鳥林", "dongao", "right"),
            (3, "花蓮 / Ocean Chill", "9/8 外接電｜東大門夜市", "hualien", "right"),
            (4, "富岡 / 綠島", "9/10 船班｜朝日溫泉日出", "green", "right"),
            (5, "知本 / 大王山居", "9/11 山林溫泉｜補水充電", "zhiben", "right"),
            (6, "墾丁 / 恆春", "9/12 海岸、古城與玩水", "kenting", "left"),
            (7, "日月潭 / 帖泊喀", "9/13–14 湖景 B 區兩晚", "sunmoon", "left"),
            (8, "返回台北", "9/15 北上還車", "taipei", "left"),
        ]
        note = "實線：露營車移動｜藍色虛線：富岡往返綠島的船程"
    else:
        title = "Nine days from Taipei to the east coast, Green Island, Kenting and Sun Moon Lake"
        subtitle = "A Taiwan campervan road trip by two Israeli women (traveler names are pseudonyms)"
        cards = [
            (1, "Taipei handover", "Sep 7 | Automatic 6-seat campervan", "taipei", "left"),
            (2, "Dong'ao · Sleep by Sea", "Sep 7 | Coast and Fenniaolin", "dongao", "right"),
            (3, "Hualien · Ocean Chill", "Sep 8 | Hook-up and night market", "hualien", "right"),
            (4, "Fugang / Green Island", "Sep 10 | Ferry and sunrise hot spring", "green", "right"),
            (5, "Zhiben · Dawang", "Sep 11 | Forest hot spring campsite", "zhiben", "right"),
            (6, "Kenting · Hengchun", "Sep 12 | Coast, old town and water", "kenting", "left"),
            (7, "Sun Moon Lake · Tiepoka", "Sep 13–14 | Two lake-view nights", "sunmoon", "left"),
            (8, "Return to Taipei", "Sep 15 | Northbound handback", "taipei", "left"),
        ]
        note = "Solid line: campervan route | Blue dashes: ferry between Fugang and Green Island"

    draw.text((70, 43), title, font=fnt(lang, 39 if lang == "zh" else 35), fill=INK)
    draw.text((72, 98), subtitle, font=fnt(lang, 22), fill=MUTED)
    draw.rounded_rectangle((530, 135, 1090, 1035), 130, fill=OCEAN)
    island = [project(p) for p in TAIWAN]
    draw.polygon(island, fill=LAND)
    dashed(draw, island, INK, width=5, dash=12, gap=9)

    route_names = ["taipei", "dongao", "hualien", "fugang", "zhiben", "kenting", "sunmoon", "taipei"]
    route = [project(PLACES[name]) for name in route_names]
    dashed(draw, route, ORANGE, width=9, dash=18, gap=12)
    dashed(draw, [project(PLACES["fugang"]), project(PLACES["green"])], BLUE, width=7, dash=12, gap=10)

    numbered = ["taipei", "dongao", "hualien", "green", "zhiben", "kenting", "sunmoon"]
    for number, name in enumerate(numbered, 1):
        marker(draw, project(PLACES[name]), number, BLUE if name == "green" else ORANGE)

    y_left = [175, 655, 765, 875]
    y_right = [205, 325, 445, 565]
    li = ri = 0
    for number, title_text, detail, name, side in cards:
        if side == "left":
            y = y_left[li]
            li += 1
            x = 55
        else:
            y = y_right[ri]
            ri += 1
            x = 1115
        info_card(draw, lang, x, y, number, title_text, detail, project(PLACES[name]), side)

    draw.rounded_rectangle((420, 1047, 1180, 1097), 20, fill=CARD)
    draw.line((450, 1072, 500, 1072), fill=ORANGE, width=8)
    draw.text((518, 1058), note, font=fnt(lang, 17), fill=MUTED)

    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / filename
    img.save(target, "WEBP", quality=88, method=6)
    print(target)


if __name__ == "__main__":
    render("zh", "israeli-women-route-map-zh.webp")
    render("en", "israeli-women-route-map-en.webp")
