#!/usr/bin/env python3
"""Render localized schematic route maps for the British/Australian guest story."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets/images/trip-ideas/british-australian-guests-taiwan-campervan-road-trip"
ZH_FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
EN_FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"

W, H = 1600, 1100
BG = "#F7F2E8"
INK = "#173C3A"
MUTED = "#667B76"
LAND = "#DDE9D5"
OCEAN = "#DDEFF1"
ORANGE = "#E77D4F"
ORANGE_DARK = "#B74F31"
PURPLE = "#7357A5"
BLUE = "#2A8798"
CARD = "#FFFDFC"
SHADOW = "#D8CEC0"

# Taiwan main-island coastline simplified from Natural Earth 1:10m geometry:
# https://github.com/nvkelso/natural-earth-vector
# Natural Earth data is in the public domain. The geometry is embedded so map
# generation remains deterministic and does not need network access.
TAIWAN_MAIN_ISLAND_LONLAT = [
    (121.905772, 24.950100), (121.823497, 24.854926),
    (121.806814, 24.778754), (121.814952, 24.644355),
    (121.881847, 24.597805), (121.840831, 24.590318),
    (121.855968, 24.550523), (121.830089, 24.519232),
    (121.840017, 24.481350), (121.780040, 24.432685),
    (121.758556, 24.332343), (121.772716, 24.309231),
    (121.662852, 24.193101), (121.607432, 24.076850),
    (121.629161, 24.014960), (121.521495, 23.658677),
    (121.462169, 23.343004), (121.408865, 23.254584),
    (121.400076, 23.145494), (121.347423, 23.083319),
    (121.299571, 22.959174), (121.190278, 22.843166),
    (121.177419, 22.778632), (121.029063, 22.657538),
    (120.948253, 22.526801), (120.881358, 22.345933),
    (120.879242, 22.055813), (120.835704, 21.987250),
    (120.840343, 21.904608), (120.767426, 21.959296),
    (120.737315, 21.966132), (120.714366, 21.937486),
    (120.681651, 22.022528), (120.696951, 22.113227),
    (120.621267, 22.295071), (120.511974, 22.424750),
    (120.380870, 22.483873), (120.285167, 22.580064),
    (120.333669, 22.525946), (120.327973, 22.551703),
    (120.245779, 22.642524), (120.246349, 22.709906),
    (120.142100, 22.980292), (120.166189, 23.031724),
    (120.114106, 23.007636), (120.107921, 23.048570),
    (120.055186, 23.043687), (120.059418, 23.075873),
    (120.100434, 23.096991), (120.059418, 23.110663),
    (120.089203, 23.117743), (120.059418, 23.151028),
    (120.086925, 23.182034), (120.116527, 23.317897),
    (120.148936, 23.322252), (120.120779, 23.341254),
    (120.164577, 23.361711), (120.130544, 23.450995),
    (120.157544, 23.491476), (120.125029, 23.489611),
    (120.124262, 23.520021), (120.184418, 23.764390),
    (120.292247, 23.911933), (120.350352, 24.038072),
    (120.411876, 24.096910), (120.422048, 24.152167),
    (120.493175, 24.230658), (120.558116, 24.385891),
    (120.648936, 24.483873), (120.702159, 24.607001),
    (120.778087, 24.665717), (120.826671, 24.666083),
    (120.926036, 24.884711), (121.059337, 25.050238),
    (121.378754, 25.157945), (121.443207, 25.136420),
    (121.395763, 25.182807), (121.436290, 25.241441),
    (121.497813, 25.278754), (121.580821, 25.283026),
    (121.649669, 25.197089), (121.684418, 25.200507),
    (121.676443, 25.179389), (121.703868, 25.156887),
    (121.905121, 25.106594), (121.919200, 25.022040),
    (122.005382, 25.001899), (121.905772, 24.950100),
]


def font(lang: str, size: int):
    return ImageFont.truetype(ZH_FONT if lang == "zh" else EN_FONT, size)


def dashed_line(draw, points, fill, width=8, dash=14, gap=12):
    for p1, p2 in zip(points, points[1:]):
        x1, y1 = p1
        x2, y2 = p2
        dx, dy = x2 - x1, y2 - y1
        length = max((dx * dx + dy * dy) ** 0.5, 1)
        ux, uy = dx / length, dy / length
        pos = 0
        while pos < length:
            end = min(pos + dash, length)
            draw.line((x1 + ux * pos, y1 + uy * pos, x1 + ux * end, y1 + uy * end), fill=fill, width=width)
            pos += dash + gap


def taiwan_project(lonlat):
    """Project Taiwan longitude/latitude into the central map panel."""
    lon, lat = lonlat
    min_lon, max_lon = 120.052419, 122.005382
    min_lat, max_lat = 21.904608, 25.287421
    left, top, width, height = 615, 150, 430, 850
    x = left + (lon - min_lon) / (max_lon - min_lon) * width
    y = top + (max_lat - lat) / (max_lat - min_lat) * height
    return (round(x), round(y))


def draw_icon(draw, center, kind, color):
    x, y = center
    draw.ellipse((x - 27, y - 27, x + 27, y + 27), fill="#FFFFFF", outline=color, width=3)
    if kind == "airport":
        draw.line((x - 14, y + 10, x + 15, y - 11), fill=color, width=4)
        draw.polygon([(x + 15, y - 11), (x + 7, y + 2), (x + 20, y - 2)], fill=color)
        draw.line((x - 4, y + 1, x - 15, y - 3), fill=color, width=3)
    elif kind == "rock":
        draw.polygon([(x - 15, y + 13), (x - 10, y - 5), (x - 3, y - 13), (x + 8, y - 9), (x + 15, y + 13)], fill=color)
        draw.line((x - 19, y + 15, x + 20, y + 15), fill=color, width=3)
    elif kind == "coast":
        for off in (-6, 5):
            draw.arc((x - 18, y + off - 8, x, y + off + 8), 200, 340, fill=color, width=3)
            draw.arc((x, y + off - 8, x + 18, y + off + 8), 200, 340, fill=color, width=3)
    elif kind == "cliff":
        draw.polygon([(x - 18, y + 16), (x - 10, y - 16), (x + 4, y - 4), (x + 8, y + 16)], fill=color)
        draw.arc((x, y + 3, x + 22, y + 22), 195, 345, fill=color, width=3)
    elif kind == "camp":
        draw.polygon([(x - 18, y + 14), (x, y - 14), (x + 18, y + 14)], outline=color)
        draw.line((x, y - 14, x, y + 14), fill=color, width=3)
        draw.line((x - 18, y + 14, x + 18, y + 14), fill=color, width=3)
    elif kind == "gorge":
        draw.line((x - 15, y - 15, x - 8, y + 16), fill=color, width=5)
        draw.line((x + 15, y - 15, x + 8, y + 16), fill=color, width=5)
        draw.line((x - 3, y - 12, x + 2, y + 16), fill=BLUE, width=3)
    elif kind == "mountain":
        draw.polygon([(x - 20, y + 15), (x - 2, y - 15), (x + 9, y + 2), (x + 15, y - 7), (x + 22, y + 15)], fill=color)
        draw.polygon([(x - 6, y - 8), (x - 2, y - 15), (x + 3, y - 7)], fill="#FFFFFF")
    elif kind == "lake":
        draw.ellipse((x - 18, y - 12, x + 18, y + 12), fill=BLUE)
        draw.arc((x - 12, y - 3, x + 12, y + 10), 10, 170, fill="#FFFFFF", width=2)
    elif kind == "tower":
        draw.rectangle((x - 8, y - 15, x + 8, y + 15), fill=color)
        draw.rectangle((x - 12, y - 10, x + 12, y - 5), fill=color)
        draw.rectangle((x - 12, y, x + 12, y + 5), fill=color)
        draw.line((x, y - 21, x, y - 15), fill=color, width=3)


def card(draw, lang, x, y, w, number, title, subtitle, icon, side, target):
    h = 102
    draw.rounded_rectangle((x + 7, y + 8, x + w + 7, y + h + 8), 22, fill=SHADOW)
    draw.rounded_rectangle((x, y, x + w, y + h), 22, fill=CARD, outline="#E7DDD0", width=2)
    icon_x = x + 50 if side == "left" else x + w - 50
    draw_icon(draw, (icon_x, y + 51), icon, ORANGE_DARK if number < 8 else PURPLE)
    text_x = x + 91 if side == "left" else x + 22
    title_font = font(lang, 25 if lang == "zh" else 23)
    sub_font = font(lang, 17 if lang == "zh" else 16)
    draw.text((text_x, y + 20), f"{number:02d}  {title}", font=title_font, fill=INK)
    draw.text((text_x, y + 60), subtitle, font=sub_font, fill=MUTED)
    start = (x + w, y + h // 2) if side == "left" else (x, y + h // 2)
    bend_x = 630 if side == "left" else 1060
    dashed_line(draw, [start, (bend_x, start[1]), target], "#AAB7AE", width=3, dash=7, gap=7)


def render(lang: str, output_name: str):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # Soft Pacific field behind the island.
    draw.rounded_rectangle((575, 118, 1085, 1015), 120, fill=OCEAN)

    title = "第一次來台灣，開著露營車看海、翻山、抵達湖泊" if lang == "zh" else "A first Taiwan campervan journey—from coast to mountains and lake"
    sub = "七天六夜半環島＋還車後台北半日行" if lang == "zh" else "Seven days across half the island + a final half-day in Taipei"
    draw.text((80, 45), title, font=font(lang, 42 if lang == "zh" else 39), fill=INK)
    draw.text((82, 101), sub, font=font(lang, 23), fill=MUTED)

    # Use a real Taiwan coastline as the travel-map base, then keep the soft,
    # semi-transparent-looking fill and dotted outline requested for the story.
    island = [taiwan_project(point) for point in TAIWAN_MAIN_ISLAND_LONLAT]
    draw.polygon(island, fill=LAND)
    dashed_line(draw, island, INK, width=5, dash=12, gap=10)

    nodes = {
        "airport": taiwan_project((121.2328, 25.0777)),
        "yehliu": taiwan_project((121.6906, 25.2059)),
        "yilan": taiwan_project((121.7530, 24.7570)),
        "qingshui": taiwan_project((121.8000, 24.3800)),
        "chongde": taiwan_project((121.7000, 24.2400)),
        "taroko": taiwan_project((121.6200, 24.1500)),
        "wuling": taiwan_project((121.2750, 24.1370)),
        "sunmoon": taiwan_project((120.9100, 23.8600)),
        "taipei": taiwan_project((121.5654, 25.0339)),
    }

    main_route = [nodes[k] for k in ("airport", "yehliu", "yilan", "qingshui", "chongde", "taroko", "wuling", "sunmoon")]
    dashed_line(draw, main_route, ORANGE, width=9, dash=18, gap=13)
    return_route = [
        nodes["sunmoon"],
        taiwan_project((120.6800, 24.1500)),
        taiwan_project((120.9700, 24.8000)),
        nodes["airport"],
    ]
    dashed_line(draw, return_route, BLUE, width=5, dash=11, gap=10)
    dashed_line(draw, [nodes["airport"], nodes["taipei"]], PURPLE, width=5, dash=6, gap=6)

    for i, p in enumerate(main_route, 1):
        draw.ellipse((p[0] - 15, p[1] - 15, p[0] + 15, p[1] + 15), fill=CARD, outline=ORANGE_DARK, width=4)
        draw.text((p[0] - (7 if i < 10 else 13), p[1] - 13), str(i), font=font(lang, 18), fill=ORANGE_DARK)
    draw.ellipse((nodes["taipei"][0] - 13, nodes["taipei"][1] - 13, nodes["taipei"][0] + 13, nodes["taipei"][1] + 13), fill=CARD, outline=PURPLE, width=4)

    if lang == "zh":
        cards = [
            (80, 190, 450, 1, "桃園機場第一航廈", "露營車交車｜海邊第一晚", "airport", "left", nodes["airport"]),
            (80, 320, 450, 2, "北海岸｜野柳", "女王頭地景｜萬里海鮮", "rock", "left", nodes["yehliu"]),
            (80, 730, 450, 8, "日月潭", "湖畔夕陽｜自行車｜纜車", "lake", "left", nodes["sunmoon"]),
            (80, 860, 450, 9, "台北 101 半日行", "台北車站寄行李｜捷運紅線", "tower", "left", nodes["taipei"]),
            (1090, 180, 430, 3, "宜蘭｜蘇花公路", "東北角接上太平洋海岸", "coast", "right", nodes["yilan"]),
            (1090, 310, 430, 4, "清水斷崖", "巨大山壁落入藍綠色海面", "cliff", "right", nodes["qingshui"]),
            (1090, 440, 430, 5, "花蓮崇德", "太魯閣北側山腳營地", "camp", "right", nodes["chongde"]),
            (1090, 570, 430, 6, "太魯閣｜中橫", "峽谷｜河流｜隧道與橋梁", "gorge", "right", nodes["taroko"]),
            (1090, 700, 430, 7, "合歡山｜武嶺", "約 3,275 公尺｜旅程最高點", "mountain", "right", nodes["wuling"]),
        ]
        legend = [(ORANGE, "露營車旅行路線"), (BLUE, "返回桃園"), (PURPLE, "還車後台北捷運半日行")]
    else:
        cards = [
            (55, 190, 490, 1, "Taoyuan Airport T1", "Campervan handover · first coastal night", "airport", "left", nodes["airport"]),
            (55, 320, 490, 2, "North Coast · Yehliu", "Queen's Head rocks · Wanli seafood", "rock", "left", nodes["yehliu"]),
            (55, 730, 490, 8, "Sun Moon Lake", "Sunset · bicycle · cable car", "lake", "left", nodes["sunmoon"]),
            (55, 860, 490, 9, "Taipei 101 half-day", "Bag storage · Taipei MRT Red Line", "tower", "left", nodes["taipei"]),
            (1060, 180, 485, 3, "Yilan · Suhua Highway", "Northeast Coast meets the Pacific", "coast", "right", nodes["yilan"]),
            (1060, 310, 485, 4, "Qingshui Cliff", "Mountains falling into turquoise water", "cliff", "right", nodes["qingshui"]),
            (1060, 440, 485, 5, "Chongde, Hualien", "Mountain campsite north of Taroko", "camp", "right", nodes["chongde"]),
            (1060, 570, 485, 6, "Taroko · Cross-Island Hwy", "Gorge · river · tunnels · bridges", "gorge", "right", nodes["taroko"]),
            (1060, 700, 485, 7, "Hehuanshan · Wuling", "About 3,275 m · the journey's high point", "mountain", "right", nodes["wuling"]),
        ]
        legend = [(ORANGE, "Campervan route"), (BLUE, "Freeway return to Taoyuan"), (PURPLE, "Post-return Taipei MRT half-day")]

    for args in cards:
        card(draw, lang, *args)

    lx, ly = 590, 1040
    for color, label in legend:
        draw.line((lx, ly, lx + 45, ly), fill=color, width=7)
        draw.text((lx + 58, ly - 14), label, font=font(lang, 17), fill=MUTED)
        lx += 300 if lang == "zh" else 330

    out = OUT_DIR / output_name
    img.save(out, "WEBP", quality=84, method=6)
    print(f"{out}: {img.size[0]}x{img.size[1]}, {out.stat().st_size} bytes")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    render("zh", "taiwan-campervan-road-trip-route-map-zh.webp")
    render("en", "taiwan-campervan-road-trip-route-map-en.webp")


if __name__ == "__main__":
    main()
