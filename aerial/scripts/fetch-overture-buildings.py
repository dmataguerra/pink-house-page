"""Retain complete open building footprints near the supplied house coordinate.

Requires DuckDB (installed separately); remote parquet reads transfer only the
matching row groups. STAC extents select the relevant public partitions first.
"""
import datetime
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".data-tools"))
import duckdb

LAT, LON, RADIUS = 20.707390681241908, -100.44438633247219, 1800
STAC = "https://stac.overturemaps.org"

def get_json(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.load(response)

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--release",default="2026-09-23.1",help="Pinned Overture release, or 'latest' to refresh")
arguments=parser.parse_args()
release = get_json(f"{STAC}/catalog.json")["latest"] if arguments.release=="latest" else arguments.release
collection_url = f"{STAC}/{release}/buildings/building/collection.json"
collection = get_json(collection_url)
dx, dy = RADIUS / (111320 * math.cos(math.radians(LAT))), RADIUS / 111320
bounds = [LON - dx, LAT - dy, LON + dx, LAT + dy]
items = [link for link in collection["links"] if link["rel"] == "item"]
# The collection's first bbox is its global extent; remaining bboxes correspond
# to the individual spatially ordered parquet partitions.
matches = [index for index, box in enumerate(collection["extent"]["spatial"]["bbox"][1:])
           if box[0] < bounds[2] and box[2] > bounds[0] and box[1] < bounds[3] and box[3] > bounds[1]]
urls = [get_json(items[index]["href"])["assets"]["aws"]["href"] for index in matches]
print(f"Overture release {release}; {len(urls)} intersecting spatial partitions.", flush=True)
connection = duckdb.connect()
extension_dir = (ROOT / ".data-tools" / "extensions").as_posix()
connection.execute(f"SET extension_directory='{extension_dir}'")
print("Preparing remote parquet and spatial readers.", flush=True)
for extension in ["httpfs", "spatial"]:
    try:
        connection.execute(f"LOAD {extension}")
    except duckdb.IOException:
        connection.execute(f"INSTALL {extension} FROM 'https://extensions.duckdb.org'; LOAD {extension};")
connection.execute("SET threads=4; SET http_timeout=120000;")
query = """
SELECT id, height, num_floors, class, subtype, CAST(sources AS JSON), ST_AsGeoJSON(geometry)
FROM read_parquet(?)
WHERE bbox.xmin < ? AND bbox.xmax > ? AND bbox.ymin < ? AND bbox.ymax > ?
"""
rows = connection.execute(query, [urls, bounds[2], bounds[0], bounds[3], bounds[1]]).fetchall()
features = [{"type": "Feature", "id": row[0], "properties": {
    "height": row[1], "num_floors": row[2], "class": row[3], "subtype": row[4],
    "sources": json.loads(row[5]), "footprintSource": "Overture Maps Foundation",
}, "geometry": json.loads(row[6])} for row in rows]
output = ROOT / "public" / "open-data"
payload = json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":"))
(output / "overture-buildings.geojson").write_text(payload, encoding="utf8")
sources = sorted({source["dataset"] for feature in features for source in feature["properties"]["sources"]})
provenance = {
    "source": "Overture Maps Foundation", "release": release, "license": collection["license"],
    "licenseUrl": "https://docs.overturemaps.org/attribution/", "catalog": collection_url,
    "attribution": "© OpenStreetMap contributors, Overture Maps Foundation · Microsoft ML Buildings · Google Open Buildings (CC BY 4.0)", "datasets": sources,
    "sourceLicenses": [{"dataset":"Google Open Buildings","license":"CC BY 4.0","licenseUrl":"https://creativecommons.org/licenses/by/4.0/"},
                       {"dataset":"Overture building theme","license":"ODbL-1.0","licenseUrl":"https://opendatacommons.org/licenses/odbl/1-0/"}],
    "fetchedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "queryRadiusMeters": RADIUS,
    "subsetBounds": bounds, "buildings": len(features), "sourcePartitions": urls,
    "subsetSha256": hashlib.sha256(payload.encode()).hexdigest(),
    "limitations": ["Footprints merge open map and imagery-derived outlines; property identity remains unverified.",
                    "Unspecified heights are visualization estimates; no photographic facade or roof geometry is supplied."],
}
(output / "source-overture.json").write_text(json.dumps(provenance, indent=2), encoding="utf8")
print(json.dumps({"buildings": len(features), "datasets": sources, "release": release}), flush=True)
