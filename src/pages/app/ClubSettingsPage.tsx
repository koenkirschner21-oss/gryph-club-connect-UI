import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Users, ClipboardList, Vote, Camera, Globe } from "lucide-react";
import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { uploadImage } from "../../lib/uploadImage";
import { supabase } from "../../lib/supabaseClient";
import { parseJoinQuestions } from "../../lib/clubJoinUtils";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import type { ClubJoinType, JoinQuestion, MemberRole } from "../../types";
import ImageUpload from "../../components/ui/ImageUpload";
import ImageCropModal from "../../components/ui/ImageCropModal";
import { showToast } from "../../components/ui/Toast";

function SocialInstagramIcon({
  size = 15,
  color = "#555555",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none" />
    </svg>
  );
}

function SocialLinkedinIcon({
  size = 15,
  color = "#555555",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="20" rx="3" />
      <path d="M7 10v7M7 7v.01M11 17v-4a2 2 0 0 1 4 0v4" />
    </svg>
  );
}

function SocialTwitterIcon({
  size = 15,
  color = "#555555",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 4l16 16M20 4L4 20" />
    </svg>
  );
}

function normalizeMemberRole(role: string): MemberRole {
  if (role === "executive" || role === "exec") return "executive";
  if (role === "owner") return "owner";
  return "member";
}

function formatSettingsRoleLabel(role: MemberRole | string): string {
  if (role === "owner") return "President";
  if (role === "executive" || role === "exec") return "Executive";
  return "Member";
}

const PAGE_BG = "#0f0f0f";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";
const INPUT_BG = "#0f0f0f";
const ACCENT_RED = "#E51937";
const ACCENT_GOLD = "#FFC429";

const sectionCardStyle: CSSProperties = {
  background: CARD_BG,
  borderTop: `1px solid ${CARD_BORDER}`,
  borderRight: `1px solid ${CARD_BORDER}`,
  borderBottom: `1px solid ${CARD_BORDER}`,
  borderLeft: `1px solid ${CARD_BORDER}`,
  borderRadius: "14px",
  padding: "28px 32px",
  marginBottom: "20px",
};

const dangerSectionCardStyle: CSSProperties = {
  ...sectionCardStyle,
  borderLeft: `3px solid ${ACCENT_RED}`,
  padding: "24px 32px",
};

const fieldLabelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#888888",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "6px",
  display: "block",
};

const inputBaseStyle: CSSProperties = {
  width: "100%",
  background: INPUT_BG,
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: "8px",
  padding: "10px 14px",
  fontSize: "14px",
  color: "#ffffff",
  outline: "none",
  boxSizing: "border-box",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.85)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: "16px",
};

const modalPanelStyle: CSSProperties = {
  background: CARD_BG,
  borderTop: `1px solid ${CARD_BORDER}`,
  borderRight: `1px solid ${CARD_BORDER}`,
  borderBottom: `1px solid ${CARD_BORDER}`,
  borderLeft: `3px solid ${ACCENT_RED}`,
  borderRadius: "16px",
  padding: "32px",
  maxWidth: "440px",
  width: "100%",
};

interface FormSnapshot {
  name: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  abbreviation: string;
  brandColor: string;
  requiresApproval: boolean;
  logoUrl: string;
  bannerUrl: string;
  instagramUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  websiteUrl: string;
}

function SettingsSection({
  title,
  subtitle,
  children,
  style,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section style={{ ...sectionCardStyle, ...style }}>
      <h2
        style={{
          fontSize: "14px",
          fontWeight: 700,
          color: "#ffffff",
          margin: "0 0 4px",
        }}
      >
        {title}
      </h2>
      <p
        style={{
          fontSize: "12px",
          color: "#555555",
          margin: "0 0 20px",
          paddingBottom: "16px",
          borderBottom: "1px solid #1a1a1a",
        }}
      >
        {subtitle}
      </p>
      {children}
    </section>
  );
}

function SettingsField({
  id,
  label,
  required,
  children,
}: {
  id?: string;
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label htmlFor={id} style={fieldLabelStyle}>
        {label}
        {required ? (
          <span style={{ color: ACCENT_RED, marginLeft: "2px" }}>*</span>
        ) : null}
      </label>
      {children}
    </div>
  );
}

function SettingsTextInput({
  id,
  value,
  onChange,
  onDirty,
  placeholder,
  type = "text",
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onDirty?: () => void;
  placeholder?: string;
  type?: string;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        onChange(e.target.value);
        onDirty?.();
      }}
      style={{
        ...inputBaseStyle,
        borderColor: focused ? ACCENT_RED : CARD_BORDER,
      }}
    />
  );
}

function SettingsTextarea({
  id,
  value,
  onChange,
  onDirty,
  placeholder,
  minHeight = 120,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onDirty?: () => void;
  placeholder?: string;
  minHeight?: number;
  maxLength?: number;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      id={id}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        onChange(e.target.value);
        onDirty?.();
      }}
      style={{
        ...inputBaseStyle,
        minHeight: `${minHeight}px`,
        resize: "vertical",
        borderColor: focused ? ACCENT_RED : CARD_BORDER,
      }}
    />
  );
}

