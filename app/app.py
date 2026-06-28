"""Streamlit UI buat Coffee Ledger — lapisan tipis di atas LedgerService.

Gak ada aturan bisnis di sini: semua lewat `service`. UI cuma nampilin & ngumpulin input.
Jalanin: `uv run streamlit run app/app.py`
"""

import sys
from datetime import date
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

# Streamlit Cloud gak nginstall package di src/ kita, jadi tambahin ke path biar keimport.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from coffee_ledger.errors import LedgerError  # noqa: E402
from coffee_ledger.models import TxnKind  # noqa: E402
from coffee_ledger.repository import LedgerRepository, init_db, make_engine  # noqa: E402
from coffee_ledger.service import LedgerService  # noqa: E402


def _db_url() -> str | None:
    """DATABASE_URL dari Streamlit secrets (cloud) → env → None (lokal: default SQLite)."""
    try:
        return st.secrets["DATABASE_URL"]
    except Exception:
        return None


@st.cache_resource
def get_service() -> LedgerService:
    """Bikin service sekali, dipakai ulang antar-rerun."""
    engine = make_engine(_db_url())
    init_db(engine)
    return LedgerService(LedgerRepository(engine))


service = get_service()

st.set_page_config(page_title="Coffee Ledger", page_icon="☕", layout="centered")
st.markdown(
    """
    <style>
      footer {visibility: hidden;}
      .block-container {padding-top: 2.5rem; padding-bottom: 2rem;}
    </style>
    """,
    unsafe_allow_html=True,
)
st.title("☕ Coffee Ledger")

tab_dash, tab_lots, tab_record, tab_history = st.tabs(
    ["📊 Dashboard", "📦 Lots", "✍️ Catat", "🧾 Riwayat"]
)

# ── Dashboard ────────────────────────────────────────────────────────────────
with tab_dash:
    summary = service.stock_summary()
    total = sum(stock for _, stock in summary)
    active = [(lot, s) for lot, s in summary if s > 0]

    c1, c2, c3 = st.columns(3)
    c1.metric("Total stok", f"{total:,.0f} g")
    c2.metric("Lot aktif", len(active))
    c3.metric("Total lot", len(summary))

    if active:
        df = pd.DataFrame(
            {"Lot": [lot.name for lot, _ in active], "Stok": [s for _, s in active]}
        )
        chart = (
            alt.Chart(df)
            .mark_bar(cornerRadiusEnd=4, color="#C8965A")
            .encode(
                x=alt.X("Stok:Q", title="gram", axis=alt.Axis(grid=False)),
                y=alt.Y("Lot:N", title=None, sort="-x"),
                tooltip=["Lot", "Stok"],
            )
            .properties(height=max(140, 44 * len(df)))
        )
        st.altair_chart(chart, use_container_width=True)
    else:
        st.info("Belum ada stok aktif. Tambah lot & catat 'Masuk' dulu.")

# ── Lots ─────────────────────────────────────────────────────────────────────
with tab_lots:
    st.subheader("Tambah lot")
    with st.form("add_lot", clear_on_submit=True):
        name = st.text_input("Nama lot", placeholder="Gayo Bener Kelipah")
        col1, col2 = st.columns(2)
        origin = col1.text_input("Origin", placeholder="Gayo, Aceh")
        varietal = col2.text_input("Varietal", placeholder="Red Bourbon")
        roast_date = st.date_input("Tanggal roast", value=date.today())
        notes = st.text_input("Catatan (opsional)")
        if st.form_submit_button("Tambah", type="primary"):
            if name and origin and varietal:
                service.add_lot(
                    name=name,
                    origin=origin,
                    varietal=varietal,
                    roast_date=roast_date,
                    notes=notes or None,
                )
                st.success(f"Lot '{name}' ditambah ✓")
            else:
                st.warning("Nama, origin, dan varietal wajib diisi.")

    st.subheader("Daftar lot")
    lots = service.list_lots()
    if lots:
        st.dataframe(
            pd.DataFrame(
                [
                    {
                        "id": lt.id,
                        "Nama": lt.name,
                        "Origin": lt.origin,
                        "Varietal": lt.varietal,
                        "Roast": lt.roast_date,
                    }
                    for lt in lots
                ]
            ),
            use_container_width=True,
            hide_index=True,
        )
    else:
        st.info("Belum ada lot.")

# ── Catat (record) ───────────────────────────────────────────────────────────
with tab_record:
    lots = service.list_lots()
    if not lots:
        st.info("Tambah lot dulu di tab 📦 Lots.")
    else:
        action_labels = {
            "Masuk / beli (acquire)": "acquire",
            "Seduh (brew)": "brew",
            "Kasih orang (gift)": "gift",
            "Koreksi naik (+)": "adjust_up",
            "Koreksi turun (−)": "adjust_down",
        }
        options = {
            f"{lt.name} — stok {service.current_stock(lt.id):.0f} g": lt.id
            for lt in lots
        }
        chosen = st.selectbox("Lot", list(options.keys()))
        lot_id = options[chosen]
        label = st.radio("Aksi", list(action_labels.keys()))
        grams = st.number_input("Gram", min_value=0.0, step=5.0, value=0.0)
        note = st.text_input("Catatan (opsional)", placeholder="mis. V60 / buat Budi")

        if st.button("Catat", type="primary"):
            try:
                act = action_labels[label]
                if act == "acquire":
                    service.record_acquire(lot_id, grams, note or None)
                elif act == "brew":
                    service.record_brew(lot_id, grams, note or None)
                elif act == "gift":
                    service.record_gift(lot_id, grams, note or None)
                elif act == "adjust_up":
                    service.record_adjust(lot_id, grams, TxnKind.IN, note or None)
                else:  # adjust_down
                    service.record_adjust(lot_id, grams, TxnKind.OUT, note or None)
                st.success("Tercatat ✓")
            except LedgerError as e:
                st.error(str(e))

# ── Riwayat (history) ────────────────────────────────────────────────────────
with tab_history:
    txns = service.history()
    if not txns:
        st.info("Belum ada transaksi.")
    else:
        names = {lt.id: lt.name for lt in service.list_lots()}
        hist = pd.DataFrame(
            [
                {
                    "Waktu": t.ts,
                    "Lot": names.get(t.lot_id, t.lot_id),
                    "Jenis": t.kind,
                    "Alasan": t.reason,
                    "Gram": t.grams,
                    "Catatan": t.note,
                }
                for t in txns
            ]
        )
        st.dataframe(hist, use_container_width=True, hide_index=True)
        st.download_button(
            "⬇️ Unduh CSV",
            hist.to_csv(index=False).encode("utf-8"),
            file_name="coffee_ledger.csv",
            mime="text/csv",
        )
