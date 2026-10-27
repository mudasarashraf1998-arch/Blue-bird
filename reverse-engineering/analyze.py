#!/usr/bin/env python3
"""Static reverse engineering of the two APKs, using androguard.

Produces evidence.json: manifest declarations, DEX inventory, ad-surface
indicators, and a before/after diff. Requires: pip install androguard
"""
from __future__ import annotations

import hashlib
import json
import pathlib
import sys
import xml.etree.ElementTree as ET
import zipfile

try:
    from loguru import logger
    logger.remove()
except ImportError:
    pass

from androguard.core.apk import APK
from androguard.core.dex import DEX

ROOT = pathlib.Path(__file__).resolve().parent.parent
APKS = ROOT / "apks"
ANDROID_NS = "{http://schemas.android.com/apk/res/android}"

AD_STRING_MARKERS = (
    "doubleclick", "googlesyndication", "admob", "ca-app-pub", "gms.ads",
    "sponsored", "ad_endPoint", "interstitial", "banner", "tracking_host",
)
AD_COMPONENT_MARKERS = ("adactivity", "adservice", "adreceiver", "adhelper")
AD_PERMISSION_MARKERS = ("INTERNET", "ACCESS_NETWORK_STATE", "RECEIVE_BOOT_COMPLETED", "AD_ID")


def sha256(path: pathlib.Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def text_of(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", "replace")
    return str(value)


def inspect(path: pathlib.Path) -> dict:
    apk = APK(str(path))
    manifest_xml = text_of(apk.get_android_manifest_axml().get_xml())
    root = ET.fromstring(manifest_xml)

    meta_data = []
    for node in root.iter("meta-data"):
        meta_data.append({
            "name": node.attrib.get(ANDROID_NS + "name"),
            "value": node.attrib.get(ANDROID_NS + "value"),
        })

    dex_blobs = list(apk.get_all_dex())
    classes, strings = [], []
    dex_sizes = []
    for blob in dex_blobs:
        dex_sizes.append(len(blob))
        dex = DEX(blob)
        for cls in dex.get_classes():
            classes.append(cls.get_name())
        for item in dex.get_strings():
            raw = item.get() if hasattr(item, "get") else item
            strings.append(text_of(raw))

    ad_strings = sorted({
        s for s in strings
        if any(marker in s.lower() for marker in AD_STRING_MARKERS)
    })
    ad_classes = sorted({
        c for c in classes
        if any(marker in c.lower() for marker in AD_COMPONENT_MARKERS)
    })

    with zipfile.ZipFile(path) as zf:
        entries = zf.namelist()

    permissions = sorted(apk.get_permissions())
    return {
        "file": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "package": apk.get_package(),
        "app_label": apk.get_app_name(),
        "version_name": apk.get_androidversion_name(),
        "version_code": apk.get_androidversion_code(),
        "min_sdk": apk.get_min_sdk_version(),
        "target_sdk": apk.get_target_sdk_version(),
        "permissions": permissions,
        "activities": sorted(apk.get_activities()),
        "services": sorted(apk.get_services()),
        "receivers": sorted(apk.get_receivers()),
        "providers": sorted(apk.get_providers()),
        "meta_data": meta_data,
        "manifest_xml": manifest_xml,
        "zip_entries": sorted(entries),
        "dex_sizes": dex_sizes,
        "class_count": len(classes),
        "classes": sorted(classes),
        "string_count": len(strings),
        "ad_strings": ad_strings,
        "ad_classes": ad_classes,
        "ad_permissions": [p for p in permissions if any(m in p for m in AD_PERMISSION_MARKERS)],
        "network_endpoints": sorted({s for s in strings if s.startswith("http://") or s.startswith("https://")}),
    }


def simple(name: str) -> str:
    """Normalise a component/class name so a package rename is not a removal."""
    name = name.strip("L;").replace("/", ".")
    return name.rsplit(".", 1)[-1]


def diff(reference: dict, clean: dict) -> dict:
    def removed(key):
        return sorted(set(reference[key]) - set(clean[key]))

    def removed_simple(key):
        return sorted(
            {simple(x) for x in reference[key]} - {simple(x) for x in clean[key]}
        )

    return {
        "package_changed": [reference["package"], clean["package"]],
        "label_changed": [reference["app_label"], clean["app_label"]],
        "permissions_removed": removed("permissions"),
        "permissions_added": sorted(set(clean["permissions"]) - set(reference["permissions"])),
        "activities_removed": removed_simple("activities"),
        "services_removed": removed_simple("services"),
        "receivers_removed": removed_simple("receivers"),
        "meta_data_removed": [m for m in reference["meta_data"] if m not in clean["meta_data"]],
        "ad_classes_removed": removed_simple("ad_classes"),
        "ad_strings_removed": removed("ad_strings"),
        "network_endpoints_removed": removed("network_endpoints"),
        "core_activity_preserved": "MainActivity" in {simple(x) for x in clean["activities"]},
        "class_count": [reference["class_count"], clean["class_count"]],
        "string_count": [reference["string_count"], clean["string_count"]],
        "bytes": [reference["bytes"], clean["bytes"]],
    }


def main() -> int:
    ref_path = APKS / "BlueBird-Reference.apk"
    clean_path = APKS / "BlueBird-AdFree.apk"
    for p in (ref_path, clean_path):
        if not p.is_file():
            print(f"missing APK: {p}", file=sys.stderr)
            return 1

    reference = inspect(ref_path)
    clean = inspect(clean_path)
    out = {
        "tool": "androguard static analysis",
        "method": "binary AXML manifest decode + DEX string/class enumeration + ZIP inventory",
        "reference": reference,
        "ad_free": clean,
        "diff": diff(reference, clean),
    }
    target = pathlib.Path(__file__).resolve().parent / "evidence.json"
    target.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    d = out["diff"]
    print(json.dumps({
        "reference_package": reference["package"],
        "ad_free_package": clean["package"],
        "permissions_removed": d["permissions_removed"],
        "components_removed": d["activities_removed"] + d["services_removed"] + d["receivers_removed"],
        "ad_strings_removed_count": len(d["ad_strings_removed"]),
        "ad_classes_removed_count": len(d["ad_classes_removed"]),
        "network_endpoints_removed_count": len(d["network_endpoints_removed"]),
        "evidence": str(target),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
