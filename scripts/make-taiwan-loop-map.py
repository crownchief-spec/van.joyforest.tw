#!/usr/bin/env python3
"""Render the bilingual 13-day Taiwan campervan route map.

County geometry source: National Land Surveying and Mapping Center,
Ministry of the Interior (Taiwan), COUNTY_MOI_1090820.
Dataset page: https://data.gov.tw/dataset/7442
"""

from __future__ import annotations

import argparse
from pathlib import Path

import shapefile
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/images/trip-ideas/taiwan-counterclockwise-campervan-loop-13-days/taiwan-counties-counterclockwise-campervan-route-map.webp"
MOBILE_OUT = ROOT / "assets/images/trip-ideas/taiwan-counterclockwise-campervan-loop-13-days/taiwan-counties-counterclockwise-campervan-route-map-mobile.webp"
ZH_FONT = "/System/Library/Fonts/STHeiti Medium.ttc"
EN_FONT = "/System/Library/Fonts/Supplemental/Arial.ttf"

W, H = 1800, 1600
BG = "#F7F2E8"
SEA = "#DDEFF1"
LAND = "#DDE9D5"
INK = "#173C3A"
MUTED = "#657A75"
COUNTY_LINE = "#91AAA2"
ROUTE = "#E87545"
ROUTE_DARK = "#A94427"
WHITE = "#FFFDFC"

MAIN_BOUNDS = (119.95, 21.82, 122.08, 25.34)
MAIN_BOX = (610, 170, 1190, 1450)

LABELS = {
    "新北市": (50, 190), "桃園市": (50, 275), "新竹縣": (50, 360), "新竹市": (50, 445),
    "苗栗縣": (50, 530), "臺中市": (50, 615), "彰化縣": (50, 700), "南投縣": (50, 785),
    "雲林縣": (50, 870), "嘉義縣": (50, 955), "嘉義市": (50, 1040), "臺南市": (50, 1125),
    "高雄市": (50, 1210), "屏東縣": (50, 1295),
    "基隆市": (1280, 190), "臺北市": (1280, 275), "宜蘭縣": (1280, 380),
    "花蓮縣": (1280, 650), "臺東縣": (1280, 930),
}

ROUTE_POINTS = [
    (121.233, 25.078),  # Day 1 Taoyuan Airport
    (120.710, 24.610),  # Day 2 Miaoli
    (120.680, 24.150),  # Taichung
    (120.440, 24.060),  # Day 3 Lukang
    (120.910, 23.860),  # Sun Moon Lake
    (120.800, 23.510),  # Day 4 Alishan
    (120.500, 23.340),  # Day 5 Guanziling
    (120.210, 22.990),  # Day 6 Tainan
    (120.300, 22.630),  # Kaohsiung
    (120.450, 22.470),  # Day 7 Donggang
    (120.800, 21.950),  # Day 8 Kenting
    (121.150, 22.760),  # Day 9 Taitung
    (121.300, 23.120),  # Day 10 east coast
    (121.610, 23.990),  # Hualien
    (121.650, 24.170),  # Day 11 Chongde
    (121.750, 24.760),  # Day 12 Yilan
    (121.560, 25.030),  # Day 13 Taipei
]

DAY_NODES = [
    (1, (121.233, 25.078)), (2, (120.680, 24.150)), (3, (120.910, 23.860)),
    (4, (120.800, 23.510)), (5, (120.500, 23.340)), (6, (120.300, 22.630)),
    (7, (120.450, 22.470)), (8, (120.800, 21.950)), (9, (121.150, 22.760)),
    (10, (121.300, 23.120)), (11, (121.650, 24.170)), (12, (121.750, 24.760)),
    (13, (121.560, 25.030)),
]


def font(path: str, size: int):
    return ImageFont.truetype(path, size)


def project(point, bounds=MAIN_BOUNDS, box=MAIN_BOX):
    lon, lat = point
    min_lon, min_lat, max_lon, max_lat = bounds
    left, top, right, bottom = box
    x = left + (lon - min_lon) / (max_lon - min_lon) * (right - left)
    y = top + (max_lat - lat) / (max_lat - min_lat) * (bottom - top)
    return round(x), round(y)


def visible_main_part(points):
    return [p for p in points if MAIN_BOUNDS[0] <= p[0] <= MAIN_BOUNDS[2] and MAIN_BOUNDS[1] <= p[1] <= MAIN_BOUNDS[3]]


def shape_parts(shape):
    starts = list(shape.parts) + [len(shape.points)]
    return [shape.points[starts[i]:starts[i + 1]] for i in range(len(starts) - 1)]


def record_centroid(shape, box=MAIN_BOX):
    points = visible_main_part(shape.points)
    if not points:
        return None
    return project((sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)), MAIN_BOUNDS, box)