function SettingsSelect({
  id,
  value,
  onChange,
  onDirty,
  children,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onDirty?: () => void;
  children: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      id={id}
      value={value}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        onChange(e.target.value);
        onDirty?.();
      }}
      style={{
        ...inputBaseStyle,
        appearance: "none",
        borderColor: focused ? ACCENT_RED : CARD_BORDER,
      }}
    >
      {children}
    </select>
  );
}

function SocialLinkField({
  id,
  label,
  icon,
  value,
  onChange,
  onDirty,
  placeholder,
}: {
  id: string;
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  onDirty?: () => void;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <SettingsField id={id} label={label}>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
          }}
        >
          {icon}
        </span>
        <input
          id={id}
          type="url"
          value={value}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            onChange(e.target.value);
            onDirty?.();
          }}
          style={{
            ...inputBaseStyle,
            paddingLeft: "38px",
            borderColor: focused ? ACCENT_RED : CARD_BORDER,
          }}
        />
      </div>
    </SettingsField>
  );
}

const JOIN_TYPE_OPTIONS: {
  value: ClubJoinType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    value: "open",
    label: "Open",
    description: "Anyone can join instantly",
    icon: Users,
  },
  {
    value: "application",
    label: "Application",
    description: "Members must apply and be approved by an executive",
    icon: ClipboardList,
  },
  {
    value: "vote",
    label: "Vote",
    description: "Executives vote yes/no, majority wins",
    icon: Vote,
  },
];

