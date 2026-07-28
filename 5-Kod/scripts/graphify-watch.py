from __future__ import annotations

import argparse
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

os.environ.setdefault("GRAPHIFY_VIZ_NODE_LIMIT", "5000")

from graphify.detect import (  # noqa: E402
    CODE_EXTENSIONS,
    DOC_EXTENSIONS,
    IMAGE_EXTENSIONS,
    PAPER_EXTENSIONS,
    _is_ignored,
    _load_graphifyignore,
    detect,
)
from graphify.watch import (  # noqa: E402
    _notify_only,
    _read_build_gitignore,
    _rebuild_code,
)
from watchdog.events import FileSystemEvent, FileSystemEventHandler  # noqa: E402
from watchdog.observers import Observer  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "graphify-out"
WATCHED_EXTENSIONS = (
    CODE_EXTENSIONS | DOC_EXTENSIONS | PAPER_EXTENSIONS | IMAGE_EXTENSIONS
)
FAILED_FLAG = OUT / "watch.failed"


def _path_key(path: Path) -> str:
    return str(path.resolve(strict=False)).casefold()


def _signature(path: Path) -> tuple[int, int] | None:
    try:
        stat = path.stat()
        return stat.st_mtime_ns, stat.st_size
    except OSError:
        return None


def _render_html() -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "graphify",
            "export",
            "html",
            "--graph",
            str(OUT / "graph.json"),
        ],
        cwd=ROOT,
        check=True,
    )


class GraphifyWatcher:
    def __init__(self, debounce: float) -> None:
        self.debounce = debounce
        self.lock = threading.Lock()
        self.pending: dict[str, Path] = {}
        self.last_event = 0.0
        self.signatures: dict[str, tuple[int, int] | None] = {}
        self.ignore_patterns = _load_graphifyignore(
            ROOT,
            gitignore=_read_build_gitignore(OUT),
        )

    def eligible(self, path: Path) -> bool:
        resolved = path.resolve(strict=False)
        try:
            relative = resolved.relative_to(ROOT)
        except ValueError:
            return False
        if resolved.suffix.lower() not in WATCHED_EXTENSIONS:
            return False
        if "graphify-out" in relative.parts:
            return False
        if any(part.startswith(".") for part in relative.parts):
            return False
        return not (
            self.ignore_patterns
            and _is_ignored(resolved, ROOT, self.ignore_patterns)
        )

    def seed(self) -> None:
        corpus = detect(ROOT)
        files = corpus.get("files", {})
        for category in ("code", "document", "paper", "image"):
            for raw_path in files.get(category, []):
                path = Path(raw_path)
                if self.eligible(path):
                    self.signatures[_path_key(path)] = _signature(path)

    def record(self, raw_path: str | bytes) -> None:
        path = Path(os.fsdecode(raw_path))
        if not self.eligible(path):
            return
        key = _path_key(path)
        signature = _signature(path)
        with self.lock:
            if key in self.signatures and self.signatures[key] == signature:
                return
            self.signatures[key] = signature
            self.pending[key] = path
            self.last_event = time.monotonic()

    def take_batch(self) -> list[Path]:
        with self.lock:
            if not self.pending:
                return []
            if time.monotonic() - self.last_event < self.debounce:
                return []
            batch = list(self.pending.values())
            self.pending.clear()
            return batch

    def retry(self, batch: list[Path]) -> None:
        with self.lock:
            for path in batch:
                self.pending[_path_key(path)] = path
            self.last_event = time.monotonic()


class Handler(FileSystemEventHandler):
    def __init__(self, watcher: GraphifyWatcher) -> None:
        self.watcher = watcher

    def on_created(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self.watcher.record(event.src_path)

    def on_modified(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self.watcher.record(event.src_path)

    def on_deleted(self, event: FileSystemEvent) -> None:
        if not event.is_directory:
            self.watcher.record(event.src_path)

    def on_moved(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        self.watcher.record(event.src_path)
        self.watcher.record(event.dest_path)


def self_check() -> None:
    watcher = GraphifyWatcher(debounce=1.0)
    assert watcher.eligible(ROOT / "apps" / "web" / "sample.ts")
    assert not watcher.eligible(OUT / "sample.ts")
    assert not watcher.eligible(ROOT / "node_modules" / "pkg" / "sample.ts")
    print("Graphify watcher check passed.")


def run(debounce: float) -> None:
    watcher = GraphifyWatcher(debounce)
    watcher.seed()
    observer = Observer()
    observer.schedule(Handler(watcher), str(ROOT), recursive=True)
    observer.start()

    print(f"[graphify live] Watching {ROOT}", flush=True)
    print(
        f"[graphify live] Debounce {debounce:g}s; changed files rebuild incrementally.",
        flush=True,
    )

    try:
        while True:
            time.sleep(0.5)
            batch = watcher.take_batch()
            if not batch:
                continue

            code_paths = [
                path for path in batch if path.suffix.lower() in CODE_EXTENSIONS
            ]
            non_code_paths = [path for path in batch if path not in code_paths]
            print(
                f"[graphify live] Batch: {len(code_paths)} code, "
                f"{len(non_code_paths)} non-code file(s).",
                flush=True,
            )

            ok = True
            if code_paths:
                ok = _rebuild_code(
                    ROOT,
                    changed_paths=code_paths,
                    block_on_lock=True,
                )
                if ok:
                    _render_html()
            if non_code_paths:
                _notify_only(ROOT)

            if ok:
                FAILED_FLAG.unlink(missing_ok=True)
            else:
                FAILED_FLAG.write_text(
                    "Graphify rebuild failed; watcher will retry.\n",
                    encoding="utf-8",
                )
                watcher.retry(batch)
                time.sleep(25)
    except KeyboardInterrupt:
        pass
    finally:
        observer.stop()
        observer.join()


def main() -> None:
    parser = argparse.ArgumentParser(description="Filtered Corevo Graphify watcher")
    parser.add_argument("--debounce", type=float, default=5.0)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        self_check()
        return
    run(args.debounce)


if __name__ == "__main__":
    main()
