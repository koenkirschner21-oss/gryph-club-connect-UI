import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Search, X } from "lucide-react";
import { useIsMobile } from "../../hooks/useWindowWidth";
import {
  applyPendingSort,
  PENDING_CATEGORY_LABELS,
  PENDING_URGENCY_LABELS,
  type PendingActionCategory,
  type PendingActionItem,
  type PendingActionUrgency,
  type PendingSortMode,
} from "../../lib/commandCenterPending";
import Spinner from "../ui/Spinner";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const CARD_BORDER = "#2a2a2a";

const CATEGORIES: Array<PendingActionCategory | "all"> = [
  "all",
  "tasks",
  "meetings",
  "hiring",
  "join_requests",
  "events",
  "announcements",
];

const URGENCIES: Array<PendingActionUrgency | "all"> = [
  "all",
  "overdue",
  "needs_review",
  "due_soon",
  "other",
];

const SORT_MODES: { id: PendingSortMode; label: string }[] = [
  { id: "urgency", label: "Urgency" },
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "label", label: "A–Z" },
];

const chipStyle = (active: boolean): CSSProperties => ({
  background: active ? "rgba(255, 196, 41, 0.12)" : "#1a1a1a",
  border: `1px solid ${active ? "rgba(255, 196, 41, 0.4)" : CARD_BORDER}`,
  color: active ? GOLD : "#bbbbbb",
  borderRadius: "999px",
  padding: "5px 10px",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
});

function actionButtonStyle(urgency: PendingActionUrgency): CSSProperties {
  if (urgency === "overdue" || urgency === "needs_review") {
    return {
      background: "transparent",
      color: ACCENT_RED,
      border: `1px solid ${ACCENT_RED}`,
      borderRadius: "6px",
      padding: "6px 12px",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer",
      flexShrink: 0,
      fontFamily: "inherit",
    };
  }
  if (urgency === "due_soon") {
    return {
      background: "transparent",
      color: GOLD,
      border: `1px solid ${GOLD}`,
      borderRadius: "6px",
      padding: "6px 12px",
      fontSize: "12px",
      fontWeight: 600,
      cursor: "pointer",
      flexShrink: 0,
      fontFamily: "inherit",
    };
  }
  return {
    background: "transparent",
    color: "#cccccc",
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: "6px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "inherit",
  };
}

export function PendingActionsOverlay({
  open,
  items,
  loading,
  onClose,
}: {
  open: boolean;
  items: PendingActionItem[];
  loading: boolean;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<PendingActionCategory | "all">("all");
  const [urgency, setUrgency] = useState<PendingActionUrgency | "all">("all");
  const [sortMode, setSortMode] = useState<PendingSortMode>("urgency");

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const { style } = document.body;
    const previousOverflow = style.overflow;
    const previousPosition = style.position;
    const previousTop = style.top;
    const previousWidth = style.width;
    style.overflow = "hidden";
    style.position = "fixed";
    style.top = `-${scrollY}px`;
    style.width = "100%";
    return () => {
      style.overflow = previousOverflow;
      style.position = previousPosition;
      style.top = previousTop;
      style.width = previousWidth;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = items.filter((item) => {
      if (category !== "all" && item.category !== category) return false;
      if (urgency !== "all" && item.urgency !== urgency) return false;
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.actionLabel.toLowerCase().includes(q) ||
        PENDING_CATEGORY_LABELS[item.category].toLowerCase().includes(q)
      );
    });
    return applyPendingSort(next, sortMode);
  }, [items, query, category, urgency, sortMode]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pending-actions-overlay-title"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.8)",
        zIndex: 1200,
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: isMobile ? 0 : "24px",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: "#121212",
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: isMobile ? "16px 16px 0 0" : "14px",
          width: "100%",
          maxWidth: isMobile ? "100%" : "760px",
          maxHeight: isMobile ? "92vh" : "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: isMobile ? "16px 16px 12px" : "18px 20px 12px",
            borderBottom: `1px solid #1e1e1e`,
            flexShrink: 0,
          }}
        >
          <div>
            <h2
              id="pending-actions-overlay-title"
              style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#ffffff" }}
            >
              Pending Actions
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#999999" }}>
              {filtered.length} of {items.length} item{items.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: isMobile ? "12px 16px" : "14px 20px",
            borderBottom: "1px solid #1e1e1e",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative" }}>
            <Search
              size={14}
              aria-hidden
              style={{
                position: "absolute",
                left: "11px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "#666666",
              }}
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search pending actions…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#0f0f0f",
                border: `1px solid ${CARD_BORDER}`,
                borderRadius: "8px",
                padding: "9px 12px 9px 32px",
                fontSize: "13px",
                color: "#ffffff",
              }}
            />
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                style={chipStyle(category === value)}
                onClick={() => setCategory(value)}
              >
                {value === "all" ? "All types" : PENDING_CATEGORY_LABELS[value]}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {URGENCIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  style={chipStyle(urgency === value)}
                  onClick={() => setUrgency(value)}
                >
                  {value === "all" ? "All urgency" : PENDING_URGENCY_LABELS[value]}
                </button>
              ))}
            </div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#888888", fontWeight: 600 }}>Sort</span>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as PendingSortMode)}
                style={{
                  background: "#1a1a1a",
                  border: `1px solid ${CARD_BORDER}`,
                  borderRadius: "6px",
                  color: "#dddddd",
                  fontSize: "12px",
                  padding: "5px 8px",
                }}
              >
                {SORT_MODES.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px 16px 20px" : "14px 20px 20px" }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner label="Loading pending actions…" />
            </div>
          ) : filtered.length === 0 ? (
            <p style={{ margin: "24px 0", textAlign: "center", fontSize: "13px", color: "#777777" }}>
              No pending actions match these filters.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {filtered.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "#1a1a1a",
                    border: `1px solid ${CARD_BORDER}`,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#999999" }}>
                        {PENDING_CATEGORY_LABELS[item.category]}
                      </span>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#777777" }}>·</span>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: "#999999" }}>
                        {PENDING_URGENCY_LABELS[item.urgency]}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: "#e6e6e6", lineHeight: 1.4 }}>
                      {item.label}
                    </p>
                  </div>
                  <button
                    type="button"
                    style={actionButtonStyle(item.urgency)}
                    onClick={() => {
                      item.onAction();
                      onClose();
                    }}
                  >
                    {item.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
