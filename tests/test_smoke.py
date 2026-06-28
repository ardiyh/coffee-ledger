"""Smoke test: pastikan package ke-import (validasi src-layout + install editable)."""


def test_package_imports():
    import coffee_ledger  # noqa: F401
