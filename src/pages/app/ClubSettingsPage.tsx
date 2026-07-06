import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useParams, useNavigate, Navigate, useSearchParams } from "react-router-dom";
import { Users, ClipboardList, Link2, Bookmark, Camera, Globe, Check, Lock, X } from "lucide-react";
import { useClubContext } from "../../context/useClubContext";
import { useAuthContext } from "../../context/useAuthContext";
import { uploadImage } from "../../lib/uploadImage";
import { CLUB_LONG_DESCRIPTION_PLACEHOLDER } from "../../lib/clubRowMapping";
import { supabase } from "../../lib/supabaseClient";
import {
  defaultJoinQuestions,
  normalizeMembershipType,
  parseJoinQuestions,
  serializeJoinQuestions,
} from "../../lib/clubJoinUtils";
import { useClubMembers } from "../../hooks/useClubMembers";
import { useIsMobile } from "../../hooks/useWindowWidth";
import type { Club, JoinQuestion, JoinQuestionType, MemberRole, MembershipType } from "../../types";
import {
  cloneDefaultPermissions,
  isPermissionCellChanged,
  normalizeClubPermissions,
  parseClubPermissions,
  PERMISSION_ROLE_COLUMNS,
  PERMISSION_ROW_DEFINITIONS,
  permissionsEqual,
  type ClubPermissions,
  type PermissionKey,
  type PermissionRole,
} from "../../lib/clubPermissions";
import ImageUpload from "../../components/ui/ImageUpload";
import ImageCropModal from "../../components/ui/ImageCropModal";
import { showToast } from "../../components/ui/Toast";
import MyMembershipPanel from "../../components/club/MyMembershipPanel";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import {
  cancelOwnershipTransfer,
  isPresidentMember,
  mapOwnershipTransferRow,
  ownershipRoleLabel,
  resendOwnershipTransferReminder,
  sendOwnershipTransferInvite,
  type OwnershipTransferRole,
  type OwnershipTransferRow,
} from "../../lib/ownershipTransferUtils";

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
  membershipType: MembershipType;
  logoUrl: string;
  bannerUrl: string;
  contactEmail: string;
  meetingSchedule: string;
  instagramUrl: string;
  linkedinUrl: string;
  twitterUrl: string;
  websiteUrl: string;
}

function isPlaceholderImageUrl(url: string): boolean {
  const normalized = url.trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized.includes("ui-avatars") ||
    normalized.includes("placeholder") ||
    normalized.includes("default") ||
    normalized.includes("initials")
  );
}

function hasSocialLinkValue(...urls: string[]): boolean {
  return urls.some((value) => value.trim() !== "");
}

function PermissionCell({
  allowed,
  locked,
  changed,
  onToggle,
}: {
  allowed: boolean;
  locked: boolean;
  changed: boolean;
  onToggle?: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      disabled={locked}
      aria-label={allowed ? "Allowed" : "Not allowed"}
      onClick={locked ? undefined : onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "40px",
        width: "100%",
        border: "none",
        background: changed ? "rgba(255, 196, 41, 0.1)" : "transparent",
        cursor: locked ? "default" : "pointer",
        padding: 0,
      }}
    >
      {locked && hovered ? (
        <Lock size={14} color="#555555" aria-hidden />
      ) : allowed ? (
        <Check size={16} color="#FFC429" strokeWidth={2.5} aria-hidden />
      ) : (
        <X size={16} color="#555555" strokeWidth={2} aria-hidden />
      )}
    </button>
  );
}