def draw_label(draw, xy, zh, en, target, left_side, *, width=460, height=70,
               zh_size=24, en_size=18, padding=18, zh_offset=8, en_offset=38,
               elbow_x=None):
    x, y = xy
    w, h = width, height
    draw.rounded_rectangle((x, y, x + w, y + h), 15, fill=WHITE, outline="#DED6C8", width=2)
    draw.text((x + padding, y + zh_offset), zh, font=font(ZH_FONT, zh_size), fill=INK)
    draw.text((x + padding, y + en_offset), en, font=font(EN_FONT, en_size), fill=MUTED)
    start = (x + w, y + h // 2) if left_side else (x, y + h // 2)
    elbow_x = elbow_x if elbow_x is not None else (575 if left_side else 1225)
    draw.line((start, (elbow_x, start[1]), target), fill=COUNTY_LINE, width=2)
    draw.ellipse((target[0] - 3, target[1] - 3, target[0] + 3, target[1] + 3), fill=INK)


def draw_inset(draw, title_zh, title_en, box, shapes, *, zh_size=23, en_size=17,
               header_height=78, padding=20):
    x1, y1, x2, y2 = box
    draw.rounded_rectangle(box, 18, fill=WHITE, outline="#DED6C8", width=2)
    draw.text((x1 + 18, y1 + 10), title_zh, font=font(ZH_FONT, zh_size), fill=INK)
    draw.text((x1 + 18, y1 + 42), title_en, font=font(EN_FONT, en_size), fill=MUTED)
    all_points = [p for shape in shapes for part in shape_parts(shape) for p in part]
    if not all_points:
        return
    min_lon = min(p[0] for p in all_points); max_lon = max(p[0] for p in all_points)
    min_lat = min(p[1] for p in all_points); max_lat = max(p[1] for p in all_points)
    map_box = (x1 + padding, y1 + header_height, x2 - padding, y2 - padding)
    bounds = (min_lon, min_lat, max_lon, max_lat)
    for shape in shapes:
        for part in shape_parts(shape):
            if len(part) >= 3:
                draw.polygon([project(p, bounds, map_box) for p in part], fill=LAND, outline=COUNTY_LINE)


def render_mobile_map(features):
    """A portrait map whose bilingual county labels stay legible on a phone."""
    mobile_w, mobile_h = 1000, 1670
    main_box = (300, 205, 700, 1400)
    labels = {
        "新北市": (20, 245), "桃園市": (20, 327), "新竹縣": (20, 409), "新竹市": (20, 491),
        "苗栗縣": (20, 573), "臺中市": (20, 655), "彰化縣": (20, 737), "南投縣": (20, 819),
        "雲林縣": (20, 901), "嘉義縣": (20, 983), "嘉義市": (20, 1065), "臺南市": (20, 1147),
        "高雄市": (20, 1229), "屏東縣": (20, 1311),
        "基隆市": (720, 245), "臺北市": (720, 331), "宜蘭縣": (720, 417),
        "花蓮縣": (720, 705), "臺東縣": (720, 1008),
    }
    image = Image.new("RGB", (mobile_w, mobile_h), BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((280, 175, 720, 1425), 58, fill=SEA)
    draw.text((30, 28), "臺灣逆時針露營車環島｜13 天 12 夜", font=font(ZH_FONT, 40), fill=INK)
    draw.text((32, 82), "Taiwan Counterclockwise Loop | 13 Days / 12 Nights", font=font(EN_FONT, 25), fill=MUTED)

    centroids = {}
    offshore = {"澎湖縣": [], "金門縣": [], "連江縣": []}
    for record, shape in features:
        name = record["COUNTYNAME"]
        if name in offshore:
            offshore[name].append(shape)
            continue
        for part in shape_parts(shape):
            clipped = visible_main_part(part)
            if len(clipped) >= 3:
                draw.polygon([project(p, MAIN_BOUNDS, main_box) for p in clipped], fill=LAND, outline=COUNTY_LINE)
        centroid = record_centroid(shape, main_box)
        if centroid:
            centroids[name] = (centroid, record["COUNTYENG"])

    for name, xy in labels.items():
        target, en = centroids[name]
        left_side = xy[0] < 300
        draw_label(
            draw, xy, name, en, target, left_side,
            width=260, height=80, zh_size=38, en_size=27, padding=12,
            zh_offset=7, en_offset=45, elbow_x=290 if left_side else 710,
        )

    route_xy = [project(p, MAIN_BOUNDS, main_box) for p in ROUTE_POINTS]
    draw.line(route_xy, fill=WHITE, width=16, joint="curve")
    draw.line(route_xy, fill=ROUTE, width=9, joint="curve")
    for day, point in DAY_NODES:
        x, y = project(point, MAIN_BOUNDS, main_box)
        r = 18 if day < 10 else 21
        draw.ellipse((x-r, y-r, x+r, y+r), fill=WHITE, outline=ROUTE_DARK, width=4)
        label = str(day)
        bbox = draw.textbbox((0, 0), label, font=font(EN_FONT, 18))
        draw.text((x - (bbox[2]-bbox[0])/2, y - (bbox[3]-bbox[1])/2 - 2), label, font=font(EN_FONT, 18), fill=ROUTE_DARK)

    draw_inset(draw, "澎湖縣", "Penghu County", (20, 1470, 330, 1650), offshore["澎湖縣"], zh_size=28, en_size=20)
    draw_inset(draw, "金門縣", "Kinmen County", (345, 1470, 655, 1650), offshore["金門縣"], zh_size=28, en_size=20)
    draw_inset(draw, "連江縣", "Lienchiang County", (670, 1470, 980, 1650), offshore["連江縣"], zh_size=28, en_size=20)
    return image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("shapefile", help="Path to COUNTY_MOI_1090820.shp")
    parser.add_argument("--mobile", action="store_true", help="Render the portrait, phone-readable map")
    args = parser.parse_args()

    reader = shapefile.Reader(args.shapefile, encoding="utf-8")
    features = [(record.as_dict(), shape) for record, shape in zip(reader.records(), reader.shapes())]

    if args.mobile:
        image = render_mobile_map(features)
        MOBILE_OUT.parent.mkdir(parents=True, exist_ok=True)
        image.save(MOBILE_OUT, "WEBP", quality=86, method=6)
        print(f"{MOBILE_OUT}: {image.width}x{image.height}, {MOBILE_OUT.stat().st_size} bytes")
        return

    image = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((560, 130, 1240, 1490), 90, fill=SEA)

    draw.text((58, 38), "臺灣逆時針露營車環島｜13 天 12 夜", font=font(ZH_FONT, 42), fill=INK)
    draw.text((60, 91), "Taiwan Counterclockwise Campervan Loop | 13 Days / 12 Nights", font=font(EN_FONT, 30), fill=MUTED)

    centroids = {}
    offshore = {"澎湖縣": [], "金門縣": [], "連江縣": []}
    for record, shape in features:
        name = record["COUNTYNAME"]
        if name in offshore:
            offshore[name].append(shape)
            continue
        for part in shape_parts(shape):
            clipped = visible_main_part(part)
            if len(clipped) >= 3:
                draw.polygon([project(p) for p in clipped], fill=LAND, outline=COUNTY_LINE)
        c = record_centroid(shape)
        if c:
            centroids[name] = (c, record["COUNTYENG"])

    # County names stay outside the coastline so small northern cities remain readable.
    for name, xy in LABELS.items():
        target, en = centroids[name]
        draw_label(draw, xy, name, en, target, xy[0] < 600)

    draw_inset(draw, "澎湖縣", "Penghu County", (1280, 1100, 1505, 1300), offshore["澎湖縣"])
    draw_inset(draw, "金門縣", "Kinmen County", (1525, 1100, 1750, 1300), offshore["金門縣"])
    draw_inset(draw, "連江縣", "Lienchiang County", (1280, 1320, 1505, 1520), offshore["連江縣"])

    route_xy = [project(p) for p in ROUTE_POINTS]
    draw.line(route_xy, fill=WHITE, width=16, joint="curve")
    draw.line(route_xy, fill=ROUTE, width=9, joint="curve")
    for day, point in DAY_NODES:
        x, y = project(point)
        r = 18 if day < 10 else 21
        draw.ellipse((x-r, y-r, x+r, y+r), fill=WHITE, outline=ROUTE_DARK, width=4)
        label = str(day)
        bbox = draw.textbbox((0, 0), label, font=font(EN_FONT, 18))
        draw.text((x - (bbox[2]-bbox[0])/2, y - (bbox[3]-bbox[1])/2 - 2), label, font=font(EN_FONT, 18), fill=ROUTE_DARK)

    draw.rounded_rectangle((565, 1495, 1235, 1575), 18, fill=WHITE, outline="#DED6C8", width=2)
    draw.line((590, 1535, 660, 1535), fill=ROUTE, width=9)
    draw.text((680, 1508), "桃園機場 → 西部南下 → 東部北上 → 臺北還車", font=font(ZH_FONT, 18), fill=INK)
    draw.text((680, 1540), "Airport → west coast → east coast → Taipei", font=font(EN_FONT, 15), fill=MUTED)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(OUT, "WEBP", quality=86, method=6)
    print(f"{OUT}: {W}x{H}, {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    main()
