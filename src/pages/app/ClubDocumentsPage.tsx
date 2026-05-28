import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { FileText, Globe, MoreHorizontal, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import type { MemberRole } from "../../types";

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

type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number]["value"];

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

function categoryLabel(value: string): string {
  return (
    DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? "General"
  );
}

function categoryBadgeStyle(): CSSProperties {
  return {
    background: "#111111",
    border: "1px solid #222222",
    color: "#747676",
    borderRadius: "20px",
    padding: "2px 10px",
    fontSize: "11px",
    display: "inline-block",
  };
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
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

function fileIconColor(name: string, fileType?: string | null): string {
  const ext = getFileExtension(name, fileType);
  if (ext === "pdf") return "#E51937";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "img"].includes(ext)) {
    return "#FFC429";
  }
  if (["doc", "docx", "txt", "rtf"].includes(ext)) return "#6b7cff";
  if (["xls", "xlsx", "csv"].includes(ext)) return "#4ade80";
  return "#747676";
}

function fileIconBackground(name: string, fileType?: string | null): string {
  const ext = getFileExtension(name, fileType);
  if (ext === "pdf") return "#1a0505";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "img"].includes(ext)) {
    return "#1a1500";
  }
  if (["doc", "docx", "txt", "rtf"].includes(ext)) return "#0a0a1a";
  if (["xls", "xlsx", "csv"].includes(ext)) return "#0a1a0a";
  return "#1a1a1a";
}

function FileTypeIcon({
  name,
  fileType,
}: {
  name: string;
  fileType?: string | null;
}) {
  const color = fileIconColor(name, fileType);
  return (
    <svg
      width={28}
      height={28}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
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
}: {
  link: ResourceLink;
  canManage: boolean;
  onDelete: (link: ResourceLink) => void;
  deleting: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  function openLink() {
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openLink}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLink();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "8px 0",
        borderBottom: "1px solid #1e1e1e",
        color: "#cccccc",
        fontSize: "13px",
        cursor: "pointer",
      }}
    >
      <Globe size={14} color="#E51937" aria-hidden />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "#ffffff",
            margin: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {link.title}
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "#555555",
            margin: "2px 0 0",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {domainFromUrl(link.url)}
        </p>
      </div>
      {canManage && hovered ? (
        <button
          type="button"
          aria-label={`Delete ${link.title}`}
          disabled={deleting}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(link);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#E51937",
            cursor: deleting ? "not-allowed" : "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
}

function CategoryPills({
  value,
  onChange,
  includeAll = false,
}: {
  value: string;
  onChange: (value: string) => void;
  includeAll?: boolean;
}) {
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const options = includeAll
    ? [{ value: "all", label: "All" }, ...DOCUMENT_CATEGORIES]
    : DOCUMENT_CATEGORIES;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
      {options.map((option) => {
        const selected = value === option.value;
        const hovered = hoveredValue === option.value;
        return (
          <button
            key={option.value}
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
        );
      })}
    </div>
  );
}

