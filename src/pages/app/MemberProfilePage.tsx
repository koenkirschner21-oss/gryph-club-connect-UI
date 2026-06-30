import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import Spinner from "../../components/ui/Spinner";
import PublicDetailBackButton from "../../components/public/PublicDetailBackButton";

interface MemberProfile {
  fullName: string;
  avatarUrl?: string;
  bio?: string;
  yearOfStudy?: string;
  email?: string;
}

const PAGE_BG = "#0f0f0f";
const ACCENT_RED = "#E51937";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function ProfileAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          border: "3px solid #242424",
          objectFit: "cover",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        border: "3px solid #242424",
        background: "#111111",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: 600,
        color: "#ffffff",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

export default function MemberProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dmClubId, setDmClubId] = useState<string | null>(
    searchParams.get("clubId"),
  );

  const isOwnProfile = Boolean(userId && user?.id === userId);

  useEffect(() => {
    if (!userId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setNotFound(false);

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, bio, year_of_study, email")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Failed to load member profile:", error.message);
      }

      if (!data) {
        setProfile(null);
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile({
        fullName: (data.full_name as string) ?? "Member",
        avatarUrl: (data.avatar_url as string) ?? undefined,
        bio: (data.bio as string) ?? undefined,
        yearOfStudy: (data.year_of_study as string) ?? undefined,
        email: (data.email as string) ?? undefined,
      });

      setLoading(false);
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (dmClubId || !user?.id || !userId || userId === user.id) return;

    let cancelled = false;

    const viewerId = user.id;

    async function resolveSharedClub() {
      const { data: myMemberships } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", viewerId)
        .eq("status", "active");

      const clubIds = (myMemberships ?? []).map((row) => row.club_id as string);
      if (clubIds.length === 0) return;

      const { data: shared } = await supabase
        .from("club_members")
        .select("club_id")
        .eq("user_id", userId)
        .in("club_id", clubIds)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!cancelled && shared?.club_id) {
        setDmClubId(shared.club_id as string);
      }
    }

    void resolveSharedClub();
    return () => {
      cancelled = true;
    };
  }, [dmClubId, user?.id, userId]);

  if (loading) {
    return (
      <div
        style={{
          background: PAGE_BG,
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner label="Loading profile…" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div
        style={{
          background: PAGE_BG,
          maxWidth: "600px",
          margin: "0 auto",
          padding: "32px 20px",
        }}
      >
        <PublicDetailBackButton
          fallbackTo={dmClubId ? `/app/clubs/${dmClubId}/members` : "/app"}
          label={dmClubId ? "Back to Members" : "Back to Dashboard"}
        />
        <h1
          style={{
            fontWeight: 700,
            fontSize: "22px",
            color: "#ffffff",
            margin: "24px 0 8px",
            textAlign: "center",
          }}
        >
          Profile not found
        </h1>
        <p style={{ fontSize: "14px", color: "#555555", margin: 0, textAlign: "center" }}>
          This member profile could not be loaded.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: PAGE_BG,
        maxWidth: "600px",
        margin: "0 auto",
        padding: "32px 20px",
      }}
    >
      <PublicDetailBackButton
        fallbackTo={dmClubId ? `/app/clubs/${dmClubId}/members` : "/app"}
        label={dmClubId ? "Back to Members" : "Back to Dashboard"}
      />
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "28px",
        }}
      >
        <ProfileAvatar name={profile.fullName} avatarUrl={profile.avatarUrl} />
        <h1
          style={{
            fontWeight: 700,
            fontSize: "22px",
            color: "#ffffff",
            marginTop: "12px",
            marginBottom: 0,
          }}
        >
          {profile.fullName}
        </h1>
        {profile.yearOfStudy ? (
          <p
            style={{
              fontSize: "13px",
              color: "#747676",
              margin: "4px 0 0",
            }}
          >
            {profile.yearOfStudy}
          </p>
        ) : null}
        {!isOwnProfile && dmClubId && userId ? (
          <button
            type="button"
            onClick={() =>
              navigate(`/app/clubs/${dmClubId}/chat?dm=${userId}`)
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              marginTop: "16px",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <MessageCircle size={16} style={{ marginRight: "8px" }} aria-hidden />
            Send Message
          </button>
        ) : null}
        {profile.bio ? (
          <p
            style={{
              fontSize: "14px",
              color: "#aaaaaa",
              marginTop: "8px",
              marginBottom: 0,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {profile.bio}
          </p>
        ) : null}
        {isOwnProfile ? (
          <Link
            to="/app/profile"
            style={{
              display: "inline-block",
              marginTop: "12px",
              fontSize: "13px",
              color: ACCENT_RED,
              textDecoration: "none",
            }}
          >
            Edit Profile
          </Link>
        ) : null}
      </div>
    </div>
  );
}
