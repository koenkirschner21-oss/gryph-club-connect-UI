import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuthContext } from "../context/useAuthContext";
import { supabase } from "../lib/supabaseClient";
import { parseClubRequestMetadata } from "../lib/publicClubProfileDisplay";
import Spinner from "../components/ui/Spinner";

const PAGE_BG = "#0f0f0f";
const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";

const cardStyle: CSSProperties = {
  background: "#141414",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  padding: "28px 24px",
  maxWidth: "640px",
  width: "100%",
};

const primaryButtonStyle: CSSProperties = {
  background: ACCENT_RED,
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: 600,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
};

const secondaryButtonStyle: CSSProperties = {
  background: "transparent",
  color: "#cccccc",
  border: "1px solid #2a2a2a",
  borderRadius: "8px",
  padding: "10px 20px",
  fontSize: "14px",
  fontWeight: 500,
  cursor: "pointer",
  textDecoration: "none",
  display: "inline-block",
  textAlign: "center",
};

type RequestStatus = "pending" | "approved" | "rejected" | "more_info" | "canceled";

interface ClubRequestRecord {
  id: string;
  name: string;
  shortDescription: string | null;
  longDescription: string | null;
  category: string | null;
  status: RequestStatus;
  requestedAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
  clubId: string | null;
}

