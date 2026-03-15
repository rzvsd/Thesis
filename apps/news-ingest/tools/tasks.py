from __future__ import annotations

import py_compile
import shutil
import sys
import unittest
from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
DIST_ROOT = APP_ROOT / "dist"
PYTHON_DIRS = ("src", "tests", "tools")


def iter_python_files() -> list[Path]:
    files: list[Path] = []
    for directory_name in PYTHON_DIRS:
        directory = APP_ROOT / directory_name
        if not directory.exists():
            continue
        for path in directory.rglob("*.py"):
            if "__pycache__" not in path.parts:
                files.append(path)
    return sorted(files)


def compile_sources() -> None:
    for path in iter_python_files():
        py_compile.compile(str(path), doraise=True)


def run_build() -> None:
    compile_sources()
    if DIST_ROOT.exists():
        for path in DIST_ROOT.iterdir():
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()
    DIST_ROOT.mkdir(exist_ok=True)
    build_note = DIST_ROOT / "BUILD_ARTIFACTS.txt"
    build_note.write_text(
        "news-ingest Python sources compiled successfully.\n",
        encoding="utf8",
    )


def run_checks() -> None:
    compile_sources()


def run_tests() -> None:
    compile_sources()
    src_root = APP_ROOT / "src"
    if str(src_root) not in sys.path:
        sys.path.insert(0, str(src_root))
    suite = unittest.defaultTestLoader.discover(str(APP_ROOT / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if not result.wasSuccessful():
        raise SystemExit(1)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: python tools/tasks.py [build|lint|typecheck|test]")

    command = sys.argv[1]
    if command == "build":
        run_build()
        return
    if command in {"lint", "typecheck"}:
        run_checks()
        return
    if command == "test":
        run_tests()
        return

    raise SystemExit(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
