import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  FileText,
  Globe,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import VisibilityBadge from "../../components/club/VisibilityBadge";
import { filterByVisibility, normalizeVisibility } from "../../lib/contentVisibility";
import type { MemberRole, Visibility } from "../../types";

const STORAGE_BUCKET = "club-documents";
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const DOCUMENT_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "meeting_notes", label: "Meeting Notes" },
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "events", label: "Events" },
  { value: "legal", label: "Legal" },
  { value: "other", label: "Other" },
] as const;

interface ClubDocument {
  id: string;
  club_id: string;
  uploaded_by: string | null;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  created_at: string;
  visibility?: Visibility;
  uploaderName?: string;
}

interface ResourceLink {
  id: string;
  club_id: string;
  title: string;
  url: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "8px 12px",
  color: "#ffffff",
  fontSize: "13px",
  boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "#888888",
  marginBottom: "8px",
};

const addLinkModalPanelStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "400px",
  width: "100%",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 50,
  padding: "16px",
};

const modalPanelStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "520px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
};

function normalizeUserRole(role: string): MemberRole {
  if (role === "owner") return "owner";
  if (role === "executive" || role === "exec") return "executive";
  return "member";
}

type CategoryOption = { value: string; label: string };

function categoryLabel(value: string, categories: CategoryOption[]): string {
  const fromList =
    categories.find((c) => c.value === value)?.label ??
    DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label;
  if (fromList) return fromList;
  const customFallback = value.replace(/^custom_/, "").replace(/_/g, " ");
  return customFallback || "General";
}

function customCategoriesStorageKey(clubId: string): string {
  return `club_documents_categories_${clubId}`;
}

function slugifyCategoryName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug ? `custom_${slug}` : `custom_${Date.now()}`;
}

function loadCustomCategories(clubId: string): CategoryOption[] {
  try {
    const raw = localStorage.getItem(customCategoriesStorageKey(clubId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (typeof item === "string") {
          return { value: slugifyCategoryName(item), label: item };
        }
        if (
          item &&
          typeof item === "object" &&
          "value" in item &&
          "label" in item
        ) {
          return {
            value: String((item as { value: string }).value),
            label: String((item as { label: string }).label),
          };
        }
        return null;
      })
      .filter((x): x is CategoryOption => x !== null);
  } catch {
    return [];
  }
}

function saveCustomCategories(clubId: string, categories: CategoryOption[]) {
  localStorage.setItem(
    customCategoriesStorageKey(clubId),
    JSON.stringify(categories),
  );
}

const DOCUMENT_VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  description: string;
  Icon: typeof Globe;
}[] = [
  {
    value: "public",
    label: "Public",
    description: "Anyone can see this",
    Icon: Globe,
  },
  {
    value: "members_only",
    label: "Members Only",
    description: "Only club members",
    Icon: Users,
  },
  {
    value: "executives_only",
    label: "Executives Only",
    description: "Only executives and above",
    Icon: Lock,
  },
];

function DocumentsVisibilitySelector({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "#888888",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          margin: "0 0 10px",
        }}
      >
        Who can see this?
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {DOCUMENT_VISIBILITY_OPTIONS.map((option) => {
          const active = value === option.value;
          const Icon = option.Icon;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              style={{
                borderRadius: "20px",
                padding: "8px 14px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                textAlign: "left",
                flex: "1 1 140px",
                minWidth: 0,
                background: active ? "#E51937" : "transparent",
                border: active ? "1px solid #E51937" : "1px solid #333333",
                color: active ? "#ffffff" : "#999999",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Icon size={14} aria-hidden />
                {option.label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 500,
                  marginTop: "2px",
                  color: active ? "#ffffff" : "#777777",
                }}
              >
                {option.description}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function categoryBadgeStyle(): CSSProperties {
  return {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    color: "#777777",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    display: "inline-block",
  };
}

function fileTypeBadgeStyle(): CSSProperties {
  return {
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    color: "#FFC429",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 600,
    display: "inline-block",
  };
}

function fileTypeLabel(name: string, fileType?: string | null): string {
  const ext = getFileExtension(name, fileType);
  if (ext === "img") return "IMG";
  if (!ext || ext === "file") return "FILE";
  return ext.toUpperCase();
}

function categoryEmptySubtext(category: string): string {
  const messages: Record<string, string> = {
    finance: "Upload budgets, receipts, or funding forms here.",
    meeting_notes: "Upload meeting agendas, minutes, and summaries here.",
    legal: "Upload constitutions, policies, or legal documents here.",
  };
  return messages[category] ?? "No files in this category yet.";
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string, fileType?: string | null): string {
  const fromName = name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && fromName !== name.toLowerCase()) return fromName;
  if (fileType?.includes("pdf")) return "pdf";
  if (fileType?.startsWith("image/")) return "img";
  return fromName || "file";
}

function previewKindForDocument(
  doc: ClubDocument,
): "image" | "pdf" | null {
  const ext = getFileExtension(doc.name, doc.file_type);
  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "img"].includes(ext) ||
    doc.file_type?.startsWith("image/")
  ) {
    return "image";
  }
  if (ext === "pdf" || doc.file_type?.includes("pdf")) return "pdf";
  return null;
}

async function downloadClubDocument(doc: ClubDocument): Promise<boolean> {
  try {
    const response = await fetch(doc.file_url);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = doc.name;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

function SkeletonCard() {
  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #242424",
        borderRadius: "10px",
        padding: "16px",
        minHeight: "180px",
      }}
    />
  );
}