const docActionButtonStyle = (
  hovered: boolean,
): CSSProperties => ({
  background: "#1f1f1f",
  border: `1px solid ${hovered ? "#E51937" : "#2a2a2a"}`,
  color: hovered ? "#E51937" : "#cccccc",
  borderRadius: "6px",
  padding: "5px 14px",
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
  onPreview,
  onDownload,
}: {
  doc: ClubDocument;
  isPrivileged: boolean;
  deleting: boolean;
  onDelete: (doc: ClubDocument) => void;
  onEdit: (doc: ClubDocument) => void;
  onPreview: (doc: ClubDocument) => void;
  onDownload: (doc: ClubDocument) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadHovered, setDownloadHovered] = useState(false);
  const [previewHovered, setPreviewHovered] = useState(false);
  const previewKind = previewKindForDocument(doc);

  const iconBg = fileIconBackground(doc.name, doc.file_type);

  return (
    <div
      onClick={() => setMenuOpen(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      style={{
        background: "#1a1a1a",
        border: `1px solid ${hovered ? "#333333" : "#242424"}`,
        borderRadius: "10px",
        overflow: "hidden",
        transition: "border-color 0.15s ease, transform 0.15s ease",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
      }}
    >
      <Box
        style={{
          padding: "16px",
          display: "flex",
          gap: "12px",
          alignItems: "flex-start",
        }}
      >
        <Box
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "8px",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: iconBg,
          }}
        >
          <FileTypeIcon name={doc.name} fileType={doc.file_type} />
        </Box>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              margin: "0 0 4px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {doc.name}
          </p>
          {doc.description ? (
            <p
              style={{
                fontSize: "12px",
                color: "#555555",
                margin: "0 0 8px",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {doc.description}
            </p>
          ) : null}
          <span style={categoryBadgeStyle()}>{categoryLabel(doc.category)}</span>
        </Box>
      </Box>

      <Box
        style={{
          background: "#141414",
          borderTop: "1px solid #1e1e1e",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
        }}
      >
        <p style={{ fontSize: "11px", color: "#555555", margin: 0 }}>
          {formatFileSize(doc.file_size)} ·{" "}
          {new Date(doc.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <Box style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
          {isPrivileged && hovered ? (
            <Box style={{ position: "relative" }}>
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
                <Box
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
                    disabled={deleting}
                    onClick={(e) => {
                      e.stopPropagation();
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
                </Box>
              ) : null}
            </Box>
          ) : null}
        </Box>
      </Box>
    </div>
  );
}

export default function ClubDocumentsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const { user } = useAuthContext();

  const [userRole, setUserRole] = useState<MemberRole>("member");
  const isPrivileged = userRole === "owner" || userRole === "executive";

  const [documents, setDocuments] = useState<ClubDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docDescription, setDocDescription] = useState("");
  const [uploadCategory, setUploadCategory] =
    useState<DocumentCategory>("general");
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

  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [showAddLinkModal, setShowAddLinkModal] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkDescription, setLinkDescription] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

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
    if (filterCategory === "all") return documents;
    return documents.filter((doc) => doc.category === filterCategory);
  }, [documents, filterCategory]);

  function resetUploadForm() {
    setSelectedFile(null);
    setDocName("");
    setDocDescription("");
    setUploadCategory("general");
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
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "16px",
  };

  return (
    <div
      className="p-6"
      style={{ backgroundColor: "#0f0f0f", minHeight: "100%" }}
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
              fontWeight: 700,
              fontSize: "22px",
              color: "#ffffff",
              margin: 0,
            }}
          >
            Documents
          </h1>
          <p style={{ fontSize: "13px", color: "#555555", margin: "4px 0 0" }}>
            Club files and resources
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
                ? "1px solid #1a4a1a"
                : "1px solid #3a1a1a",
            background: feedback.type === "success" ? "#0d2b0d" : "#1a0505",
            color: feedback.type === "success" ? "#4ade80" : "#E51937",
          }}
        >
          {feedback.text}
        </div>
      ) : null}

      <Box style={{ marginBottom: "20px" }}>
        <CategoryPills
          value={filterCategory}
          onChange={setFilterCategory}
          includeAll
        />
      </Box>

      <Box
        style={{
          marginTop: "4px",
          marginBottom: "28px",
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "10px",
          padding: "20px",
        }}
      >
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <h2
            style={{
              fontWeight: 600,
              fontSize: "15px",
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
                border: "1px solid #333333",
                color: "#777777",
                borderRadius: "6px",
                padding: "7px 14px",
                fontSize: "12px",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#E51937";
                e.currentTarget.style.color = "#E51937";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#333333";
                e.currentTarget.style.color = "#777777";
              }}
            >
              + Add Link
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
            {resourceLinks.map((link) => (
              <ResourceLinkRow
                key={link.id}
                link={link}
                canManage={isPrivileged}
                deleting={deletingLinkId === link.id}
                onDelete={(item) => void handleDeleteLink(item)}
              />
            ))}
          </Box>
        )}
      </Box>

      {loading ? (
        <div style={gridStyle}>
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filteredDocuments.length === 0 ? (
        <Box style={{ textAlign: "center", padding: "64px 24px" }}>
          <Box
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "16px",
            }}
          >
            <FileText size={32} color="#333333" />
          </Box>
          <p style={{ fontSize: "14px", color: "#555555", margin: "0 0 8px" }}>
            No documents yet
          </p>
          {isPrivileged ? (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "#E51937",
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Upload your first document →
            </button>
          ) : null}
        </Box>
      ) : (
        <div style={gridStyle}>
          {filteredDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              isPrivileged={isPrivileged}
              deleting={deletingId === doc.id}
              onDelete={(item) => void handleDelete(item)}
              onEdit={openEditDocument}
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
              onChange={(v) => setUploadCategory(v as DocumentCategory)}
            />

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
    </div>
  );
}