function JoinQuestionBuilder({
  questions,
  onChange,
}: {
  questions: JoinQuestion[];
  onChange: (questions: JoinQuestion[]) => void;
}) {
  const update = (id: string, patch: Partial<JoinQuestion>) => {
    onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  };

  const remove = (id: string) => {
    onChange(
      questions
        .filter((q) => q.id !== id)
        .map((q, index) => ({ ...q, order_index: index })),
    );
  };

  const add = (question_type: "short" | "long") => {
    onChange([
      ...questions,
      {
        id: crypto.randomUUID(),
        question: "",
        question_type,
        required: false,
        order_index: questions.length,
      },
    ]);
  };

  const inputStyle: CSSProperties = {
    background: "#111111",
    border: "1px solid #2a2a2a",
    borderRadius: "6px",
    padding: "8px 12px",
    color: "#ffffff",
    fontSize: "13px",
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {questions.map((q) => (
          <div
            key={q.id}
            style={{
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <input
                type="text"
                value={q.question}
                onChange={(e) => update(q.id, { question: e.target.value })}
                placeholder="Question text"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={q.question_type}
                onChange={(e) =>
                  update(q.id, {
                    question_type: e.target.value as "short" | "long",
                  })
                }
                style={{ ...inputStyle, width: "140px" }}
              >
                <option value="short">Short answer</option>
                <option value="long">Long answer</option>
              </select>
              <button
                type="button"
                onClick={() => remove(q.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#E51937",
                  cursor: "pointer",
                  fontSize: "12px",
                  padding: "8px",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => add("short")}
          style={{
            background: "transparent",
            border: "1px solid #333333",
            color: "#cccccc",
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          + Short answer
        </button>
        <button
          type="button"
          onClick={() => add("long")}
          style={{
            background: "transparent",
            border: "1px solid #333333",
            color: "#cccccc",
            borderRadius: "6px",
            padding: "6px 14px",
            fontSize: "12px",
            cursor: "pointer",
          }}
        >
          + Long answer
        </button>
      </div>
    </div>
  );
}

export default function ClubSettingsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const { getClubById, updateClub, leaveClub } = useClubContext();
  const { members } = useClubMembers(clubId);
  const isMobile = useIsMobile();

  const club = getClubById(clubId ?? "");

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const [roleLoading, setRoleLoading] = useState(true);
  const [hasMembership, setHasMembership] = useState(false);

  const [name, setName] = useState(club?.name ?? "");
  const [shortDescription, setShortDescription] = useState(
    club?.shortDescription ?? "",
  );
  const [longDescription, setLongDescription] = useState(
    club?.longDescription ?? "",
  );
  const [category, setCategory] = useState(club?.category ?? "");
  const [abbreviation, setAbbreviation] = useState(
    club?.abbreviation ?? "",
  );
  const [brandColor, setBrandColor] = useState(club?.brandColor ?? "#C20430");
  const [requiresApproval, setRequiresApproval] = useState(
    club?.requiresApproval ?? false,
  );

  const [logoUrl, setLogoUrl] = useState(club?.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(club?.bannerUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [logoCropFile, setLogoCropFile] = useState<File | null>(null);
  const [logoUploadKey, setLogoUploadKey] = useState(0);
  const [logoPreviewHovered, setLogoPreviewHovered] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showLogoUrl, setShowLogoUrl] = useState(false);
  const [showBannerUrl, setShowBannerUrl] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<FormSnapshot | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [transferTargetId, setTransferTargetId] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [joinType, setJoinType] = useState<ClubJoinType>("open");
  const [joinQuestions, setJoinQuestions] = useState<JoinQuestion[]>([]);
  const [savingJoinQuestions, setSavingJoinQuestions] = useState(false);
  const [updatingJoinType, setUpdatingJoinType] = useState(false);

  const isOwner = userRole === "owner";

  const buildSnapshot = useCallback(
    (): FormSnapshot => ({
      name: club?.name ?? "",
      shortDescription: club?.shortDescription ?? "",
      longDescription: club?.longDescription ?? "",
      category: club?.category ?? "",
      abbreviation: club?.abbreviation ?? "",
      brandColor: club?.brandColor ?? "#C20430",
      requiresApproval: club?.requiresApproval ?? false,
      logoUrl: club?.logoUrl ?? "",
      bannerUrl: club?.bannerUrl ?? "",
      instagramUrl: "",
      linkedinUrl: "",
      twitterUrl: "",
      websiteUrl: "",
    }),
    [club],
  );

  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const applySnapshot = useCallback((snapshot: FormSnapshot) => {
    setName(snapshot.name);
    setShortDescription(snapshot.shortDescription);
    setLongDescription(snapshot.longDescription);
    setCategory(snapshot.category);
    setAbbreviation(snapshot.abbreviation);
    setBrandColor(snapshot.brandColor);
    setRequiresApproval(snapshot.requiresApproval);
    setLogoUrl(snapshot.logoUrl);
    setBannerUrl(snapshot.bannerUrl);
    setInstagramUrl(snapshot.instagramUrl);
    setLinkedinUrl(snapshot.linkedinUrl);
    setTwitterUrl(snapshot.twitterUrl);
    setWebsiteUrl(snapshot.websiteUrl);
  }, []);

  const handleDiscardChanges = useCallback(() => {
    if (savedSnapshot) {
      applySnapshot(savedSnapshot);
    }
    setHasUnsavedChanges(false);
  }, [applySnapshot, savedSnapshot]);

  useEffect(() => {
    if (!club) return;
    setSavedSnapshot(buildSnapshot());
  }, [club?.id, buildSnapshot]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRole() {
      if (!user?.id || !clubId) {
        if (!cancelled) setRoleLoading(false);
        return;
      }

      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();

      if (cancelled) return;

      if (data?.role) {
        setUserRole(normalizeMemberRole(data.role as string));
        setHasMembership(true);
      } else {
        setHasMembership(false);
      }
      setRoleLoading(false);
    }

    void fetchRole();
    return () => {
      cancelled = true;
    };
  }, [clubId, user?.id]);

  useEffect(() => {
    if (!clubId || !isOwner) return;

    let cancelled = false;

    supabase
      .from("clubs")
      .select("*")
      .eq("id", clubId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const loadedInstagram = (data.instagram_url as string) ?? "";
        const loadedLinkedin = (data.linkedin_url as string) ?? "";
        const loadedTwitter = (data.twitter_url as string) ?? "";
        const loadedWebsite = (data.website_url as string) ?? "";
        setInstagramUrl(loadedInstagram);
        setLinkedinUrl(loadedLinkedin);
        setTwitterUrl(loadedTwitter);
        setWebsiteUrl(loadedWebsite);
        setJoinType(
          data.join_type === "application" || data.join_type === "vote"
            ? data.join_type
            : "open",
        );
        setJoinQuestions(parseJoinQuestions(data.join_questions));
        setSavedSnapshot((prev) =>
          prev
            ? {
                ...prev,
                instagramUrl: loadedInstagram,
                linkedinUrl: loadedLinkedin,
                twitterUrl: loadedTwitter,
                websiteUrl: loadedWebsite,
              }
            : prev,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, isOwner]);

  async function handleLogoUpload(file: File) {
    if (!clubId) return;
    setUploadingLogo(true);
    setError(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${clubId}.${ext}`;
    const url = await uploadImage("club-logos", path, file);
    if (url) {
      setLogoUrl(`${url}?t=${Date.now()}`);
      markDirty();
    } else {
      setError("Logo upload failed.");
    }
    setUploadingLogo(false);
  }

  async function handleBannerUpload(file: File) {
    if (!clubId) return;
    setUploadingBanner(true);
    setError(null);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${clubId}.${ext}`;
    const url = await uploadImage("club-banners", path, file);
    if (url) {
      setBannerUrl(`${url}?t=${Date.now()}`);
      markDirty();
    } else {
      setError("Banner upload failed.");
    }
    setUploadingBanner(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim()) {
      setError("Club name is required");
      return;
    }

    setSaving(true);

    const ok = await updateClub(
      clubId!,
      isOwner
        ? {
            name: name.trim(),
            shortDescription: shortDescription.trim() || undefined,
            longDescription: longDescription.trim() || undefined,
            category: category.trim(),
            abbreviation: abbreviation.trim() || undefined,
            brandColor: brandColor.trim() || undefined,
            logoUrl: logoUrl.trim() || undefined,
            bannerUrl: bannerUrl.trim() || undefined,
            requiresApproval,
          }
        : {
            name: name.trim(),
            shortDescription: shortDescription.trim() || undefined,
            longDescription: longDescription.trim() || undefined,
            category: category.trim(),
          },
    );

    if (ok && isOwner) {
      const { error: socialError } = await supabase
        .from("clubs")
        .update({
          instagram_url: instagramUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          twitter_url: twitterUrl.trim() || null,
          website_url: websiteUrl.trim() || null,
        })
        .eq("id", clubId);

      if (socialError) {
        setSaving(false);
        setError("Failed to save social links. Please try again.");
        return;
      }
    }

    setSaving(false);

    if (ok) {
      setSuccess(true);
      setHasUnsavedChanges(false);
      setSavedSnapshot({
        name: name.trim(),
        shortDescription: shortDescription.trim(),
        longDescription: longDescription.trim(),
        category: category.trim(),
        abbreviation: abbreviation.trim(),
        brandColor: brandColor.trim(),
        requiresApproval,
        logoUrl: logoUrl.trim(),
        bannerUrl: bannerUrl.trim(),
        instagramUrl: instagramUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        twitterUrl: twitterUrl.trim(),
        websiteUrl: websiteUrl.trim(),
      });
    } else {
      setError("Failed to save changes. Please try again.");
    }
  }

  async function handleRegenerateCode() {
    if (!clubId) return;
    setRegeneratingCode(true);
    setError(null);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const randomValues = crypto.getRandomValues(new Uint8Array(6));
    const newCode = Array.from(randomValues, (v) => chars[v % chars.length]).join("");
    const ok = await updateClub(clubId, { joinCode: newCode });
    setRegeneratingCode(false);
    if (ok) {
      setSuccess(true);
    } else {
      setError("Failed to regenerate join code.");
    }
  }

  function handleCopyCode() {
    const currentCode = getClubById(clubId ?? "")?.joinCode;
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        setError("Failed to copy to clipboard.");
      },
    );
  }

  function handleCopyLink() {
    const currentCode = getClubById(clubId ?? "")?.joinCode;
    if (!currentCode) return;
    const link = `${window.location.origin}/join/${currentCode}`;
    navigator.clipboard.writeText(link).then(
      () => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      },
      () => {
        setError("Failed to copy to clipboard.");
      },
    );
  }

  async function handleConfirmTransfer() {
    if (!clubId || !user?.id || !transferTargetId) return;
    setTransferring(true);
    setError(null);

    const { error: ownerError } = await supabase
      .from("club_members")
      .update({ role: "owner" })
      .eq("club_id", clubId)
      .eq("user_id", transferTargetId);

    if (ownerError) {
      setError("Failed to transfer ownership. Please try again.");
      setTransferring(false);
      setShowTransferModal(false);
      return;
    }

    const { error: execError } = await supabase
      .from("club_members")
      .update({ role: "executive" })
      .eq("club_id", clubId)
      .eq("user_id", user.id);

    setTransferring(false);
    setShowTransferModal(false);

    if (execError) {
      setError("Ownership transferred but your role could not be updated.");
      return;
    }

    setUserRole("executive");
    setTransferTargetId("");
    setSuccess(true);
  }

  async function handleConfirmDelete() {
    if (!clubId || !club) return;
    if (deleteConfirmName.trim() !== club.name.trim()) return;

    setDeleting(true);
    setError(null);

    const { error: deleteError } = await supabase
      .from("clubs")
      .delete()
      .eq("id", clubId);

    setDeleting(false);
    setShowDeleteModal(false);

    if (deleteError) {
      setError("Failed to delete club. Please try again.");
      return;
    }

    navigate("/app", { replace: true });
  }

  async function handleConfirmLeave() {
    if (!clubId) return;
    setLeaving(true);
    leaveClub(clubId);
    setLeaving(false);
    setShowLeaveModal(false);
    navigate("/app", { replace: true });
  }

  async function handleJoinTypeChange(nextType: ClubJoinType) {
    if (!clubId || joinType === nextType) return;
    setUpdatingJoinType(true);
    const { error } = await supabase
      .from("clubs")
      .update({ join_type: nextType })
      .eq("id", clubId);

    setUpdatingJoinType(false);
    if (error) {
      console.error("Failed to update join type:", error.message);
      showToast("Failed to update membership type", "error");
      return;
    }

    setJoinType(nextType);
    showToast("Membership type updated", "success");
  }

  async function handleSaveJoinQuestions() {
    if (!clubId) return;
    setSavingJoinQuestions(true);
    const questions = joinQuestions
      .filter((q) => q.question.trim())
      .map((q, index) => ({
        id: q.id,
        question: q.question.trim(),
        question_type: q.question_type,
        required: q.required ?? false,
        order_index: index,
      }));

    const { error } = await supabase
      .from("clubs")
      .update({ join_questions: questions })
      .eq("id", clubId);

    setSavingJoinQuestions(false);
    if (error) {
      console.error("Failed to save questions:", error);
      showToast("Failed to save questions", "error");
      return;
    }

    setJoinQuestions(parseJoinQuestions(questions));
    showToast("Application questions saved", "success");
  }

  if (!club) {
    return <Navigate to="/app" replace />;
  }

  if (roleLoading) {
    return (
      <div style={{ padding: isMobile ? "16px" : "24px" }}>
        <p className="text-sm text-muted">Loading settings…</p>
      </div>
    );
  }

  if (!hasMembership) {
    return <Navigate to="/app" replace />;
  }

  const transferCandidates = members.filter(
    (m) => m.userId !== user?.id && m.status === "active",
  );

  if (userRole === "member") {
    return (
      <div style={{ padding: isMobile ? "16px" : "24px" }}>
        <h1 className="mb-1 text-xl font-bold text-white">Personal Settings</h1>
        <p className="mb-6 text-sm text-muted">
          Manage your membership in this club.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg bg-primary/10 px-4 py-3 text-sm text-primary"
          >
            {error}
          </div>
        )}

        <div
          style={{
            background: "#1a0a0a",
            border: "1px solid #3a1a1a",
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <h2
            style={{
              fontWeight: 600,
              fontSize: "15px",
              color: "#ffffff",
              margin: "0 0 8px",
            }}
          >
            Leave Club
          </h2>
          <p
            style={{
              fontSize: "13px",
              color: "#555555",
              margin: "0 0 16px",
            }}
          >
            You will lose access to this club workspace
          </p>
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            style={{
              background: "transparent",
              border: "1px solid #E51937",
              color: "#E51937",
              borderRadius: "6px",
              padding: "10px 24px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Leave Club
          </button>
        </div>

        {showLeaveModal ? (
          <div
            role="dialog"
            aria-modal="true"
            style={modalOverlayStyle}
            onClick={() => !leaving && setShowLeaveModal(false)}
          >
            <div style={modalPanelStyle} onClick={(e) => e.stopPropagation()}>
              <h3
                style={{
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#ffffff",
                  margin: "0 0 12px",
                }}
              >
                Leave club?
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  color: "#555555",
                  margin: "0 0 20px",
                }}
              >
                You will lose access to this club workspace.
              </p>
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => setShowLeaveModal(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid #333",
                    color: "#aaa",
                    borderRadius: "6px",
                    padding: "10px 20px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={leaving}
                  onClick={() => void handleConfirmLeave()}
                  style={{
                    background: "transparent",
                    border: "1px solid #E51937",
                    color: "#E51937",
                    borderRadius: "6px",
                    padding: "10px 20px",
                    cursor: "pointer",
                  }}
                >
                  {leaving ? "Leaving…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const categoryOptions = [
    "Academic",
    "Arts",
    "Athletics",
    "Cultural",
    "Engineering",
    "Environmental",
    "Health",
    "Media",
    "Political",
    "Recreation",
    "Social",
    "Technology",
    "Volunteer",
  ];

  return (
    <div
      style={{
        background: PAGE_BG,
        padding: isMobile ? "16px" : "24px",
        paddingBottom: hasUnsavedChanges ? "88px" : isMobile ? "16px" : "24px",
      }}
    >
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 800,
          color: "#ffffff",
          margin: "0 0 4px",
        }}
      >
        Club Settings
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "#555555",
          marginTop: "4px",
          marginBottom: "24px",
        }}
      >
        Manage your club profile, branding, membership, and permissions.
      </p>

      {error ? (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            border: `1px solid ${ACCENT_RED}`,
            backgroundColor: "rgba(229, 25, 55, 0.1)",
            padding: "12px 16px",
            fontSize: "13px",
            color: ACCENT_RED,
          }}
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          role="status"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            border: `1px solid ${ACCENT_GOLD}`,
            backgroundColor: "rgba(255, 196, 41, 0.1)",
            padding: "12px 16px",
            fontSize: "13px",
            color: ACCENT_GOLD,
          }}
        >
          Changes saved successfully.
        </div>
      ) : null}

      <form
        ref={formRef}
        id="club-settings-form"
        onSubmit={handleSubmit}
        noValidate
      >
        <SettingsSection
          title="Club Profile"
          subtitle="Basic information members see on your club page."
        >
          <SettingsField id="club-name" label="Club Name" required>
            <SettingsTextInput
              id="club-name"
              value={name}
              onChange={setName}
              onDirty={markDirty}
              placeholder="e.g. Gryphon Robotics Club"
            />
          </SettingsField>

          <SettingsField id="short-description" label="Short Description">
            <SettingsTextInput
              id="short-description"
              value={shortDescription}
              onChange={setShortDescription}
              onDirty={markDirty}
              placeholder="A brief tagline for your club"
              maxLength={200}
            />
          </SettingsField>

          <SettingsField id="long-description" label="Long Description">
            <SettingsTextarea
              id="long-description"
              value={longDescription}
              onChange={setLongDescription}
              onDirty={markDirty}
              placeholder="A detailed description of your club, its mission, and activities…"
              maxLength={1000}
            />
            <p
              style={{
                fontSize: "11px",
                color: "#444444",
                textAlign: "right",
                marginTop: "4px",
                marginBottom: 0,
              }}
            >
              {longDescription.length} / 1000
            </p>
          </SettingsField>

          <SettingsField id="manage-category" label="Category">
            <SettingsSelect
              id="manage-category"
              value={category}
              onChange={setCategory}
              onDirty={markDirty}
            >
              <option value="">Select a category</option>
              {categoryOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </SettingsSelect>
          </SettingsField>

          {isOwner ? (
            <SettingsField id="abbreviation" label="Abbreviation">
              <SettingsTextInput
                id="abbreviation"
                value={abbreviation}
                onChange={setAbbreviation}
                onDirty={markDirty}
                placeholder="e.g. GRC"
                maxLength={10}
              />
            </SettingsField>
          ) : null}
        </SettingsSection>

        {isOwner ? (
          <SettingsSection
            title="Branding"
            subtitle="Logo, banner, and accent color for your club."
          >
            <SettingsField label="Club Logo">
              <div
                key={logoUploadKey}
                style={{ display: "flex", alignItems: "center", gap: "16px" }}
              >
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  onMouseEnter={() => setLogoPreviewHovered(true)}
                  onMouseLeave={() => setLogoPreviewHovered(false)}
                  aria-label="Upload Logo"
                  disabled={uploadingLogo}
                  style={{
                    position: "relative",
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    border: `1px solid ${CARD_BORDER}`,
                    padding: 0,
                    cursor: uploadingLogo ? "not-allowed" : "pointer",
                    overflow: "hidden",
                    background: INPUT_BG,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Club logo preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <Camera size={18} color="#555555" aria-hidden />
                  )}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.5)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: logoPreviewHovered ? 1 : 0,
                      transition: "opacity 0.15s ease",
                      pointerEvents: "none",
                    }}
                  >
                    <Camera size={16} color="#ffffff" aria-hidden />
                  </div>
                </button>
                <div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    aria-label="Upload Logo"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) setLogoCropFile(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => logoInputRef.current?.click()}
                    style={{
                      background: ACCENT_RED,
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "9px 18px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: uploadingLogo ? "not-allowed" : "pointer",
                    }}
                  >
                    {uploadingLogo ? "Uploading…" : "Upload Logo"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoUrl((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#444444",
                  fontSize: "12px",
                  cursor: "pointer",
                  marginTop: "10px",
                  padding: 0,
                }}
              >
                {showLogoUrl ? "▲ Hide URL field" : "▼ Paste URL instead"}
              </button>
              {showLogoUrl ? (
                <div style={{ marginTop: "8px" }}>
                  <SettingsTextInput
                    id="logo-url"
                    type="url"
                    value={logoUrl}
                    onChange={setLogoUrl}
                    onDirty={markDirty}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
              ) : null}
            </SettingsField>

            <SettingsField label="Club Banner">
              {bannerUrl ? (
                <img
                  src={bannerUrl}
                  alt="Club banner preview"
                  style={{
                    width: "100%",
                    maxHeight: "120px",
                    objectFit: "cover",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    display: "block",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
              <ImageUpload
                currentUrl={bannerUrl}
                onFileSelected={handleBannerUpload}
                uploading={uploadingBanner}
                label="Upload Banner"
                shape="rect"
              />
              <button
                type="button"
                onClick={() => setShowBannerUrl((v) => !v)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#444444",
                  fontSize: "12px",
                  cursor: "pointer",
                  marginTop: "10px",
                  padding: 0,
                }}
              >
                {showBannerUrl ? "▲ Hide URL field" : "▼ Paste URL instead"}
              </button>
              {showBannerUrl ? (
                <div style={{ marginTop: "8px" }}>
                  <SettingsTextInput
                    id="banner-url"
                    type="url"
                    value={bannerUrl}
                    onChange={setBannerUrl}
                    onDirty={markDirty}
                    placeholder="https://example.com/banner.jpg"
                  />
                </div>
              ) : null}
            </SettingsField>

            <SettingsField id="brand-color" label="Brand Color">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <label
                  htmlFor="brand-color-picker"
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #333333",
                    background: brandColor,
                    cursor: "pointer",
                    flexShrink: 0,
                    display: "block",
                  }}
                >
                  <input
                    id="brand-color-picker"
                    type="color"
                    value={brandColor}
                    onChange={(e) => {
                      setBrandColor(e.target.value);
                      markDirty();
                    }}
                    style={{
                      opacity: 0,
                      width: 0,
                      height: 0,
                      position: "absolute",
                      pointerEvents: "none",
                    }}
                  />
                </label>
                <div style={{ width: "100px" }}>
                  <SettingsTextInput
                    id="brand-color"
                    value={brandColor}
                    onChange={setBrandColor}
                    onDirty={markDirty}
                    placeholder="#E51937"
                  />
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "#555555", marginTop: "4px", marginBottom: 0 }}>
                Used for club accents across the app.
              </p>
            </SettingsField>
          </SettingsSection>
        ) : null}

        {isOwner ? (
          <SettingsSection
            title="Social Links"
            subtitle="Connect your club's social profiles and website."
          >
            <SocialLinkField
              id="instagram-url"
              label="Instagram"
              icon={<SocialInstagramIcon />}
              value={instagramUrl}
              onChange={setInstagramUrl}
              onDirty={markDirty}
              placeholder="https://instagram.com/yourclub"
            />
            <SocialLinkField
              id="linkedin-url"
              label="LinkedIn"
              icon={<SocialLinkedinIcon />}
              value={linkedinUrl}
              onChange={setLinkedinUrl}
              onDirty={markDirty}
              placeholder="https://linkedin.com/company/yourclub"
            />
            <SocialLinkField
              id="twitter-url"
              label="Twitter / X"
              icon={<SocialTwitterIcon />}
              value={twitterUrl}
              onChange={setTwitterUrl}
              onDirty={markDirty}
              placeholder="https://twitter.com/yourclub"
            />
            <SocialLinkField
              id="website-url"
              label="Website"
              icon={<Globe size={15} color="#555555" aria-hidden />}
              value={websiteUrl}
              onChange={setWebsiteUrl}
              onDirty={markDirty}
              placeholder="https://yourclub.com"
            />
          </SettingsSection>
        ) : null}

        {!hasUnsavedChanges ? (
          <div style={{ marginBottom: "20px" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: ACCENT_RED,
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                padding: "9px 20px",
                fontSize: "14px",
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        ) : null}
      </form>

      {isOwner ? (
        <>
          <SettingsSection
            title="Membership"
            subtitle="Control how new members join your club."
          >
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {JOIN_TYPE_OPTIONS.map((option) => {
                const selected = joinType === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={updatingJoinType}
                    onClick={() => void handleJoinTypeChange(option.value)}
                    style={{
                      background: selected ? "#1a0505" : INPUT_BG,
                      borderTop: `1px solid ${CARD_BORDER}`,
                      borderRight: `1px solid ${CARD_BORDER}`,
                      borderBottom: `1px solid ${CARD_BORDER}`,
                      borderLeft: selected
                        ? `3px solid ${ACCENT_RED}`
                        : `1px solid ${CARD_BORDER}`,
                      borderRadius: "10px",
                      padding: "16px",
                      cursor: updatingJoinType ? "wait" : "pointer",
                      flex: "1 1 180px",
                      textAlign: "left",
                    }}
                  >
                    <Icon
                      size={20}
                      color={selected ? ACCENT_RED : "#555555"}
                      aria-hidden
                    />
                    <p
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "#ffffff",
                        margin: "10px 0 0",
                      }}
                    >
                      {option.label}
                    </p>
                    <p
                      style={{
                        fontSize: "12px",
                        color: "#555555",
                        marginTop: "4px",
                        marginBottom: 0,
                        lineHeight: 1.4,
                      }}
                    >
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            {joinType === "application" ? (
              <div style={{ marginTop: "20px" }}>
                <h3
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#ffffff",
                    margin: "0 0 12px",
                  }}
                >
                  Application Questions
                </h3>
                <JoinQuestionBuilder
                  questions={joinQuestions}
                  onChange={setJoinQuestions}
                />
                <button
                  type="button"
                  onClick={() => void handleSaveJoinQuestions()}
                  disabled={savingJoinQuestions}
                  style={{
                    marginTop: "16px",
                    background: ACCENT_RED,
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 20px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: savingJoinQuestions ? "wait" : "pointer",
                    opacity: savingJoinQuestions ? 0.7 : 1,
                  }}
                >
                  {savingJoinQuestions ? "Saving…" : "Save Questions"}
                </button>
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "16px",
                marginTop: "16px",
                borderTop: "1px solid #1a1a1a",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "14px",
                    color: "#ffffff",
                    fontWeight: 500,
                    margin: 0,
                  }}
                >
                  Require Join Approval
                </p>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#555555",
                    marginTop: "2px",
                    marginBottom: 0,
                  }}
                >
                  New members must be approved by an admin or exec
                </p>
              </div>
              <button
                id="requires-approval"
                type="button"
                role="switch"
                aria-checked={requiresApproval}
                onClick={() => {
                  setRequiresApproval((v) => !v);
                  markDirty();
                }}
                style={{
                  position: "relative",
                  display: "inline-flex",
                  height: "24px",
                  width: "44px",
                  flexShrink: 0,
                  cursor: "pointer",
                  borderRadius: "9999px",
                  border: "2px solid transparent",
                  background: requiresApproval ? ACCENT_RED : "#333333",
                  transition: "background 0.2s ease",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    pointerEvents: "none",
                    display: "inline-block",
                    height: "20px",
                    width: "20px",
                    borderRadius: "50%",
                    background: "#ffffff",
                    transform: requiresApproval
                      ? "translateX(20px)"
                      : "translateX(0)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Join Code"
            subtitle="Share this code to let people join your club."
          >
            {(() => {
              const currentCode = getClubById(clubId ?? "")?.joinCode;
              return currentCode ? (
                <>
                  <p
                    style={{
                      fontSize: "22px",
                      fontWeight: 800,
                      color: ACCENT_GOLD,
                      letterSpacing: "0.12em",
                      margin: 0,
                      fontFamily: "monospace",
                    }}
                  >
                    {currentCode}
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "10px",
                      marginTop: "16px",
                    }}
                  >
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      style={{
                        background: "#1a1200",
                        border: `1px solid ${ACCENT_GOLD}`,
                        color: ACCENT_GOLD,
                        borderRadius: "8px",
                        padding: "8px 18px",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {copied ? "✓ Copied" : "Copy Code"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      style={{
                        background: "transparent",
                        border: `1px solid ${CARD_BORDER}`,
                        color: "#777777",
                        borderRadius: "8px",
                        padding: "8px 18px",
                        fontSize: "13px",
                        cursor: "pointer",
                      }}
                    >
                      {copiedLink ? "✓ Link Copied" : "Copy Link"}
                    </button>
                    <button
                      type="button"
                      disabled={regeneratingCode}
                      onClick={() => void handleRegenerateCode()}
                      style={{
                        background: "transparent",
                        border: `1px solid ${CARD_BORDER}`,
                        color: "#cccccc",
                        borderRadius: "8px",
                        padding: "8px 18px",
                        fontSize: "13px",
                        cursor: regeneratingCode ? "wait" : "pointer",
                        opacity: regeneratingCode ? 0.7 : 1,
                      }}
                    >
                      {regeneratingCode ? "Regenerating…" : "Regenerate"}
                    </button>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
                    No join code generated yet.
                  </p>
                  <button
                    type="button"
                    disabled={regeneratingCode}
                    onClick={() => void handleRegenerateCode()}
                    style={{
                      background: ACCENT_RED,
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "8px",
                      padding: "8px 18px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: regeneratingCode ? "wait" : "pointer",
                    }}
                  >
                    {regeneratingCode ? "Generating…" : "Generate Code"}
                  </button>
                </div>
              );
            })()}
          </SettingsSection>

          <SettingsSection
            title="Ownership"
            subtitle="Transfer your president role to another member."
          >
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 16px",
              }}
            >
              You will become an Executive after transfer.
            </p>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                gap: "12px",
                alignItems: isMobile ? "stretch" : "center",
              }}
            >
              <SettingsSelect
                id="transfer-target"
                value={transferTargetId}
                onChange={setTransferTargetId}
              >
                <option value="">Select a member…</option>
                {transferCandidates.map((m) => (
                  <option key={m.id} value={m.userId}>
                    {m.fullName || m.email || "Unknown"} —{" "}
                    {formatSettingsRoleLabel(m.role)}
                  </option>
                ))}
              </SettingsSelect>
              <button
                type="button"
                disabled={!transferTargetId}
                onClick={() => setShowTransferModal(true)}
                style={{
                  background: "transparent",
                  border: `1px solid ${ACCENT_GOLD}`,
                  color: ACCENT_GOLD,
                  borderRadius: "8px",
                  padding: "10px 24px",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: transferTargetId ? "pointer" : "not-allowed",
                  opacity: transferTargetId ? 1 : 0.5,
                  flexShrink: 0,
                }}
              >
                Transfer
              </button>
            </div>
          </SettingsSection>

          <section style={dangerSectionCardStyle}>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 700,
                color: ACCENT_RED,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: "0 0 8px",
              }}
            >
              Danger Zone
            </p>
            <h3
              style={{
                fontWeight: 600,
                fontSize: "15px",
                color: "#ffffff",
                margin: "0 0 8px",
              }}
            >
              Delete Club
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 16px",
              }}
            >
              Permanently delete this club and all its data. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirmName("");
                setShowDeleteModal(true);
              }}
              style={{
                background: "transparent",
                border: `1px solid ${ACCENT_RED}`,
                color: ACCENT_RED,
                borderRadius: "8px",
                padding: "10px 24px",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Delete Club
            </button>
          </section>
        </>
      ) : null}

      {hasUnsavedChanges ? (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: PAGE_BG,
            borderTop: `1px solid ${CARD_BORDER}`,
            padding: "14px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={handleDiscardChanges}
            style={{
              background: "transparent",
              border: "1px solid #333333",
              color: "#777777",
              borderRadius: "8px",
              padding: "9px 20px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Discard
          </button>
          <button
            type="submit"
            form="club-settings-form"
            disabled={saving}
            style={{
              background: ACCENT_RED,
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "9px 20px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      ) : null}

      {showTransferModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => !transferring && setShowTransferModal(false)}
        >
          <div style={modalPanelStyle} onClick={(e) => e.stopPropagation()}>
            <h3
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 12px",
              }}
            >
              Are you sure?
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 20px",
              }}
            >
              You will lose president access.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                disabled={transferring}
                onClick={() => setShowTransferModal(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #333",
                  color: "#aaa",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transferring}
                onClick={() => void handleConfirmTransfer()}
                style={{
                  background: "transparent",
                  border: "1px solid #FFC429",
                  color: "#FFC429",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor: "pointer",
                }}
              >
                {transferring ? "Transferring…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDeleteModal ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div style={modalPanelStyle} onClick={(e) => e.stopPropagation()}>
            <h3
              style={{
                fontWeight: 800,
                fontSize: "20px",
                color: "#ffffff",
                margin: 0,
              }}
            >
              Delete {club.name}?
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#888888",
                lineHeight: 1.7,
                marginTop: "8px",
                marginBottom: 0,
              }}
            >
              This will permanently delete all club data including events,
              announcements, tasks, documents, chats, members, and applications.
              This cannot be undone.
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "#555555",
                marginTop: "16px",
                marginBottom: "8px",
              }}
            >
              Type <strong style={{ color: "#ffffff" }}>{club.name}</strong> to
              confirm.
            </p>
            <SettingsTextInput
              id="delete-confirm"
              value={deleteConfirmName}
              onChange={setDeleteConfirmName}
              placeholder={club.name}
            />
            <div
              style={{
                marginTop: "24px",
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#777777",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  deleting || deleteConfirmName.trim() !== club.name.trim()
                }
                onClick={() => void handleConfirmDelete()}
                style={{
                  background: ACCENT_RED,
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor:
                    deleteConfirmName.trim() === club.name.trim()
                      ? "pointer"
                      : "not-allowed",
                  opacity:
                    deleteConfirmName.trim() === club.name.trim() ? 1 : 0.5,
                }}
              >
                {deleting ? "Deleting…" : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {logoCropFile ? (
        <ImageCropModal
          imageFile={logoCropFile}
          aspectRatio={1}
          circular={false}
          onComplete={(blob) => {
            const file = new File([blob], "logo.jpg", { type: "image/jpeg" });
            setLogoCropFile(null);
            setLogoUploadKey((k) => k + 1);
            void handleLogoUpload(file);
          }}
          onCancel={() => {
            setLogoCropFile(null);
            setLogoUploadKey((k) => k + 1);
          }}
        />
      ) : null}
    </div>
  );
}