function Box({
  style,
  children,
  className,
  role,
  onClick,
}: {
  style?: CSSProperties;
  children?: ReactNode;
  className?: string;
  role?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div style={style} className={className} role={role} onClick={onClick}>
      {children}
    </div>
  );
}

function ResourceLinkRow({
  link,
  canManage,
  onDelete,
  deleting,
  isLast,
}: {
  link: ResourceLink;
  canManage: boolean;
  onDelete: (link: ResourceLink) => void;
  deleting: boolean;
  isLast: boolean;
}) {
  const [openHovered, setOpenHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function openLink() {
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "14px 0",
        borderBottom: isLast ? "none" : "1px solid #1a1a1a",
      }}
    >
      <div
        style={{
          background: "#1a0505",
          borderRadius: "8px",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Globe size={18} color="#E51937" aria-hidden />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#ffffff",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {link.title}
        </p>
        <p
          style={{
            fontSize: "12px",
            color: "#555555",
            marginTop: "2px",
            marginBottom: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {link.url}
        </p>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <button
          type="button"
          onClick={openLink}
          onMouseEnter={() => setOpenHovered(true)}
          onMouseLeave={() => setOpenHovered(false)}
          style={{
            background: "transparent",
            border: `1px solid ${openHovered ? "#E51937" : "#2a2a2a"}`,
            color: openHovered ? "#E51937" : "#777777",
            borderRadius: "6px",
            padding: "5px 12px",
            fontSize: "12px",
            cursor: "pointer",
            transition: "border-color 0.15s ease, color 0.15s ease",
          }}
        >
          Open
        </button>
        {canManage ? (
          <div style={{ position: "relative" }}>
            <button
              type="button"
              aria-label={`Actions for ${link.title}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                color: "#777777",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
              }}
            >
              <MoreHorizontal size={16} />
            </button>
            {menuOpen ? (
              <div
                role="menu"
                style={{
                  position: "absolute",
                  right: 0,
                  top: "100%",
                  marginTop: "4px",
                  minWidth: "120px",
                  background: "#151515",
                  border: "1px solid #2a2a2a",
                  borderRadius: "8px",
                  overflow: "hidden",
                  zIndex: 10,
                }}
              >
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(link);
                  }}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    color: "#E51937",
                    fontSize: "12px",
                    padding: "8px 10px",
                    cursor: deleting ? "not-allowed" : "pointer",
                  }}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CategoryPills({
  value,
  onChange,
  categories,
  includeAll = false,
  customValues = [],
  onDeleteCustom,
  onAddClick,
}: {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryOption[];
  includeAll?: boolean;
  customValues?: string[];
  onDeleteCustom?: (value: string) => void;
  onAddClick?: () => void;
}) {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const [hoveredAdd, setHoveredAdd] = useState(false);
  const options = includeAll
    ? [{ value: "all", label: "All" }, ...categories]
    : categories;
  const customSet = new Set(customValues);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
      {options.map((option) => {
        const selected = value === option.value;
        const hovered = hoveredValue === option.value;
        const isCustom = customSet.has(option.value);
        return (
          <span
            key={option.value}
            style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            <button
              type="button"
              onClick={() => onChange(option.value)}
              onMouseEnter={() => setHoveredValue(option.value)}
              onMouseLeave={() => setHoveredValue(null)}
              style={{
                background: selected ? "#E51937" : "#1a1a1a",
                border: selected ? "none" : `1px solid ${hovered ? "#444444" : "#2a2a2a"}`,
                color: selected ? "#ffffff" : "#777777",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 500,
                padding: "6px 16px",
                cursor: "pointer",
                transition: "border-color 0.15s ease, color 0.15s ease",
                ...(selected ? null : hovered ? { color: "#cccccc" } : null),
              }}
            >
              {option.label}
            </button>
            {isCustom && onDeleteCustom ? (
              <button
                type="button"
                aria-label={`Remove ${option.label}`}
                onClick={() => onDeleteCustom(option.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#555555",
                  cursor: "pointer",
                  fontSize: "14px",
                  lineHeight: 1,
                  padding: "0 2px",
                }}
              >
                <X size={14} aria-hidden />
              </button>
            ) : null}
          </span>
        );
      })}
      {onAddClick ? (
        <button
          type="button"
          onClick={onAddClick}
          onMouseEnter={() => setHoveredAdd(true)}
          onMouseLeave={() => setHoveredAdd(false)}
          style={{
            background: "#1a1a1a",
            border: `1px dashed ${hoveredAdd ? "#555555" : "#333333"}`,
            color: hoveredAdd ? "#cccccc" : "#555555",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 500,
            padding: "6px 16px",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Plus size={14} aria-hidden />
            Category
          </span>
        </button>
      ) : null}
    </div>
  );
}

const docActionButtonStyle = (hovered: boolean): CSSProperties => ({
  background: "transparent",
  border: `1px solid ${hovered ? "#E51937" : "#2a2a2a"}`,
  color: hovered ? "#E51937" : "#777777",
  borderRadius: "6px",
  padding: "7px 14px",
  fontSize: "12px",
  cursor: "pointer",
  transition: "border-color 0.15s ease, color 0.15s ease",
});

function DocumentCard({
  doc,
  isPrivileged,
  deleting,
  onDelete,
  onEdit,
  onMoveCategory,
  onPreview,
  onDownload,
  categories,
}: {
  doc: ClubDocument;
  isPrivileged: boolean;
  deleting: boolean;
  onDelete: (doc: ClubDocument) => void;
  onEdit: (doc: ClubDocument) => void;
  onMoveCategory: (doc: ClubDocument) => void;
  onPreview: (doc: ClubDocument) => void;
  onDownload: (doc: ClubDocument) => void;
  categories: CategoryOption[];
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadHovered, setDownloadHovered] = useState(false);
  const [previewHovered, setPreviewHovered] = useState(false);
  const previewKind = previewKindForDocument(doc);
  const formattedDate = new Date(doc.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      onClick={() => setMenuOpen(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      style={{
        position: "relative",
        background: "#141414",
        border: `1px solid ${hovered ? "#333333" : "#2a2a2a"}`,
        borderRadius: "12px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        transition: "border-color 0.15s ease",
      }}
    >
      {isPrivileged ? (
        <div style={{ position: "absolute", top: "16px", right: "16px" }}>
          <button
            type="button"
            aria-label="Document actions"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#777777",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "2px",
            }}
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: "4px",
                minWidth: "140px",
                background: "#151515",
                border: "1px solid #2a2a2a",
                borderRadius: "8px",
                overflow: "hidden",
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onEdit(doc);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  color: "#cccccc",
                  fontSize: "12px",
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onMoveCategory(doc);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  color: "#cccccc",
                  fontSize: "12px",
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                Move Category
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete(doc);
                }}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  textAlign: "left",
                  color: "#E51937",
                  fontSize: "12px",
                  padding: "8px 10px",
                  cursor: deleting ? "not-allowed" : "pointer",
                }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", paddingRight: isPrivileged ? "28px" : 0 }}>
        <FileText size={28} color="#FFC429" aria-hidden style={{ flexShrink: 0 }} />
        <p
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {doc.name}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
        <VisibilityBadge visibility={doc.visibility} />
        <span style={categoryBadgeStyle()}>{categoryLabel(doc.category, categories)}</span>
        <span style={fileTypeBadgeStyle()}>{fileTypeLabel(doc.name, doc.file_type)}</span>
      </div>

      <p style={{ fontSize: "12px", color: "#444444", margin: 0 }}>
        Uploaded by {doc.uploaderName ?? "Unknown"} · {formattedDate} ·{" "}
        {formatFileSize(doc.file_size)}
      </p>

      {doc.description ? (
        <p
          style={{
            fontSize: "12px",
            color: "#555555",
            margin: 0,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {doc.description}
        </p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {previewKind ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(doc);
            }}
            onMouseEnter={() => setPreviewHovered(true)}
            onMouseLeave={() => setPreviewHovered(false)}
            style={docActionButtonStyle(previewHovered)}
          >
            Preview
          </button>
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void onDownload(doc);
          }}
          onMouseEnter={() => setDownloadHovered(true)}
          onMouseLeave={() => setDownloadHovered(false)}
          style={docActionButtonStyle(downloadHovered)}
        >
          Download
        </button>
      </div>
    </div>
  );
}

export default function ClubDocumentsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";
  const isMember = userRole !== null;

  const [documents, setDocuments] = useState<ClubDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [customCategories, setCustomCategories] = useState<CategoryOption[]>(
    [],
  );
  const [showCreateCategoryModal, setShowCreateCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadVisibility, setUploadVisibility] = useState<Visibility>("members_only");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ClubDocument | null>(null);
  const [editingDocument, setEditingDocument] = useState<ClubDocument | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [movingDocument, setMovingDocument] = useState<ClubDocument | null>(null);
  const [moveCategoryValue, setMoveCategoryValue] = useState("general");
  const [savingMove, setSavingMove] = useState(false);

  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  const allCategories = useMemo(
    () => [...DOCUMENT_CATEGORIES, ...customCategories],
    [customCategories],
  );

  const customCategoryValues = useMemo(
    () => customCategories.map((c) => c.value),
    [customCategories],
  );

  useEffect(() => {
    if (!clubId) return;
    setCustomCategories(loadCustomCategories(clubId));
  }, [clubId]);

  useEffect(() => {
    const fetchRole = async () => {
      if (!user?.id || !clubId) return;
      const { data } = await supabase
        .from("club_members")
        .select("role")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .single();
      if (data?.role) {
        setUserRole(normalizeUserRole(data.role));
      }
    };
    void fetchRole();
  }, [clubId, user?.id]);

  const loadResourceLinks = useCallback(async () => {
    if (!clubId) return;
    setLinksLoading(true);

    const { data, error } = await supabase
      .from("club_resource_links")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load resource links:", error.message);
      setResourceLinks([]);
    } else {
      setResourceLinks((data ?? []) as ResourceLink[]);
    }

    setLinksLoading(false);
  }, [clubId]);

  useEffect(() => {
    void loadResourceLinks();
  }, [loadResourceLinks]);

  const loadDocuments = useCallback(async () => {
    if (!clubId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("club_documents")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load documents:", error.message);
      setDocuments([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as ClubDocument[];
    const uploaderIds = [
      ...new Set(rows.map((d) => d.uploaded_by).filter(Boolean)),
    ] as string[];

    let profileMap: Record<string, string> = {};
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", uploaderIds);
      profileMap = Object.fromEntries(
        (profiles ?? []).map((p) => [
          p.id as string,
          (p.full_name as string) ?? "Unknown",
        ]),
      );
    }

    setDocuments(
      rows.map((row) => ({
        ...row,
        visibility: normalizeVisibility(row.visibility, "members_only"),
        uploaderName: row.uploaded_by
          ? profileMap[row.uploaded_by] ?? "Unknown"
          : "Unknown",
      })),
    );
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const filteredDocuments = useMemo(() => {
    let result = filterByVisibility(documents, { isMember, isPrivileged });
    if (filterCategory !== "all") {
      result = result.filter((doc) => doc.category === filterCategory);
    }
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter((doc) => {
        const cat = categoryLabel(doc.category, allCategories).toLowerCase();
        return (
          doc.name.toLowerCase().includes(query) ||
          cat.includes(query) ||
          (doc.description?.toLowerCase().includes(query) ?? false)
        );
      });
    }
    return result;
  }, [documents, filterCategory, searchQuery, allCategories, isMember, isPrivileged]);

  const searchActive = searchQuery.trim().length > 0;
  const categoryFiltered = filterCategory !== "all";

  function resetUploadForm() {
    setSelectedFile(null);
    setDocName("");
    setDocDescription("");
    setUploadCategory("general");
    setUploadVisibility("members_only");
    setUploadProgress(0);
  }

  function closeUploadModal() {
    if (uploading) return;
    setShowUploadModal(false);
    resetUploadForm();
  }

  function resetLinkForm() {
    setLinkTitle("");
    setLinkUrl("");
    setLinkDescription("");
  }

  function closeAddLinkModal() {
    if (savingLink) return;
    setShowAddLinkModal(false);
    resetLinkForm();
  }

  function handleCreateCategory() {
    if (!clubId || !newCategoryName.trim()) return;
    const label = newCategoryName.trim();
    const value = slugifyCategoryName(label);
    const exists = allCategories.some(
      (c) =>
        c.value === value ||
        c.label.toLowerCase() === label.toLowerCase(),
    );
    if (exists) {
      setFeedback({ type: "error", text: "That category already exists." });
      return;
    }
    const next = [...customCategories, { value, label }];
    setCustomCategories(next);
    saveCustomCategories(clubId, next);
    setShowCreateCategoryModal(false);
    setNewCategoryName("");
    setFeedback(null);
  }

  function handleDeleteCustomCategory(value: string) {
    if (!clubId) return;
    const next = customCategories.filter((c) => c.value !== value);
    setCustomCategories(next);
    saveCustomCategories(clubId, next);
    if (filterCategory === value) setFilterCategory("all");
    if (uploadCategory === value) setUploadCategory("general");
  }

  async function handleSaveLink() {
    if (!clubId || !user?.id || !linkTitle.trim() || !linkUrl.trim()) return;

    setSavingLink(true);
    setFeedback(null);

    const { error } = await supabase.from("club_resource_links").insert({
      club_id: clubId,
      title: linkTitle.trim(),
      url: linkUrl.trim(),
      description: linkDescription.trim() || null,
      added_by: user.id,
    });

    setSavingLink(false);

    if (error) {
      console.error("Failed to save resource link:", error.message);
      setFeedback({ type: "error", text: "Failed to save resource link." });
      return;
    }

    setFeedback({ type: "success", text: "Resource link added." });
    closeAddLinkModal();
    void loadResourceLinks();
  }

  async function handleDeleteLink(link: ResourceLink) {
    if (
      !window.confirm(`Delete "${link.title}"? This cannot be undone.`)
    ) {
      return;
    }

    setDeletingLinkId(link.id);
    setFeedback(null);

    const { error } = await supabase
      .from("club_resource_links")
      .delete()
      .eq("id", link.id);

    setDeletingLinkId(null);

    if (error) {
      setFeedback({ type: "error", text: "Failed to delete resource link." });
      return;
    }

    setFeedback({ type: "success", text: "Resource link deleted." });
    void loadResourceLinks();
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFeedback({ type: "error", text: "File must be 50MB or smaller." });
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
    setDocName(file.name.replace(/\.[^/.]+$/, "") || file.name);
    setFeedback(null);
  }

  async function uploadFileToStorage(file: File): Promise<string | null> {
    if (!clubId) return null;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${clubId}/${crypto.randomUUID()}-${safeName}`;

    setUploadProgress(10);

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: false });

    if (error) {
      console.error("Document upload failed:", error.message);
      return null;
    }

    setUploadProgress(80);

    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    setUploadProgress(100);
    return publicUrl;
  }

  function storagePathFromUrl(url: string): string | null {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length));
  }

  async function handleUpload() {
    if (!clubId || !user?.id || !selectedFile || !docName.trim()) return;

    setUploading(true);
    setUploadProgress(0);
    setFeedback(null);

    const fileUrl = await uploadFileToStorage(selectedFile);
    if (!fileUrl) {
      setFeedback({ type: "error", text: "Failed to upload file." });
      setUploading(false);
      return;
    }

    const { error } = await supabase.from("club_documents").insert({
      club_id: clubId,
      uploaded_by: user.id,
      name: docName.trim(),
      description: docDescription.trim() || null,
      file_url: fileUrl,
      file_type: selectedFile.type || null,
      file_size: selectedFile.size,
      category: uploadCategory,
      visibility: uploadVisibility,
    });

    setUploading(false);

    if (error) {
      console.error("Failed to save document:", error.message);
      setFeedback({ type: "error", text: "Failed to save document record." });
      return;
    }

    setFeedback({ type: "success", text: "Document uploaded." });
    closeUploadModal();
    void loadDocuments();
  }

  async function handleDownloadDocument(doc: ClubDocument) {
    setFeedback(null);
    const ok = await downloadClubDocument(doc);
    if (!ok) {
      setFeedback({ type: "error", text: "Failed to download document." });
    }
  }

  function openEditDocument(doc: ClubDocument) {
    setEditingDocument(doc);
    setEditDocName(doc.name);
  }

  function closeEditModal() {
    if (savingEdit) return;
    setEditingDocument(null);
    setEditDocName("");
  }

  function openMoveCategory(doc: ClubDocument) {
    setMovingDocument(doc);
    setMoveCategoryValue(doc.category);
  }

  function closeMoveCategoryModal() {
    if (savingMove) return;
    setMovingDocument(null);
    setMoveCategoryValue("general");
  }

  async function handleMoveCategory() {
    if (!movingDocument) return;

    setSavingMove(true);
    setFeedback(null);

    const { error } = await supabase
      .from("club_documents")
      .update({ category: moveCategoryValue })
      .eq("id", movingDocument.id);

    setSavingMove(false);

    if (error) {
      console.error("Failed to move document:", error.message);
      setFeedback({ type: "error", text: "Failed to move document." });
      return;
    }

    setFeedback({ type: "success", text: "Document moved." });
    closeMoveCategoryModal();
    void loadDocuments();
  }

  async function handleRenameDocument() {
    if (!editingDocument || !editDocName.trim()) return;

    setSavingEdit(true);
    setFeedback(null);

    const { error } = await supabase
      .from("club_documents")
      .update({ name: editDocName.trim() })
      .eq("id", editingDocument.id);

    setSavingEdit(false);

    if (error) {
      console.error("Failed to rename document:", error.message);
      setFeedback({ type: "error", text: "Failed to rename document." });
      return;
    }

    setFeedback({ type: "success", text: "Document renamed." });
    closeEditModal();
    void loadDocuments();
  }

  async function handleDelete(doc: ClubDocument) {
    if (!window.confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    setFeedback(null);

    const storagePath = storagePathFromUrl(doc.file_url);
    if (storagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }

    const { error } = await supabase
      .from("club_documents")
      .delete()
      .eq("id", doc.id);

    setDeletingId(null);

    if (error) {
      setFeedback({ type: "error", text: "Failed to delete document." });
      return;
    }

    setFeedback({ type: "success", text: "Document deleted." });
    void loadDocuments();
  }

  const gridStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
    gap: "16px",
  };

  return (
    <div
      style={{
        backgroundColor: "#0f0f0f",
        minHeight: "100%",
        padding: isMobile ? "16px" : "24px",
      }}
    >
      <Box
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <Box>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "28px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Documents
          </h1>
          <p style={{ fontSize: "14px", color: "#555555", marginTop: "4px", marginBottom: 0 }}>
            Access club files, meeting notes, resources, and shared links.
          </p>
          <p style={{ fontSize: "12px", color: "#444444", marginTop: "4px", marginBottom: 0 }}>
            {documents.length} files · {resourceLinks.length} links
          </p>
        </Box>
        {isPrivileged ? (
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "9px 18px",
              fontWeight: 500,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Upload Document
          </button>
        ) : null}
      </Box>

      {feedback ? (
        <div
          role="alert"
          style={{
            marginBottom: "16px",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            border:
              feedback.type === "success"
                ? "1px solid #3a2a00"
                : "1px solid #3a1a1a",
            background: feedback.type === "success" ? "#1a1500" : "#1a0505",
            color: feedback.type === "success" ? "#FFC429" : "#E51937",
          }}
        >
          {feedback.text}
        </div>
      ) : null}

      <div style={{ position: "relative", marginBottom: "16px" }}>
        <Search
          size={16}
          color="#555555"
          aria-hidden
          style={{
            position: "absolute",
            left: "12px",
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Search files by name, category, or description…"
          style={{
            width: "100%",
            height: "44px",
            background: "#111111",
            border: `1px solid ${searchFocused ? "#E51937" : "#2a2a2a"}`,
            borderRadius: "8px",
            padding: "0 16px 0 40px",
            fontSize: "14px",
            color: "#ffffff",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      <Box style={{ marginBottom: "20px" }}>
        <CategoryPills
          value={filterCategory}
          onChange={setFilterCategory}
          categories={allCategories}
          includeAll
          customValues={customCategoryValues}
          onDeleteCustom={isPrivileged ? handleDeleteCustomCategory : undefined}
          onAddClick={
            isPrivileged ? () => setShowCreateCategoryModal(true) : undefined
          }
        />
      </Box>

      <Box
        style={{
          marginBottom: "24px",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "14px",
          padding: "24px",
        }}
      >
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: resourceLinks.length > 0 ? "0" : "0",
          }}
        >
          <h2
            style={{
              fontWeight: 700,
              fontSize: "16px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Resource Links
          </h2>
          {isPrivileged ? (
            <button
              type="button"
              onClick={() => setShowAddLinkModal(true)}
              style={{
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: "#777777",
                borderRadius: "6px",
                padding: "6px 14px",
                fontSize: "12px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#E51937";
                e.currentTarget.style.color = "#E51937";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#2a2a2a";
                e.currentTarget.style.color = "#777777";
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Plus size={14} aria-hidden />
                Add Link
              </span>
            </button>
          ) : null}
        </Box>

        {linksLoading ? (
          <p style={{ fontSize: "13px", color: "#555555", margin: "8px 0 0" }}>
            Loading links…
          </p>
        ) : resourceLinks.length === 0 ? (
          <p style={{ fontSize: "13px", color: "#555555", margin: "8px 0 0" }}>
            No resource links yet
          </p>
        ) : (
          <Box>
            {resourceLinks.map((link, index) => (
              <ResourceLinkRow
                key={link.id}
                link={link}
                canManage={isPrivileged}
                deleting={deletingLinkId === link.id}
                isLast={index === resourceLinks.length - 1}
                onDelete={(item) => void handleDeleteLink(item)}
              />
            ))}
          </Box>
        )}
      </Box>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          marginTop: "8px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff" }}>
          Uploaded Files
        </span>
        <span style={{ fontSize: "12px", color: "#444444" }}>
          {filteredDocuments.length} files
        </span>
      </div>

      {loading ? (
        <div style={gridStyle}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <FileText
            size={36}
            color="#2a2a2a"
            aria-hidden
            style={{ marginBottom: "12px" }}
          />
          <p style={{ fontSize: "15px", fontWeight: 600, color: "#333333", margin: 0 }}>
            {documents.length === 0 && !searchActive && !categoryFiltered
              ? "No documents yet"
              : "No files found"}
          </p>
          <p style={{ fontSize: "13px", color: "#444444", marginTop: "4px", marginBottom: 0 }}>
            {searchActive
              ? "Try a different category or upload a new document."
              : categoryFiltered &&
                  !documents.some((doc) => doc.category === filterCategory)
                ? categoryEmptySubtext(filterCategory)
                : documents.length === 0 && !searchActive && !categoryFiltered
                  ? "Upload your first document to get started."
                  : "Try a different category or upload a new document."}
          </p>
          {isPrivileged &&
          documents.length === 0 &&
          !searchActive &&
          !categoryFiltered ? (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "#E51937",
                fontSize: "14px",
                cursor: "pointer",
                marginTop: "12px",
              }}
            >
              Upload your first document
            </button>
          ) : null}
        </div>
      ) : (
        <div style={gridStyle}>
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              categories={allCategories}
              isPrivileged={isPrivileged}
              deleting={deletingId === doc.id}
              onDelete={(item) => void handleDelete(item)}
              onEdit={openEditDocument}
              onMoveCategory={openMoveCategory}
              onPreview={(item) => setPreviewDoc(item)}
              onDownload={(item) => void handleDownloadDocument(item)}
            />
          ))}
        </div>
      )}

      {showAddLinkModal && isPrivileged ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={closeAddLinkModal}
        >
          <div
            style={addLinkModalPanelStyle}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              Add Link
            </h2>

            <label htmlFor="link-title" style={labelStyle}>
              Link Title
            </label>
            <input
              id="link-title"
              type="text"
              required
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="e.g. Club Google Drive"
              disabled={savingLink}
              style={{ ...inputStyle, marginBottom: "16px" }}
            />

            <label htmlFor="link-url" style={labelStyle}>
              URL
            </label>
            <input
              id="link-url"
              type="url"
              required
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://..."
              disabled={savingLink}
              style={{ ...inputStyle, marginBottom: "16px" }}
            />

            <label htmlFor="link-description" style={labelStyle}>
              Description (optional)
            </label>
            <input
              id="link-description"
              type="text"
              value={linkDescription}
              onChange={(e) => setLinkDescription(e.target.value)}
              placeholder="What is this link for?"
              disabled={savingLink}
              style={{ ...inputStyle, marginBottom: "16px" }}
            />

            <Box
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "4px",
              }}
            >
              <button
                type="button"
                onClick={closeAddLinkModal}
                disabled={savingLink}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveLink()}
                disabled={savingLink || !linkTitle.trim() || !linkUrl.trim()}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity:
                    savingLink || !linkTitle.trim() || !linkUrl.trim()
                      ? 0.5
                      : 1,
                }}
              >
                {savingLink ? "Saving…" : "Save"}
              </button>
            </Box>
          </div>
        </div>
      ) : null}

      {showUploadModal && isPrivileged ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={closeUploadModal}
        >
          <div
            style={modalPanelStyle}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              Upload Document
            </h2>

            <label
              htmlFor="document-file"
              style={{
                display: "block",
                fontSize: "12px",
                color: "#888888",
                marginBottom: "8px",
              }}
            >
              File (max 50MB)
            </label>
            <input
              id="document-file"
              type="file"
              onChange={handleFileChange}
              disabled={uploading}
              style={{
                width: "100%",
                marginBottom: "16px",
                color: "#cccccc",
                fontSize: "13px",
              }}
            />

            <label
              htmlFor="document-name"
              style={{
                display: "block",
                fontSize: "12px",
                color: "#888888",
                marginBottom: "8px",
              }}
            >
              Document name
            </label>
            <input
              id="document-name"
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              disabled={uploading}
              style={{
                width: "100%",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#ffffff",
                fontSize: "13px",
                boxSizing: "border-box",
                marginBottom: "16px",
              }}
            />

            <label
              htmlFor="document-description"
              style={{
                display: "block",
                fontSize: "12px",
                color: "#888888",
                marginBottom: "8px",
              }}
            >
              Description (optional)
            </label>
            <textarea
              id="document-description"
              value={docDescription}
              onChange={(e) => setDocDescription(e.target.value)}
              rows={3}
              disabled={uploading}
              style={{
                width: "100%",
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "6px",
                padding: "8px 12px",
                color: "#ffffff",
                fontSize: "13px",
                boxSizing: "border-box",
                marginBottom: "16px",
                resize: "vertical",
              }}
            />

            <p
              style={{
                fontSize: "12px",
                color: "#888888",
                margin: "0 0 8px",
              }}
            >
              Category
            </p>
            <CategoryPills
              value={uploadCategory}
              onChange={setUploadCategory}
              categories={allCategories}
            />

            <Box style={{ marginTop: "16px" }}>
              <DocumentsVisibilitySelector
                value={uploadVisibility}
                onChange={setUploadVisibility}
              />
            </Box>

            {uploading ? (
              <Box style={{ marginTop: "16px" }}>
                <Box
                  style={{
                    height: "6px",
                    background: "#111111",
                    borderRadius: "999px",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    style={{
                      height: "100%",
                      width: `${uploadProgress}%`,
                      background: "#E51937",
                      transition: "width 0.2s ease",
                    }}
                  />
                </Box>
                <p
                  style={{
                    fontSize: "12px",
                    color: "#747676",
                    margin: "8px 0 0",
                  }}
                >
                  Uploading… {uploadProgress}%
                </p>
              </Box>
            ) : null}

            <Box
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={closeUploadModal}
                disabled={uploading}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleUpload()}
                disabled={uploading || !selectedFile || !docName.trim()}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity:
                    uploading || !selectedFile || !docName.trim() ? 0.5 : 1,
                }}
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </Box>
          </div>
        </div>
      ) : null}

      {previewDoc ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            ...modalOverlayStyle,
            background:
              previewKindForDocument(previewDoc) === "image"
                ? "rgba(0, 0, 0, 0.85)"
                : modalOverlayStyle.background,
          }}
          onClick={() => setPreviewDoc(null)}
        >
          {previewKindForDocument(previewDoc) === "image" ? (
            <img
              src={previewDoc.file_url}
              alt={previewDoc.name}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "min(90vw, 1200px)",
                maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: "8px",
              }}
            />
          ) : (
            <div
              style={{
                width: "min(90vw, 960px)",
                height: "min(85vh, 800px)",
                background: "#1a1a1a",
                border: "1px solid #242424",
                borderRadius: "12px",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderBottom: "1px solid #242424",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                  }}
                >
                  {previewDoc.name}
                </p>
                <button
                  type="button"
                  aria-label="Close preview"
                  onClick={() => setPreviewDoc(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#777777",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                  }}
                >
                  <X size={18} aria-hidden />
                </button>
              </div>
              <iframe
                title={previewDoc.name}
                src={previewDoc.file_url}
                style={{ flex: 1, width: "100%", border: "none", background: "#111" }}
              />
            </div>
          )}
        </div>
      ) : null}

      {editingDocument ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={closeEditModal}
        >
          <div
            style={addLinkModalPanelStyle}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                Rename Document
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeEditModal}
                disabled={savingEdit}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#777777",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <label htmlFor="edit-doc-name" style={labelStyle}>
              Document name
            </label>
            <input
              id="edit-doc-name"
              type="text"
              value={editDocName}
              onChange={(e) => setEditDocName(e.target.value)}
              disabled={savingEdit}
              style={{ ...inputStyle, marginBottom: "16px" }}
            />

            <Box
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={closeEditModal}
                disabled={savingEdit}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleRenameDocument()}
                disabled={savingEdit || !editDocName.trim()}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: savingEdit || !editDocName.trim() ? 0.5 : 1,
                }}
              >
                {savingEdit ? "Saving…" : "Save"}
              </button>
            </Box>
          </div>
        </div>
      ) : null}

      {movingDocument && isPrivileged ? (
        <div
          role="dialog"
          aria-modal="true"
          style={modalOverlayStyle}
          onClick={closeMoveCategoryModal}
        >
          <div
            style={addLinkModalPanelStyle}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontWeight: 600,
                  fontSize: "16px",
                  color: "#ffffff",
                  margin: 0,
                }}
              >
                Move Category
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeMoveCategoryModal}
                disabled={savingMove}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#777777",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "#555555",
                margin: "0 0 12px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {movingDocument.name}
            </p>

            <CategoryPills
              value={moveCategoryValue}
              onChange={setMoveCategoryValue}
              categories={allCategories}
              customValues={customCategoryValues}
            />

            <Box
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <button
                type="button"
                onClick={closeMoveCategoryModal}
                disabled={savingMove}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleMoveCategory()}
                disabled={savingMove}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: savingMove ? 0.5 : 1,
                }}
              >
                {savingMove ? "Saving…" : "Save"}
              </button>
            </Box>
          </div>
        </div>
      ) : null}

      {showCreateCategoryModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-category-title"
          style={modalOverlayStyle}
          onClick={() => {
            setShowCreateCategoryModal(false);
            setNewCategoryName("");
          }}
        >
          <div
            style={{
              ...modalPanelStyle,
              maxWidth: "400px",
            }}
            onClick={(e) => e.stopPropagation()}
            role="presentation"
          >
            <h2
              id="new-category-title"
              style={{
                fontWeight: 600,
                fontSize: "16px",
                color: "#ffffff",
                margin: "0 0 16px",
              }}
            >
              New Category
            </h2>
            <label htmlFor="new-category-name" style={labelStyle}>
              Category name
            </label>
            <input
              id="new-category-name"
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ ...inputStyle, marginBottom: "20px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCategory();
              }}
            />
            <Box
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "10px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCreateCategoryModal(false);
                  setNewCategoryName("");
                }}
                style={{
                  background: "transparent",
                  border: "1px solid #333333",
                  color: "#888888",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCategory}
                disabled={!newCategoryName.trim()}
                style={{
                  background: "#E51937",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "13px",
                  cursor: newCategoryName.trim() ? "pointer" : "not-allowed",
                  opacity: newCategoryName.trim() ? 1 : 0.5,
                }}
              >
                Create
              </button>
            </Box>
          </div>
        </div>
      ) : null}
    </div>
  );
}
