import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../../components/ui/Spinner";
import { supabase } from "../../lib/supabaseClient";
import { canViewContent, normalizeVisibility } from "../../lib/contentVisibility";
import type { MemberRole } from "../../types";

export type AggregateAnnouncement = {
  id: string;
  clubId: string;
  clubName: string;
  clubLogoUrl?: string;
  title: string;
  content: string;
  createdAt: string;
  isPinned: boolean;
  visibility: ReturnType<typeof normalizeVisibility>;
};

function formatAnnouncementDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function previewText(content: string, max = 140): string {
  const trimmed = content.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max).trimEnd()}…`;
}

export default function AnnouncementsTab({
  joinedClubIds,
  clubLogos,
  membershipAccessKey,
  getUserRole,
  userId,
}: {
  joinedClubIds: string[];
  clubLogos: Record<string, string>;
  membershipAccessKey: string;
  getUserRole: (clubId: string) => MemberRole | null;
  userId?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AggregateAnnouncement[]>([]);
  const [clubFilter, setClubFilter] = useState<string>("all");

  const clubOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      map.set(item.clubId, item.clubName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  useEffect(() => {
    if (joinedClubIds.length === 0) {
      queueMicrotask(() => {
        setItems([]);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from("posts")
      .select(
        `
        id,
        club_id,
        title,
        content,
        created_at,
        is_pinned,
        visibility,
        clubs:club_id ( name, logo_url )
      `,
      )
      .in("club_id", joinedClubIds)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load aggregate announcements:", error.message);
          setItems([]);
          setLoading(false);
          return;
        }

        const mapped: AggregateAnnouncement[] = (data ?? []).map((row) => {
          const clubRaw = row.clubs as unknown;
          const club = (
            Array.isArray(clubRaw) ? clubRaw[0] ?? {} : clubRaw ?? {}
          ) as Record<string, unknown>;
          return {
            id: row.id as string,
            clubId: row.club_id as string,
            clubName: (club.name as string) ?? "Club",
            clubLogoUrl: (club.logo_url as string | null) ?? undefined,
            title: (row.title as string) ?? "",
            content: (row.content as string) ?? "",
            createdAt: (row.created_at as string) ?? "",
            isPinned: Boolean((row as { is_pinned?: boolean }).is_pinned),
            visibility: normalizeVisibility(
              (row as { visibility?: string | null }).visibility,
              "members_only",
            ),
          };
        });

        const visible = mapped.filter((item) => {
          const role = getUserRole(item.clubId);
          const isPrivileged = role === "owner" || role === "executive";
          return canViewContent(item.visibility, {
            isMember: true,
            isPrivileged,
            userId,
            role,
            accessLevel: null,
          });
        });

        setItems(visible);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [joinedClubIds, membershipAccessKey, getUserRole, userId]);

  const filtered = useMemo(() => {
    const list =
      clubFilter === "all"
        ? items
        : items.filter((item) => item.clubId === clubFilter);

    return [...list].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [items, clubFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner label="Loading announcements…" />
      </div>
    );
  }

  if (joinedClubIds.length === 0) {
    return (
      <p style={{ color: "#777777", fontSize: "14px", margin: "24px 0" }}>
        Join a club to see announcements here.
      </p>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 700,
              color: "#ffffff",
            }}
          >
            Announcements
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#777777" }}>
            From all clubs you belong to · {filtered.length} shown
          </p>
        </div>
        <label style={{ fontSize: "13px", color: "#888888" }}>
          Club{" "}
          <select
            value={clubFilter}
            onChange={(event) => setClubFilter(event.target.value)}
            style={{
              marginLeft: "8px",
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              color: "#ffffff",
              borderRadius: "6px",
              padding: "8px 10px",
              fontSize: "13px",
            }}
          >
            <option value="all">All clubs</option>
            {clubOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: "#777777", fontSize: "14px", margin: "24px 0" }}>
          No announcements yet.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {filtered.map((item) => {
            const logo = clubLogos[item.clubId] ?? item.clubLogoUrl;
            const href = `/app/clubs/${item.clubId}/announcements?post=${encodeURIComponent(item.id)}`;
            return (
              <article
                key={item.id}
                style={{
                  background: "#141414",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                  {logo ? (
                    <img
                      src={logo}
                      alt=""
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "8px",
                        objectFit: "cover",
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "8px",
                        background: "#242424",
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "8px",
                        alignItems: "center",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: "#888888",
                          fontWeight: 600,
                        }}
                      >
                        {item.clubName}
                      </p>
                      {item.isPinned ? (
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            color: "#FFC429",
                            border: "1px solid #3a3010",
                            borderRadius: "4px",
                            padding: "1px 6px",
                          }}
                        >
                          PINNED
                        </span>
                      ) : null}
                      <span style={{ fontSize: "11px", color: "#555555" }}>
                        {item.visibility.replace(/_/g, " ")}
                      </span>
                    </div>
                    <h3
                      style={{
                        margin: "6px 0 0",
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#ffffff",
                      }}
                    >
                      {item.title}
                    </h3>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666666" }}>
                      {formatAnnouncementDate(item.createdAt)}
                    </p>
                    {item.content.trim() ? (
                      <p
                        style={{
                          margin: "8px 0 0",
                          fontSize: "13px",
                          color: "#999999",
                          lineHeight: 1.45,
                        }}
                      >
                        {previewText(item.content)}
                      </p>
                    ) : null}
                    <Link
                      to={href}
                      style={{
                        display: "inline-block",
                        marginTop: "10px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#E51937",
                        textDecoration: "none",
                      }}
                    >
                      Open announcement →
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
