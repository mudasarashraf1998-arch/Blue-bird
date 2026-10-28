#!/usr/bin/env python3
"""Render one build variant (Java sources + manifest) from the shared templates.

Usage: generate.py <reference|adfree> <output-dir>
"""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
TPL = ROOT / "templates"

REFERENCE_ADS_BLOCK = """        TextView banner = new TextView(this);
        banner.setText("Sponsored - example-ad-network.example/promo");
        banner.setTextColor(Color.rgb(255, 210, 120));
        banner.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        banner.setGravity(Gravity.CENTER);
        banner.setPadding(16, 48, 16, 16);
        root.addView(banner);
        AdHelper.loadBanner(this);"""

ADFREE_ADS_BLOCK = """        // Ad surface intentionally absent: no SDK, no network permission, no endpoints."""

REFERENCE_PERMISSIONS = """  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
  <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />"""

REFERENCE_COMPONENTS = """    <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID"
        android:value="ca-app-pub-3940256099942544~3347511713" />
    <meta-data android:name="com.google.android.gms.ads.AD_MANAGER_APP"
        android:value="true" />
    <activity android:name=".AdActivity" android:exported="false" />
    <service android:name=".AdService" android:exported="false" />
    <receiver android:name=".AdReceiver" android:exported="false">
      <intent-filter>
        <action android:name="android.intent.action.BOOT_COMPLETED" />
      </intent-filter>
    </receiver>"""

VARIANTS = {
    "reference": {
        "package": "com.bluebird.reference",
        "label": "BlueBird Reference",
        "ads_block": REFERENCE_ADS_BLOCK,
        "permissions": REFERENCE_PERMISSIONS,
        "components": REFERENCE_COMPONENTS,
        "extra_java": ("AdHelper", "AdActivity", "AdService", "AdReceiver"),
    },
    "adfree": {
        "package": "bluebird.adfree",
        "label": "BlueBird AdFree",
        "ads_block": ADFREE_ADS_BLOCK,
        "permissions": "",
        "components": "",
        "extra_java": (),
    },
}


def render(template: str, **values: str) -> str:
    text = (TPL / template).read_text(encoding="utf-8")
    for key, value in values.items():
        text = text.replace("__" + key.upper() + "__", value)
    if "__" in text:
        left = sorted({w for w in text.split() if w.startswith("__") and w.endswith("__")})
        raise ValueError(f"unresolved placeholders in {template}: {left}")
    return text


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[1] not in VARIANTS:
        print(f"usage: {sys.argv[0]} <reference|adfree> <output-dir>", file=sys.stderr)
        return 2

    variant = sys.argv[1]
    cfg = VARIANTS[variant]
    out = pathlib.Path(sys.argv[2]).resolve()
    src = out / "src" / pathlib.Path(*cfg["package"].split("."))
    src.mkdir(parents=True, exist_ok=True)

    (src / "MainActivity.java").write_text(
        render("MainActivity.java.tpl", package=cfg["package"], label=cfg["label"], ads_block=cfg["ads_block"]),
        encoding="utf-8",
    )
    for name in cfg["extra_java"]:
        (src / f"{name}.java").write_text(
            render(f"{name}.java.tpl", package=cfg["package"]), encoding="utf-8"
        )

    (out / "AndroidManifest.xml").write_text(
        render(
            "AndroidManifest.xml.tpl",
            package=cfg["package"],
            label=cfg["label"],
            ad_permissions=cfg["permissions"],
            ad_components=cfg["components"],
        ),
        encoding="utf-8",
    )
    print(f"[{variant}] package={cfg['package']} label={cfg['label']!r} "
          f"java_files={1 + len(cfg['extra_java'])} output={out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
