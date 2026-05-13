"""Streamlit UI for the PR Campaign Monitor.

Run:
    streamlit run pr_monitor/app.py

Two views: Browse (filterable table of matched articles) and Trends
(weekly/monthly aggregations).
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, time
from pathlib import Path

import pandas as pd
import streamlit as st

from . import db, scanner

ROOT = Path(__file__).resolve().parent.parent

# Common English stopwords — kept tiny on purpose. The word cloud is illustrative.
STOPWORDS = {
    "the", "a", "an", "of", "for", "to", "in", "on", "at", "by", "and", "or",
    "but", "is", "are", "was", "were", "be", "been", "being", "has", "have",
    "had", "this", "that", "these", "those", "with", "as", "it", "its", "from",
    "you", "your", "we", "us", "our", "they", "them", "their", "i", "my",
    "he", "she", "him", "her", "his", "hers", "uk", "british", "brits",
    "new", "best", "worst", "most", "least", "why", "how", "what", "when",
    "where", "who", "than", "more", "less", "after", "before", "into", "out",
    "up", "down", "off", "over", "under", "about", "amid", "amid", "&", "—",
    "–", "-", "vs", "via",
}
WORD_RE = re.compile(r"[A-Za-z'][A-Za-z']{2,}")


# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="PR Campaign Monitor",
    page_icon="📰",
    layout="wide",
)


@st.cache_resource(show_spinner=False)
def get_conn():
    conn = db.connect()
    db.init_db(conn)
    return conn


def _refresh_caches() -> None:
    """Drop the @st.cache_data results so the UI picks up new scans."""
    st.cache_data.clear()


# ---------------------------------------------------------------------------
# Cached read helpers
# ---------------------------------------------------------------------------


@st.cache_data(ttl=60)
def cached_distinct_outlets() -> list[str]:
    return db.distinct_outlets(get_conn())


@st.cache_data(ttl=60)
def cached_distinct_patterns() -> list[tuple[str, str]]:
    return db.distinct_patterns(get_conn())


@st.cache_data(ttl=60)
def cached_distinct_brands() -> list[str]:
    return db.distinct_brands(get_conn())


@st.cache_data(ttl=60)
def cached_last_scan() -> dict | None:
    row = db.last_scan_run(get_conn())
    return dict(row) if row else None


# ---------------------------------------------------------------------------
# Sidebar — scan trigger + filters
# ---------------------------------------------------------------------------


def sidebar() -> dict:
    st.sidebar.title("📰 PR Monitor")
    st.sidebar.caption("Scan UK news for PR-shaped coverage.")

    if st.sidebar.button("Run scan now", use_container_width=True):
        with st.spinner("Scanning feeds…"):
            stats = scanner.run_scan()
        _refresh_caches()
        st.sidebar.success(
            f"Done — {stats.feeds_scanned} feeds, "
            f"{stats.articles_new} new articles, "
            f"{stats.matches_new} new matches."
        )
        if stats.errors:
            with st.sidebar.expander(f"{len(stats.errors)} feed error(s)"):
                for err in stats.errors:
                    st.text(err)

    last = cached_last_scan()
    if last and last.get("finished_at"):
        st.sidebar.caption(f"Last scan: {last['finished_at']} UTC")
    elif last:
        st.sidebar.caption(f"Scan started: {last['started_at']} UTC")
    else:
        st.sidebar.caption("No scans yet — click *Run scan now*.")

    st.sidebar.divider()
    st.sidebar.subheader("Filters")

    today = datetime.utcnow().date()
    # Streamlit's date_input returns a tuple for ranges, but a single date
    # while the user is mid-edit — handle both shapes.
    date_range = st.sidebar.date_input(
        "Date range",
        value=(today - timedelta(days=30), today),
        max_value=today,
        key="date_range",
    )
    if isinstance(date_range, tuple) and len(date_range) == 2:
        date_from, date_to = date_range
    else:
        date_from = date_to = date_range  # type: ignore[assignment]

    outlets = st.sidebar.multiselect("Outlet", options=cached_distinct_outlets())
    patterns = cached_distinct_patterns()
    pattern_labels = {pid: label for pid, label in patterns}
    pattern_pick = st.sidebar.multiselect(
        "Pattern",
        options=[pid for pid, _ in patterns],
        format_func=lambda pid: pattern_labels.get(pid, pid),
    )
    brands = st.sidebar.multiselect("Brand", options=cached_distinct_brands())
    search = st.sidebar.text_input("Search headlines & summaries")

    return {
        "since": datetime.combine(date_from, time.min),
        "until": datetime.combine(date_to, time.max),
        "outlets": outlets,
        "patterns": pattern_pick,
        "brands": brands,
        "search": search.strip() or None,
    }


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------


def matches_dataframe(filters: dict) -> pd.DataFrame:
    rows = db.fetch_matches(
        get_conn(),
        outlets=filters["outlets"] or None,
        pattern_ids=filters["patterns"] or None,
        brands=filters["brands"] or None,
        search=filters["search"],
        since=filters["since"],
        until=filters["until"],
        limit=2000,
    )
    df = pd.DataFrame([dict(r) for r in rows])
    if not df.empty:
        df["published_at"] = pd.to_datetime(df["published_at"], errors="coerce")
        df = df.sort_values("published_at", ascending=False, na_position="last")
    return df


def render_browse(filters: dict) -> None:
    df = matches_dataframe(filters)
    st.subheader("Matched articles")
    st.caption(
        "One row per (article, matched pattern). An article matching three "
        "patterns shows three times."
    )

    if df.empty:
        st.info("No matches for the current filters.")
        return

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Matches", len(df))
    col2.metric("Articles", df["article_id"].nunique())
    col3.metric("Outlets", df["outlet"].nunique())
    col4.metric("Brands found", df["brand"].dropna().nunique())

    display_cols = [
        "published_at",
        "outlet",
        "headline",
        "pattern_label",
        "brand",
        "snippet",
        "url",
    ]
    st.dataframe(
        df[display_cols],
        use_container_width=True,
        hide_index=True,
        column_config={
            "published_at": st.column_config.DatetimeColumn("Published", format="YYYY-MM-DD HH:mm"),
            "outlet": "Outlet",
            "headline": st.column_config.TextColumn("Headline", width="large"),
            "pattern_label": "Pattern",
            "brand": "Brand",
            "snippet": st.column_config.TextColumn("Snippet", width="large"),
            "url": st.column_config.LinkColumn("Link", display_text="open"),
        },
    )

    csv = df[display_cols].to_csv(index=False).encode("utf-8")
    st.download_button(
        "Export filtered results as CSV",
        data=csv,
        file_name=f"pr-monitor-{datetime.utcnow().date()}.csv",
        mime="text/csv",
    )


def _start_of_week(d: datetime) -> datetime:
    d = datetime.combine(d.date(), time.min)
    return d - timedelta(days=d.weekday())


def render_trends(filters: dict) -> None:
    conn = get_conn()
    st.subheader("Trends")
    st.caption(
        "Aggregations ignore the sidebar filters (except the date range) so "
        "you can see the whole landscape at a glance."
    )

    since = filters["since"]
    this_week_start = _start_of_week(datetime.utcnow())

    top_brands = pd.DataFrame(
        [dict(r) for r in db.top_brands(conn, since=since, limit=20)]
    )
    top_patterns = pd.DataFrame(
        [dict(r) for r in db.top_patterns(conn, since=since, limit=20)]
    )
    top_outlets = pd.DataFrame(
        [dict(r) for r in db.top_outlets(conn, since=since, limit=20)]
    )

    col_a, col_b = st.columns(2)
    with col_a:
        st.markdown("#### Top brands")
        if top_brands.empty:
            st.caption("No brands extracted yet in this window.")
        else:
            st.dataframe(top_brands, hide_index=True, use_container_width=True)
    with col_b:
        st.markdown("#### Top patterns")
        if top_patterns.empty:
            st.caption("No matched patterns in this window.")
        else:
            st.bar_chart(top_patterns.set_index("label")["hits"])

    col_c, col_d = st.columns(2)
    with col_c:
        st.markdown("#### Top outlets")
        if top_outlets.empty:
            st.caption("No matches in this window.")
        else:
            st.bar_chart(top_outlets.set_index("outlet")["hits"])
    with col_d:
        st.markdown("#### This week vs last")
        trend_rows = db.pattern_trend(conn, this_week_start=this_week_start)
        trend = pd.DataFrame([dict(r) for r in trend_rows])
        if trend.empty:
            st.caption("Not enough data this week yet.")
        else:
            trend["delta"] = trend["hits_this_week"] - trend["hits_last_week"]
            trend = trend.sort_values(
                ["hits_this_week", "delta"], ascending=[False, False]
            ).head(15)
            st.dataframe(
                trend[["label", "hits_this_week", "hits_last_week", "delta"]],
                hide_index=True,
                use_container_width=True,
                column_config={
                    "label": "Pattern",
                    "hits_this_week": "This week",
                    "hits_last_week": "Last week",
                    "delta": st.column_config.NumberColumn("Δ"),
                },
            )

    st.markdown("#### Headline word frequencies")
    headlines = db.headline_words(conn, since=since, limit=2000)
    if not headlines:
        st.caption("No headlines in this window.")
    else:
        counter: Counter[str] = Counter()
        for h in headlines:
            for token in WORD_RE.findall(h.lower()):
                if token not in STOPWORDS:
                    counter[token] += 1
        words = pd.DataFrame(counter.most_common(30), columns=["word", "count"])
        if words.empty:
            st.caption("All headline words were stopwords — try a wider date range.")
        else:
            st.bar_chart(words.set_index("word")["count"])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    filters = sidebar()
    st.title("PR Campaign Monitor")
    st.caption(
        "Surfacing PR-shaped coverage in UK news. Click *Run scan now* in the "
        "sidebar to refresh."
    )
    browse_tab, trends_tab = st.tabs(["Browse", "Trends"])
    with browse_tab:
        render_browse(filters)
    with trends_tab:
        render_trends(filters)


main()
