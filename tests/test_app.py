"""Smoke test buat UI Streamlit pakai AppTest (headless, tanpa server).

Mastiin script app.py kebaca & render awalnya gak error.
"""

from pathlib import Path

from streamlit.testing.v1 import AppTest

APP = str(Path(__file__).parent.parent / "app" / "app.py")


def test_app_boots_without_exception(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'app.db'}")

    at = AppTest.from_file(APP, default_timeout=30).run()

    assert not at.exception
