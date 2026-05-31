import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useClubContext } from "../../context/useClubContext";
import { supabase } from "../../lib/supabaseClient";
import Spinner from "../../components/ui/Spinner";
import { showToast } from "../../components/ui/Toast";
import { useIsMobile } from "../../hooks/useWindowWidth";
import type { Club, MemberRole } from "../../types";

interface ProfileData {
  full_name: string;
  email: string;
  university: string;
  program: string;
  bio: string;
  year_of_study: string;
  avatar_url: string;
}

const EMPTY_PROFILE: ProfileData = {
  full_name: "",
  email: "",
  university: "",
  program: "",
  bio: "",
  year_of_study: "",
  avatar_url: "",
};

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#1a1a1a";
const CARD_BORDER = "#242424";
const MUTED = "#555555";

function getInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (email || "GC").slice(0, 2).toUpperCase();
}

function formatMemberSince(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Member since ${d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })}`;
}

function formatClubRoleDisplay(
  role: MemberRole | null | undefined,
): { label: string; color: string } {
  if (role === "owner") return { label: "President", color: "#FFC429" };
  if (role === "executive") return { label: "Executive", color: "#E51937" };
  return { label: "Member", color: "#747676" };
}

function deriveAbbreviation(name: string, maxLen = 3): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, maxLen)
    .toUpperCase();
}

function ProfileClubCard({
  club,
  logoUrl,
  roleDisplay,
}: {
  club: Club;
  logoUrl?: string;
  roleDisplay: { label: string; color: string };
}) {
  const [hovered, setHovered] = useState(false);
  const abbr = club.abbreviation?.trim() || deriveAbbreviation(club.name);

  return (
    <Link
      to={`/app/clubs/${club.id}`}
      className="block no-underline"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        background: hovered ? "#1f1f1f" : "#191919",
        border: `1px solid ${hovered ? "#333333" : CARD_BORDER}`,
        borderRadius: "7px",
        padding: "12px",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt=""
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            objectFit: "cover",
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "6px",
            background: "#2a2a2a",
            border: "1px solid #333333",
            color: "#888888",
            fontSize: "11px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {abbr}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {club.name}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: MUTED }}>
          {club.memberCount} members ·{" "}
          <span style={{ color: roleDisplay.color }}>{roleDisplay.label}</span>
        </p>
      </div>
      <span style={{ fontSize: "12px", color: MUTED, flexShrink: 0 }}>
        Open →
      </span>
    </Link>
  );
}

export default function ProfilePage() {
  const isMobile = useIsMobile();
  const { user } = useAuthContext();
  const { clubs, joinedClubs, getUserRole } = useClubContext();
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, university, program, bio, year_of_study, avatar_url")
        .eq("id", user!.id)
        .single();

      if (error && error.code !== "PGRST116") {
        showToast("Failed to load profile.", "error");
      }

      if (data) {
        setProfile({
          full_name: data.full_name ?? "",
          email: data.email ?? user!.email ?? "",
          university: data.university ?? "",
          program: data.program ?? "",
          bio: data.bio ?? "",
          year_of_study: data.year_of_study ?? "",
          avatar_url: data.avatar_url ?? "",
        });
      } else {
        setProfile((prev) => ({
          ...prev,
          email: user!.email ?? "",
        }));
      }
      setLoading(false);
    }

    fetchProfile();
  }, [user]);

  const myClubs = useMemo(
    () => clubs.filter((c) => joinedClubs.includes(c.id)),
    [clubs, joinedClubs],
  );

  const programLine = [profile.program, profile.year_of_study]
    .filter((part) => part.trim())
    .join(" · ");

  const memberSince = formatMemberSince(user?.created_at);

  const pagePadding = isMobile ? "16px" : "40px 24px";

  if (loading) {
    return (
      <div
        style={{
          backgroundColor: PAGE_BG,
          minHeight: "60vh",
          padding: pagePadding,
          maxWidth: "72rem",
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner label="Loading profile…" />
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: PAGE_BG,
        minHeight: "100%",
        padding: pagePadding,
        maxWidth: "72rem",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          background: CARD_BG,
          border: `1px solid ${CARD_BORDER}`,
          borderRadius: "12px",
          padding: isMobile ? "20px 16px" : "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            flexWrap: isMobile ? undefined : "wrap",
            alignItems: isMobile ? "center" : "flex-start",
            gap: "20px",
            justifyContent: isMobile ? "center" : "space-between",
            textAlign: isMobile ? "center" : undefined,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              gap: "20px",
              alignItems: isMobile ? "center" : "flex-start",
            }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                  border: `1px solid ${CARD_BORDER}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  background: "#111111",
                  border: `1px solid ${CARD_BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  fontWeight: 600,
                  color: "#ffffff",
                  flexShrink: 0,
                }}
              >
                {getInitials(profile.full_name, profile.email)}
              </div>
            )}
            <div>
              <h1
                style={{
                  fontSize: "22px",
                  fontWeight: 700,
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                {profile.full_name || "Your profile"}
              </h1>
              {programLine ? (
                <p style={{ fontSize: "14px", color: MUTED, margin: "8px 0 0" }}>
                  {programLine}
                </p>
              ) : null}
              <p style={{ fontSize: "13px", color: MUTED, margin: "6px 0 0" }}>
                {profile.email}
              </p>
              {memberSince ? (
                <p style={{ fontSize: "12px", color: MUTED, margin: "8px 0 0" }}>
                  {memberSince}
                </p>
              ) : null}
            </div>
          </div>
          <Link
            to="/app/settings"
            style={{
              display: "inline-block",
              background: "#E51937",
              color: "#ffffff",
              borderRadius: "6px",
              padding: "10px 20px",
              fontSize: "14px",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Edit Profile
          </Link>
        </div>
      </div>

      <div style={{ marginTop: "32px" }}>
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#ffffff",
            margin: "0 0 16px",
          }}
        >
          My Clubs
        </h2>
        {myClubs.length === 0 ? (
          <p style={{ fontSize: "14px", color: MUTED, margin: 0 }}>
            You haven&apos;t joined any clubs yet.{" "}
            <Link to="/explore" style={{ color: "#E51937", textDecoration: "none" }}>
              Explore clubs
            </Link>
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {myClubs.map((club) => (
              <ProfileClubCard
                key={club.id}
                club={club}
                logoUrl={club.logoUrl}
                roleDisplay={formatClubRoleDisplay(getUserRole(club.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