function RolesPermissionsTable({
  permissions,
  savedPermissions,
  onToggle,
  onReset,
  resetting,
}: {
  permissions: ClubPermissions;
  savedPermissions: ClubPermissions;
  onToggle: (actionId: PermissionKey, role: PermissionRole) => void;
  onReset: () => void;
  resetting: boolean;
}) {
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "10px",
            overflow: "hidden",
            minWidth: "640px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(160px, 1.4fr) repeat(4, minmax(100px, 1fr))",
              background: "#1a1a1a",
              borderBottom: `1px solid ${CARD_BORDER}`,
            }}
          >
            <div style={{ padding: "12px 16px" }} />
            {PERMISSION_ROLE_COLUMNS.map((column) => (
              <div
                key={column.key}
                style={{
                  padding: "12px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "#777777",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  textAlign: "center",
                  lineHeight: 1.35,
                }}
              >
                {column.label}
              </div>
            ))}
          </div>

          {PERMISSION_ROW_DEFINITIONS.map((row, index) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(160px, 1.4fr) repeat(4, minmax(100px, 1fr))",
                background: index % 2 === 0 ? "#141414" : "#161616",
                borderBottom:
                  index < PERMISSION_ROW_DEFINITIONS.length - 1
                    ? `1px solid ${CARD_BORDER}`
                    : "none",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  fontSize: "13px",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {row.label}
              </div>
              {PERMISSION_ROLE_COLUMNS.map((column) => (
                <PermissionCell
                  key={`${row.id}-${column.key}`}
                  allowed={permissions[row.id][column.key]}
                  locked={column.locked}
                  changed={isPermissionCellChanged(
                    permissions,
                    savedPermissions,
                    row.id,
                    column.key,
                  )}
                  onToggle={
                    column.locked
                      ? undefined
                      : () => onToggle(row.id, column.key)
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={resetting}
        style={{
          marginTop: "12px",
          background: "none",
          border: "none",
          padding: 0,
          color: "#555555",
          fontSize: "12px",
          cursor: resetting ? "wait" : "pointer",
          textDecoration: "underline",
        }}
      >
        Reset to defaults
      </button>
    </div>
  );
}

function SettingsSection({
  title,
  subtitle,
  children,
  style,
  sectionId,
  highlighted = false,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  style?: CSSProperties;
  sectionId?: string;
  highlighted?: boolean;
}) {
  return (
    <section
      id={sectionId}
      style={{
        ...sectionCardStyle,
        scrollMarginTop: "88px",
        boxShadow: highlighted ? "0 0 0 2px #FFC429" : undefined,
        transition: "box-shadow 0.3s ease",
        ...style,
      }}
    >
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

const MEMBERSHIP_TYPE_OPTIONS: {
  value: MembershipType;
  label: string;
  description: string;
  icon: typeof Users;
}[] = [
  {
    value: "open",
    label: "Open Membership",
    description: "Anyone can join instantly",
    icon: Users,
  },
  {
    value: "approval_required",
    label: "Approval Required",
    description: "Members request to join, you review and approve",
    icon: ClipboardList,
  },
  {
    value: "invite_only",
    label: "Invite Only",
    description: "Members need an invite link or join code",
    icon: Link2,
  },
  {
    value: "no_membership",
    label: "No General Membership",
    description: "No general members, students can only save or follow",
    icon: Bookmark,
  },
];

function JoinQuestionBuilder({
  questions,
  allowFileUpload,
  onChange,
  onAllowFileUploadChange,
}: {
  questions: JoinQuestion[];
  allowFileUpload: boolean;
  onChange: (questions: JoinQuestion[]) => void;
  onAllowFileUploadChange: (value: boolean) => void;
}) {
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

  const addQuestion = () => {
    onChange([
      ...questions,
      {
        id: crypto.randomUUID(),
        question: "",
        question_type: "short",
        required: false,
        order_index: questions.length,
        options: [],
      },
    ]);
  };

  const addOption = (questionId: string) => {
    onChange(
      questions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: [...(question.options ?? []), ""],
            }
          : question,
      ),
    );
  };

  const updateOption = (questionId: string, index: number, value: string) => {
    onChange(
      questions.map((question) => {
        if (question.id !== questionId) return question;
        const options = [...(question.options ?? [])];
        options[index] = value;
        return { ...question, options };
      }),
    );
  };

  const removeOption = (questionId: string, index: number) => {
    onChange(
      questions.map((question) => {
        if (question.id !== questionId) return question;
        const options = [...(question.options ?? [])];
        options.splice(index, 1);
        return { ...question, options };
      }),
    );
  };

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {questions.map((question) => (
          <div
            key={question.id}
            style={{
              background: "#111111",
              border: "1px solid #2a2a2a",
              borderRadius: "8px",
              padding: "14px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <input
                type="text"
                value={question.question}
                onChange={(e) => update(question.id, { question: e.target.value })}
                placeholder="Question text"
                style={{ ...inputStyle, flex: 1 }}
              />
              <select
                value={question.question_type}
                onChange={(e) =>
                  update(question.id, {
                    question_type: e.target.value as JoinQuestionType,
                    options:
                      e.target.value === "multiple_choice"
                        ? question.options?.length
                          ? question.options
                          : [""]
                        : undefined,
                  })
                }
                style={{ ...inputStyle, width: "160px" }}
              >
                <option value="short">Short Answer</option>
                <option value="long">Long Answer</option>
                <option value="multiple_choice">Multiple Choice</option>
              </select>
              <button
                type="button"
                onClick={() => remove(question.id)}
                style={{
                  background: "transparent",
                  border: "1px solid #E51937",
                  color: "#E51937",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "10px",
                fontSize: "12px",
                color: "#888888",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(question.required)}
                onChange={(e) => update(question.id, { required: e.target.checked })}
              />
              Required
            </label>

            {question.question_type === "multiple_choice" ? (
              <div style={{ marginTop: "12px" }}>
                {(question.options ?? []).map((option, index) => (
                  <div
                    key={`${question.id}-option-${index}`}
                    style={{ display: "flex", gap: "8px", marginBottom: "8px" }}
                  >
                    <input
                      type="text"
                      value={option}
                      onChange={(e) =>
                        updateOption(question.id, index, e.target.value)
                      }
                      placeholder={`Option ${index + 1}`}
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(question.id, index)}
                      style={{
                        background: "transparent",
                        border: "1px solid #333333",
                        color: "#777777",
                        borderRadius: "6px",
                        padding: "8px 10px",
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(question.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid #333333",
                    color: "#cccccc",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Add Option
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addQuestion}
        style={{
          marginTop: "12px",
          background: "transparent",
          border: "1px solid #333333",
          color: "#cccccc",
          borderRadius: "6px",
          padding: "8px 16px",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Add Question
      </button>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "16px",
          fontSize: "13px",
          color: "#cccccc",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={allowFileUpload}
          onChange={(e) => onAllowFileUploadChange(e.target.checked)}
        />
        Allow file upload
      </label>
    </div>
  );
}

export default function ClubSettingsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthContext();
  const { getClubById, updateClub } = useClubContext();
  const { members } = useClubMembers(clubId);
  const isMobile = useIsMobile();

  const club = getClubById(clubId ?? "");
  const memberAccess = useClubMemberAccess(clubId);
  const isOwner = memberAccess.role === "owner";

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
  const [logoUrl, setLogoUrl] = useState(club?.logoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(club?.bannerUrl ?? "");
  const [contactEmail, setContactEmail] = useState(club?.contactEmail ?? "");
  const [meetingSchedule, setMeetingSchedule] = useState(
    club?.meetingSchedule ?? "",
  );
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
  const [membershipDirty, setMembershipDirty] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<FormSnapshot | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferNewRole, setTransferNewRole] =
    useState<OwnershipTransferRole>("owner");
  const [transferMessage, setTransferMessage] = useState("");
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<OwnershipTransferRow | null>(
    null,
  );
  const [transferActionLoading, setTransferActionLoading] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [instagramUrl, setInstagramUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [membershipType, setMembershipType] = useState<MembershipType>(
    club?.membershipType ?? "open",
  );
  const [joinQuestions, setJoinQuestions] = useState<JoinQuestion[]>([]);
  const [allowJoinFileUpload, setAllowJoinFileUpload] = useState(false);
  const [savingJoinQuestions, setSavingJoinQuestions] = useState(false);
  const [permissions, setPermissions] = useState<ClubPermissions>(() =>
    cloneDefaultPermissions(),
  );
  const [savedPermissions, setSavedPermissions] = useState<ClubPermissions>(() =>
    cloneDefaultPermissions(),
  );
  const [resettingPermissions, setResettingPermissions] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState<string | null>(null);

  const canViewClubSettings =
    memberAccess.canManageClubSettings;

  const buildSnapshot = useCallback(
    (): FormSnapshot => ({
      name: club?.name ?? "",
      shortDescription: club?.shortDescription ?? "",
      longDescription: club?.longDescription ?? "",
      category: club?.category ?? "",
      abbreviation: club?.abbreviation ?? "",
      brandColor: club?.brandColor ?? "#C20430",
      membershipType: club?.membershipType ?? "open",
      logoUrl: club?.logoUrl ?? "",
      bannerUrl: club?.bannerUrl ?? "",
      contactEmail: club?.contactEmail ?? "",
      meetingSchedule: club?.meetingSchedule ?? "",
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
    setMembershipType(snapshot.membershipType);
    setLogoUrl(snapshot.logoUrl);
    setBannerUrl(snapshot.bannerUrl);
    setContactEmail(snapshot.contactEmail);
    setMeetingSchedule(snapshot.meetingSchedule);
    setInstagramUrl(snapshot.instagramUrl);
    setLinkedinUrl(snapshot.linkedinUrl);
    setTwitterUrl(snapshot.twitterUrl);
    setWebsiteUrl(snapshot.websiteUrl);
  }, []);

  const handleDiscardChanges = useCallback(() => {
    if (savedSnapshot) {
      applySnapshot(savedSnapshot);
    }
    setPermissions(savedPermissions);
    setHasUnsavedChanges(false);
  }, [applySnapshot, savedSnapshot, savedPermissions]);

  useEffect(() => {
    if (!club) return;
    const parsed = parseClubPermissions(club.customPermissions);
    setPermissions(parsed);
    setSavedPermissions(parsed);
  }, [club?.id, club?.customPermissions]);

  useEffect(() => {
    if (!club) return;
    const snapshot = buildSnapshot();
    applySnapshot(snapshot);
    setSavedSnapshot(snapshot);
    setHasUnsavedChanges(false);
  }, [club?.id]);

  useEffect(() => {
    const section = searchParams.get("section");
    const highlight = searchParams.get("highlight");
    if ((!section && !highlight) || memberAccess.loading || !canViewClubSettings) return;

    const sectionIdMap: Record<string, string> = {
      profile: "club-profile",
      branding: "branding",
      social: "social-links",
      membership: "membership",
    };
    const fieldScrollIdMap: Record<string, string> = {
      logo: "branding",
      banner: "branding",
      "short-description": "short-description",
      "contact-email": "contact-email",
      "meeting-schedule": "meeting-schedule",
      "social-links": "social-links",
      "membership-type": "membership",
    };

    const scrollKey = section ?? highlight;
    const targetId =
      (highlight ? fieldScrollIdMap[highlight] : undefined) ??
      (scrollKey ? sectionIdMap[scrollKey] : undefined);

    if (highlight) {
      setHighlightedSection(highlight);
      const timer = window.setTimeout(() => setHighlightedSection(null), 3000);
      if (targetId) {
        window.requestAnimationFrame(() => {
          document.getElementById(targetId)?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
      }
      return () => window.clearTimeout(timer);
    }

    if (!targetId) return;

    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [searchParams, memberAccess.loading, canViewClubSettings]);

  useEffect(() => {
    if (!clubId || !user?.id || !isOwner) {
      setPendingTransfer(null);
      return;
    }

    let cancelled = false;

    supabase
      .from("ownership_transfers")
      .select("*")
      .eq("club_id", clubId)
      .eq("from_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("Failed to load pending ownership transfer:", error.message);
          setPendingTransfer(null);
          return;
        }
        setPendingTransfer(
          data ? mapOwnershipTransferRow(data as Record<string, unknown>) : null,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [clubId, isOwner, user?.id]);

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
        setMembershipType(normalizeMembershipType(data.membership_type));
        const parsedQuestions = parseJoinQuestions(data.join_questions);
        setJoinQuestions(
          parsedQuestions.length > 0 ? parsedQuestions : defaultJoinQuestions(),
        );
        setAllowJoinFileUpload(Boolean(data.allow_join_file_upload));
        const loadedPermissions = parseClubPermissions(data.custom_permissions);
        setPermissions(loadedPermissions);
        setSavedPermissions(loadedPermissions);
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

  function handleTogglePermission(actionId: PermissionKey, role: PermissionRole) {
    if (role !== "managerial_executive" && role !== "executive") return;

    setPermissions((prev) =>
      normalizeClubPermissions({
        ...prev,
        [actionId]: {
          ...prev[actionId],
          [role]: !prev[actionId][role],
        },
      }),
    );
    markDirty();
  }

  async function handleResetPermissions() {
    if (!clubId) return;
    if (!window.confirm("Reset all permissions to default?")) return;

    setResettingPermissions(true);
    const defaults = cloneDefaultPermissions();

    const { error } = await supabase
      .from("clubs")
      .update({ custom_permissions: defaults })
      .eq("id", clubId);

    setResettingPermissions(false);

    if (error) {
      showToast("Failed to reset permissions.", "error");
      return;
    }

    setPermissions(defaults);
    setSavedPermissions(defaults);
    void updateClub(clubId, { customPermissions: defaults });
    showToast("Permissions saved", "success");
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
    const permissionsDirty = !permissionsEqual(permissions, savedPermissions);
    const confirmField = searchParams.get("confirm");
    const wantsConfirm = (field: string) => confirmField === field;

    const ownerUpdate: Partial<Club> = {
      name: name.trim(),
      shortDescription: shortDescription.trim() || undefined,
      longDescription: longDescription.trim() || undefined,
      category: category.trim(),
      abbreviation: abbreviation.trim() || undefined,
      brandColor: brandColor.trim() || undefined,
      logoUrl: logoUrl.trim() || undefined,
      bannerUrl: bannerUrl.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      meetingSchedule: meetingSchedule.trim() || undefined,
      membershipType,
    };

    if (savedSnapshot) {
      if (
        shortDescription.trim() &&
        (wantsConfirm("short-description") ||
          shortDescription.trim() !== savedSnapshot.shortDescription)
      ) {
        ownerUpdate.descriptionConfirmed = true;
      }
      if (
        logoUrl.trim() &&
        !isPlaceholderImageUrl(logoUrl) &&
        (wantsConfirm("logo") || logoUrl.trim() !== savedSnapshot.logoUrl)
      ) {
        ownerUpdate.logoConfirmed = true;
      }
      if (
        bannerUrl.trim() &&
        !isPlaceholderImageUrl(bannerUrl) &&
        (wantsConfirm("banner") || bannerUrl.trim() !== savedSnapshot.bannerUrl)
      ) {
        ownerUpdate.bannerConfirmed = true;
      }
      if (
        wantsConfirm("membership-type") ||
        membershipDirty ||
        membershipType !== savedSnapshot.membershipType
      ) {
        ownerUpdate.membershipConfirmed = true;
      }
      if (
        contactEmail.trim() &&
        (wantsConfirm("contact-email") ||
          contactEmail.trim() !== savedSnapshot.contactEmail)
      ) {
        ownerUpdate.contactEmailConfirmed = true;
      }
      if (
        meetingSchedule.trim() &&
        (wantsConfirm("meeting-schedule") ||
          meetingSchedule.trim() !== savedSnapshot.meetingSchedule)
      ) {
        ownerUpdate.meetingScheduleConfirmed = true;
      }
    }

    const socialLinksChanged = savedSnapshot
      ? instagramUrl.trim() !== savedSnapshot.instagramUrl ||
        linkedinUrl.trim() !== savedSnapshot.linkedinUrl ||
        twitterUrl.trim() !== savedSnapshot.twitterUrl ||
        websiteUrl.trim() !== savedSnapshot.websiteUrl
      : false;
    const shouldConfirmSocialLinks =
      hasSocialLinkValue(instagramUrl, linkedinUrl, twitterUrl, websiteUrl) &&
      (wantsConfirm("social-links") || socialLinksChanged);

    const ok = await updateClub(
      clubId!,
      isOwner
        ? ownerUpdate
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

      if (shouldConfirmSocialLinks) {
        await updateClub(clubId!, { socialLinksConfirmed: true });
      }

      if (permissionsDirty) {
        const normalizedPermissions = normalizeClubPermissions(permissions);
        const { error: permissionsError } = await supabase
          .from("clubs")
          .update({ custom_permissions: normalizedPermissions })
          .eq("id", clubId);

        if (permissionsError) {
          setSaving(false);
          setError("Failed to save permissions. Please try again.");
          return;
        }

        setPermissions(normalizedPermissions);
        setSavedPermissions(normalizedPermissions);
        void updateClub(clubId!, { customPermissions: normalizedPermissions });
        showToast("Permissions saved", "success");
      }
    }

    setSaving(false);

    if (ok) {
      setSuccess(true);
      setHasUnsavedChanges(false);
      setMembershipDirty(false);
      setSavedSnapshot({
        name: name.trim(),
        shortDescription: shortDescription.trim(),
        longDescription: longDescription.trim(),
        category: category.trim(),
        abbreviation: abbreviation.trim(),
        brandColor: brandColor.trim(),
        membershipType,
        logoUrl: logoUrl.trim(),
        bannerUrl: bannerUrl.trim(),
        contactEmail: contactEmail.trim(),
        meetingSchedule: meetingSchedule.trim(),
        instagramUrl: instagramUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        twitterUrl: twitterUrl.trim(),
        websiteUrl: websiteUrl.trim(),
      });
      if (confirmField) {
        const next = new URLSearchParams(searchParams);
        next.delete("confirm");
        setSearchParams(next, { replace: true });
      }
      window.dispatchEvent(
        new CustomEvent("club-setup-progress-changed", { detail: { clubId } }),
      );
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

  async function handleSendTransferRequest() {
    if (!clubId || !user?.id || !transferTargetId || !club) return;
    setTransferring(true);
    setError(null);

    const { transfer, error: transferError } = await sendOwnershipTransferInvite(supabase, {
      clubId,
      clubName: club.name,
      fromUserId: user.id,
      toUserId: transferTargetId,
      newRole: transferNewRole,
      optionalMessage: transferMessage,
    });

    setTransferring(false);
    setShowTransferModal(false);

    if (!transfer) {
      setError(transferError ?? "Failed to send transfer request. Please try again.");
      return;
    }

    setPendingTransfer(transfer);
    setTransferTargetId("");
    setTransferMessage("");
    setTransferNewRole("owner");
    setSuccess(true);
  }

  async function handleCancelTransferRequest() {
    if (!pendingTransfer) return;
    setTransferActionLoading(true);
    setError(null);

    const ok = await cancelOwnershipTransfer(supabase, pendingTransfer.id);
    setTransferActionLoading(false);

    if (!ok) {
      setError("Failed to cancel transfer request.");
      return;
    }

    setPendingTransfer(null);
    setSuccess(true);
  }

  async function handleResendTransferReminder() {
    if (!pendingTransfer || !club) return;
    setTransferActionLoading(true);
    setError(null);

    const ok = await resendOwnershipTransferReminder(
      supabase,
      pendingTransfer,
      club.name,
    );
    setTransferActionLoading(false);

    if (!ok) {
      setError("Failed to resend reminder.");
      return;
    }

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

  async function handleSaveJoinQuestions() {
    if (!clubId) return;
    setSavingJoinQuestions(true);
    const questions = serializeJoinQuestions(joinQuestions);

    const { error } = await supabase
      .from("clubs")
      .update({
        join_questions: questions,
        allow_join_file_upload: allowJoinFileUpload,
      })
      .eq("id", clubId);

    setSavingJoinQuestions(false);
    if (error) {
      console.error("Failed to save questions:", error);
      showToast("Failed to save questions", "error");
      return;
    }

    setJoinQuestions(parseJoinQuestions(questions));
    if (searchParams.get("confirm") === "membership-type") {
      void updateClub(clubId, { membershipConfirmed: true });
    }
    window.dispatchEvent(
      new CustomEvent("club-setup-progress-changed", { detail: { clubId } }),
    );
    showToast("Join request form saved", "success");
  }

  if (!club) {
    return <Navigate to="/app" replace />;
  }

  if (memberAccess.loading) {
    return (
      <div style={{ padding: isMobile ? "16px" : "24px" }}>
        <p className="text-sm text-muted">Loading settings…</p>
      </div>
    );
  }

  if (!memberAccess.hasMembership) {
    return <Navigate to="/app" replace />;
  }

  if (!canViewClubSettings) {
    return (
      <MyMembershipPanel
        club={club}
        accessLevel={memberAccess.accessLevel}
        memberTitle={memberAccess.memberTitle}
        joinedAt={memberAccess.joinedAt}
      />
    );
  }

  const transferCandidates = members.filter(
    (m) => m.userId !== user?.id && m.status === "active",
  );

  const presidentMembers = members.filter(
    (m) => m.status === "active" && isPresidentMember(m),
  );
  const isOnlyPresident =
    isOwner &&
    presidentMembers.length === 1 &&
    presidentMembers[0]?.userId === user?.id;
  const canSendTransfer =
    transferCandidates.length > 0 && !pendingTransfer && Boolean(transferTargetId);
  const transferBlockedNoMembers = isOwner && transferCandidates.length === 0;

  const pendingTransferRecipient = pendingTransfer
    ? members.find((m) => m.userId === pendingTransfer.toUserId)
    : undefined;

  function formatTransferSentDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
          sectionId="club-profile"
          highlighted={
            highlightedSection === "profile" ||
            highlightedSection === "short-description" ||
            highlightedSection === "contact-email" ||
            highlightedSection === "meeting-schedule"
          }
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

          <SettingsField id="contact-email" label="Contact Email">
            <SettingsTextInput
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={setContactEmail}
              onDirty={markDirty}
              placeholder="club@uoguelph.ca"
            />
          </SettingsField>

          <SettingsField id="meeting-schedule" label="Meeting Schedule">
            <SettingsTextInput
              id="meeting-schedule"
              value={meetingSchedule}
              onChange={setMeetingSchedule}
              onDirty={markDirty}
              placeholder="e.g. Wednesdays at 6pm in UC 442"
            />
          </SettingsField>

          <SettingsField id="long-description" label="Long Description">
            <SettingsTextarea
              id="long-description"
              value={longDescription}
              onChange={setLongDescription}
              onDirty={markDirty}
              placeholder={CLUB_LONG_DESCRIPTION_PLACEHOLDER}
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
            sectionId="branding"
          highlighted={
            highlightedSection === "branding" ||
            highlightedSection === "logo" ||
            highlightedSection === "banner"
          }
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
          <>
          <SettingsSection
            title="Social Links"
            subtitle="Connect your club's social profiles and website."
            sectionId="social-links"
            highlighted={
              highlightedSection === "social" ||
              highlightedSection === "social-links"
            }
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

          <SettingsSection
            title="Membership"
            subtitle="Control how new members join your club."
            sectionId="membership"
            highlighted={
              highlightedSection === "membership" ||
              highlightedSection === "membership-type"
            }
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2, 1fr)",
                gap: "12px",
              }}
            >
              {MEMBERSHIP_TYPE_OPTIONS.map((option) => {
                const selected = membershipType === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setMembershipType(option.value);
                      setMembershipDirty(true);
                      markDirty();
                    }}
                    style={{
                      background: "#141414",
                      border: selected
                        ? "1px solid #E51937"
                        : "1px solid #2a2a2a",
                      borderRadius: "10px",
                      padding: "16px",
                      cursor: "pointer",
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

            {membershipType === "approval_required" ? (
              <div style={{ marginTop: "20px" }}>
                <h3
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#ffffff",
                    margin: "0 0 12px",
                  }}
                >
                  Join Request Form
                </h3>
                <JoinQuestionBuilder
                  questions={
                    joinQuestions.length > 0
                      ? joinQuestions
                      : defaultJoinQuestions()
                  }
                  allowFileUpload={allowJoinFileUpload}
                  onChange={setJoinQuestions}
                  onAllowFileUploadChange={setAllowJoinFileUpload}
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
                  {savingJoinQuestions ? "Saving…" : "Save Join Form"}
                </button>
              </div>
            ) : null}
          </SettingsSection>

          <SettingsSection
            title="Roles & Permissions"
            subtitle="Control what each role can do inside your club workspace."
          >
            <RolesPermissionsTable
              permissions={permissions}
              savedPermissions={savedPermissions}
              onToggle={handleTogglePermission}
              onReset={() => void handleResetPermissions()}
              resetting={resettingPermissions}
            />
          </SettingsSection>
          </>
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
            subtitle="Invite another member to become President or Co-President. Ownership will only transfer after they accept."
          >
            {isOnlyPresident || transferBlockedNoMembers ? (
              <p
                style={{
                  fontSize: "13px",
                  color: ACCENT_GOLD,
                  margin: "0 0 16px",
                  lineHeight: 1.5,
                  background: "#1a1500",
                  border: "1px solid #3a2f00",
                  borderRadius: "8px",
                  padding: "12px 14px",
                }}
              >
                {transferBlockedNoMembers
                  ? "Add at least one other active member before you can send a transfer request."
                  : "This club must have at least one President or Co-President. Transfer ownership before leaving or changing your role."}
              </p>
            ) : null}

            {pendingTransfer ? (
              <div
                style={{
                  background: "#111111",
                  border: "1px solid #2a2a2a",
                  borderRadius: "10px",
                  padding: "16px",
                  marginBottom: "16px",
                }}
              >
                <p
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                    margin: "0 0 6px",
                  }}
                >
                  {pendingTransferRecipient?.fullName ||
                    pendingTransferRecipient?.email ||
                    "Member"}{" "}
                  has been invited to become{" "}
                  {ownershipRoleLabel(pendingTransfer.newRole)}
                </p>
                <p style={{ fontSize: "12px", color: "#555555", margin: "0 0 14px" }}>
                  Sent {formatTransferSentDate(pendingTransfer.createdAt)} · Pending
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                  <button
                    type="button"
                    disabled={transferActionLoading}
                    onClick={() => void handleResendTransferReminder()}
                    style={{
                      background: "transparent",
                      border: `1px solid ${ACCENT_GOLD}`,
                      color: ACCENT_GOLD,
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: transferActionLoading ? "wait" : "pointer",
                      opacity: transferActionLoading ? 0.6 : 1,
                    }}
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    disabled={transferActionLoading}
                    onClick={() => void handleCancelTransferRequest()}
                    style={{
                      background: "transparent",
                      border: "1px solid #333333",
                      color: "#aaaaaa",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: transferActionLoading ? "wait" : "pointer",
                      opacity: transferActionLoading ? 0.6 : 1,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    marginBottom: "12px",
                  }}
                >
                  <div>
                    <label htmlFor="transfer-target" style={fieldLabelStyle}>
                      Member
                    </label>
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
                  </div>
                  <div>
                    <label htmlFor="transfer-new-role" style={fieldLabelStyle}>
                      New owner role
                    </label>
                    <SettingsSelect
                      id="transfer-new-role"
                      value={transferNewRole}
                      onChange={(value) =>
                        setTransferNewRole(value as OwnershipTransferRole)
                      }
                    >
                      <option value="owner">President</option>
                      <option value="co_president">Co-President</option>
                    </SettingsSelect>
                  </div>
                  <div>
                    <label htmlFor="transfer-message" style={fieldLabelStyle}>
                      Optional message
                    </label>
                    <SettingsTextarea
                      id="transfer-message"
                      value={transferMessage}
                      onChange={setTransferMessage}
                      minHeight={80}
                      placeholder="Add a personal note with this invitation…"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  disabled={!canSendTransfer}
                  onClick={() => setShowTransferModal(true)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${ACCENT_GOLD}`,
                    color: ACCENT_GOLD,
                    borderRadius: "8px",
                    padding: "10px 24px",
                    fontSize: "14px",
                    fontWeight: 500,
                    cursor: canSendTransfer ? "pointer" : "not-allowed",
                    opacity: canSendTransfer ? 1 : 0.5,
                    flexShrink: 0,
                  }}
                >
                  Send Transfer Request
                </button>
                {transferCandidates.length === 0 ? (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "#555555",
                      margin: "10px 0 0",
                    }}
                  >
                    Add another active member before sending a transfer request.
                  </p>
                ) : null}
              </>
            )}
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
              Send Transfer Request
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 16px",
                lineHeight: 1.5,
              }}
            >
              {transferCandidates.find((m) => m.userId === transferTargetId)
                ?.fullName || "This member"}{" "}
              will be invited to become {ownershipRoleLabel(transferNewRole)}.
              Ownership transfers only after they accept.
            </p>
            <label htmlFor="transfer-optional-message" style={fieldLabelStyle}>
              Optional message
            </label>
            <div style={{ marginBottom: "20px" }}>
              <SettingsTextarea
                id="transfer-optional-message"
                value={transferMessage}
                onChange={setTransferMessage}
                minHeight={100}
                placeholder="Add a personal note with this invitation…"
              />
            </div>
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
                onClick={() => void handleSendTransferRequest()}
                style={{
                  background: "transparent",
                  border: "1px solid #FFC429",
                  color: "#FFC429",
                  borderRadius: "6px",
                  padding: "10px 20px",
                  cursor: "pointer",
                }}
              >
                {transferring ? "Sending…" : "Send Transfer Request"}
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