function formatSubmittedAt(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusLabel(status: RequestStatus): string {
  switch (status) {
    case "pending":
      return "Pending review";
    case "more_info":
      return "Changes requested";
    case "approved":
      return "Approved";
    case "rejected":
      return "Declined";
    case "canceled":
      return "Withdrawn";
    default:
      return status;
  }
}

function statusColor(status: RequestStatus): string {
  switch (status) {
    case "approved":
      return "#4ade80";
    case "rejected":
    case "canceled":
      return "#E51937";
    case "more_info":
      return GOLD;
    default:
      return GOLD;
  }
}

export default function ClubRequestStatusPage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuthContext();

  const [request, setRequest] = useState<ClubRequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");

  useEffect(() => {
    if (authLoading || !requestId) return;
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/club-request-status/${requestId}`)}`, {
        replace: true,
      });
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);

      const { data, error: loadError } = await supabase
        .from("club_requests")
        .select(
          `
          id,
          name,
          short_description,
          long_description,
          category,
          status,
          requested_at,
          reviewed_at,
          review_note,
          club_id
        `,
        )
        .eq("id", requestId)
        .eq("submitted_by", user!.id)
        .maybeSingle();

      if (cancelled) return;

      if (loadError || !data) {
        console.error("Failed to load club request:", loadError?.message);
        setNotFound(true);
        setRequest(null);
        setLoading(false);
        return;
      }

      const record: ClubRequestRecord = {
        id: data.id as string,
        name: (data.name as string) ?? "",
        shortDescription: (data.short_description as string | null) ?? null,
        longDescription: (data.long_description as string | null) ?? null,
        category: (data.category as string | null) ?? null,
        status: (data.status as RequestStatus) ?? "pending",
        requestedAt: (data.requested_at as string) ?? "",
        reviewedAt: (data.reviewed_at as string | null) ?? null,
        reviewNote: (data.review_note as string | null) ?? null,
        clubId: (data.club_id as string | null) ?? null,
      };

      setRequest(record);
      setEditName(record.name);
      setEditDescription(record.shortDescription ?? "");
      setEditCategory(record.category ?? "");
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, navigate, requestId, user]);

  const meta = useMemo(
    () => parseClubRequestMetadata(request?.longDescription ?? null),
    [request?.longDescription],
  );

  const history = useMemo(() => {
    if (!request) return [];
    const items: { label: string; at: string; detail?: string }[] = [
      {
        label: "Submitted",
        at: request.requestedAt,
        detail: "Request sent for platform admin review.",
      },
    ];
    if (request.status === "more_info" || request.reviewNote) {
      items.push({
        label: request.status === "more_info" ? "Changes requested" : "Reviewer note",
        at: request.reviewedAt ?? request.requestedAt,
        detail: request.reviewNote ?? undefined,
      });
    }
    if (request.status === "approved") {
      items.push({
        label: "Approved",
        at: request.reviewedAt ?? request.requestedAt,
        detail: "Club workspace is ready.",
      });
    }
    if (request.status === "rejected") {
      items.push({
        label: "Declined",
        at: request.reviewedAt ?? request.requestedAt,
        detail: request.reviewNote ?? undefined,
      });
    }
    if (request.status === "canceled") {
      items.push({
        label: "Withdrawn",
        at: request.reviewedAt ?? new Date().toISOString(),
        detail: "You withdrew this request.",
      });
    }
    return items;
  }, [request]);

  async function handleWithdraw() {
    if (!request || (request.status !== "pending" && request.status !== "more_info")) {
      return;
    }
    if (!window.confirm("Withdraw this club request? You can submit a new request later.")) {
      return;
    }
    setActing(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("club_requests")
      .update({
        status: "canceled",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id)
      .eq("submitted_by", user!.id);

    setActing(false);
    if (updateError) {
      console.error("Failed to withdraw club request:", updateError.message);
      setError("Could not withdraw this request. Please try again.");
      return;
    }
    setRequest((prev) =>
      prev
        ? {
            ...prev,
            status: "canceled",
            reviewedAt: new Date().toISOString(),
          }
        : prev,
    );
  }

  async function handleResubmit(event: FormEvent) {
    event.preventDefault();
    if (!request || request.status !== "more_info") return;

    const trimmedName = editName.trim();
    const trimmedDescription = editDescription.trim();
    if (trimmedName.length < 3 || trimmedDescription.length < 20) {
      setError("Club name and a description of at least 20 characters are required.");
      return;
    }

    setActing(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("club_requests")
      .update({
        name: trimmedName,
        short_description: trimmedDescription,
        category: editCategory.trim() || null,
        status: "pending",
        review_note: null,
        reviewed_at: null,
        reviewed_by: null,
      })
      .eq("id", request.id)
      .eq("submitted_by", user!.id);

    setActing(false);
    if (updateError) {
      console.error("Failed to resubmit club request:", updateError.message);
      setError("Could not resubmit. Please try again.");
      return;
    }

    setRequest((prev) =>
      prev
        ? {
            ...prev,
            name: trimmedName,
            shortDescription: trimmedDescription,
            category: editCategory.trim() || null,
            status: "pending",
            reviewNote: null,
            reviewedAt: null,
          }
        : prev,
    );
    setEditing(false);
  }

  if (authLoading || loading) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center"
        style={{ background: PAGE_BG }}
      >
        <Spinner label="Loading club request status…" />
      </div>
    );
  }

  if (notFound || !request) {
    return (
      <div
        className="mx-auto max-w-7xl px-4 py-20 text-center"
        style={{ background: PAGE_BG, minHeight: "60vh" }}
      >
        <h1 className="text-3xl font-bold text-white">Request Not Found</h1>
        <p className="mt-3 text-[#777777]">
          This club request doesn&apos;t exist or you don&apos;t have access to view it.
        </p>
        <Link to="/app?tab=inbox" className="mt-6 inline-block text-[#E51937] hover:underline">
          Back to Inbox
        </Link>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-[60vh] max-w-7xl flex-col items-center px-4 py-12"
      style={{ background: PAGE_BG }}
    >
      <div style={cardStyle}>
        <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#555555", fontWeight: 600 }}>
          Club request status
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: "24px", fontWeight: 800, color: "#ffffff" }}>
          {request.name}
        </h1>
        <p style={{ margin: "0 0 18px", fontSize: "14px", color: statusColor(request.status), fontWeight: 700 }}>
          {statusLabel(request.status)}
        </p>

        <div style={{ display: "grid", gap: "10px", marginBottom: "20px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#888888" }}>
            <span style={{ color: "#555555" }}>Submitted: </span>
            {formatSubmittedAt(request.requestedAt)}
          </p>
          {request.category ? (
            <p style={{ margin: 0, fontSize: "13px", color: "#888888" }}>
              <span style={{ color: "#555555" }}>Category: </span>
              {request.category}
            </p>
          ) : null}
          {meta?.contact_email ? (
            <p style={{ margin: 0, fontSize: "13px", color: "#888888" }}>
              <span style={{ color: "#555555" }}>Contact: </span>
              {meta.contact_email}
            </p>
          ) : null}
        </div>

        <section style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            Submitted details
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "#cccccc", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {request.shortDescription?.trim() || "No description provided."}
          </p>
        </section>

        <section style={{ marginBottom: "20px" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
            Progress
          </h2>
          <ul style={{ margin: 0, paddingLeft: "18px", display: "grid", gap: "10px" }}>
            {history.map((item) => (
              <li key={`${item.label}-${item.at}`} style={{ color: "#cccccc", fontSize: "13px" }}>
                <strong style={{ color: "#ffffff" }}>{item.label}</strong>
                <span style={{ color: "#555555" }}> · {formatSubmittedAt(item.at)}</span>
                {item.detail ? (
                  <p style={{ margin: "4px 0 0", color: "#888888", lineHeight: 1.5 }}>{item.detail}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        {request.reviewNote ? (
          <section
            style={{
              marginBottom: "20px",
              padding: "12px",
              borderRadius: "8px",
              border: "1px solid #3a2f00",
              background: "#1a1500",
            }}
          >
            <h2 style={{ margin: "0 0 6px", fontSize: "13px", fontWeight: 700, color: GOLD }}>
              Admin / reviewer notes
            </h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#ffd27a", lineHeight: 1.5 }}>
              {request.reviewNote}
            </p>
          </section>
        ) : null}

        {error ? (
          <p style={{ margin: "0 0 12px", color: ACCENT_RED, fontSize: "13px" }}>{error}</p>
        ) : null}

        {request.status === "more_info" && editing ? (
          <form onSubmit={(event) => void handleResubmit(event)} style={{ display: "grid", gap: "12px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cccccc" }}>
              Club name
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#ffffff",
                  padding: "10px 12px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cccccc" }}>
              Category
              <input
                value={editCategory}
                onChange={(event) => setEditCategory(event.target.value)}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#ffffff",
                  padding: "10px 12px",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", color: "#cccccc" }}>
              Description
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={5}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  color: "#ffffff",
                  padding: "10px 12px",
                  resize: "vertical",
                }}
              />
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button type="submit" disabled={acting} style={primaryButtonStyle}>
                {acting ? "Saving…" : "Resubmit request"}
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => setEditing(false)}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {request.status === "more_info" ? (
              <button type="button" onClick={() => setEditing(true)} style={primaryButtonStyle}>
                Edit and Resubmit
              </button>
            ) : null}
            {request.status === "pending" || request.status === "more_info" ? (
              <button
                type="button"
                disabled={acting}
                onClick={() => void handleWithdraw()}
                style={secondaryButtonStyle}
              >
                {acting ? "Working…" : "Withdraw"}
              </button>
            ) : null}
            {request.status === "approved" && request.clubId ? (
              <Link to={`/app/clubs/${request.clubId}`} style={primaryButtonStyle}>
                Open Club Workspace
              </Link>
            ) : null}
            <Link to="/app?tab=inbox" style={secondaryButtonStyle}>
              Back to Inbox
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
