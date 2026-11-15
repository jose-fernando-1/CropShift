"""Provenance for every extracted file: where it came from, when, and its checksum."""

import hashlib
import json
from datetime import UTC, datetime
from pathlib import Path


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(
    target_dir: Path,
    *,
    source: str,
    url: str,
    params: dict | None,
    files: list[Path],
    licence: str,
    notes: str = "",
) -> Path:
    """Write `<target_dir>/manifest.json` describing `files` (relative names, sha256, size)."""
    manifest = {
        "source": source,
        "url": url,
        "params": params or {},
        "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "licence": licence,
        "notes": notes,
        "files": [{"name": f.name, "sha256": sha256_of(f), "bytes": f.stat().st_size} for f in files],
    }
    path = target_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return path


def is_current(target_dir: Path, name: str) -> bool:
    """True when `name` exists and matches the sha256 recorded in the manifest (skip re-download)."""
    manifest_path = target_dir / "manifest.json"
    file_path = target_dir / name
    if not (manifest_path.exists() and file_path.exists()):
        return False
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    recorded = {f["name"]: f["sha256"] for f in manifest.get("files", [])}
    return recorded.get(name) == sha256_of(file_path)
