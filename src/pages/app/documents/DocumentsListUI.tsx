import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ChevronDown,
  File,
  FileText,
  Globe,
  Grid3x3,
  Image as ImageIcon,
  Lightbulb,
  Monitor,
  MoreHorizontal,
  Plus,
} from "lucide-react";

const ACCENT_RED = "#E51937";
const GOLD = "#FFC429";
const CARD_BG = "#141414";
const CARD_BORDER = "#2a2a2a";

export type SortOption =
  | "recently_updated"
  | "newest"
  | "oldest"
  | "name_az"
  | "file_size";

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recently_updated", label: "Recently Updated" },
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name_az", label: "Name A-Z" },
  { value: "file_size", label: "File Size" },
];

type FileTypeKind = "pdf" | "image" | "spreadsheet" | "presentation" | "document" | "other";

export interface DocumentListItem {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  created_at: string;
  uploaderName?: string;
}

export interface ResourceLinkItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  added_by?: string | null;
  created_at?: string;
  addedByName?: string;
}

export type CategoryOption = { value: string; label: string };

function getFileExtension(name: string, fileType?: string | null): string {
  const fromName = name.split(".").pop()?.toLowerCase() ?? "";
  if (fromName && fromName !== name.toLowerCase()) return fromName;
  if (fileType?.includes("pdf")) return "pdf";
  if (fileType?.startsWith("image/")) return "img";
  return fromName || "file";
}

function getFileTypeKind(name: string, fileType?: string | null): FileTypeKind {
  const ext = getFileExtension(name, fileType);
  if (ext === "pdf" || fileType?.includes("pdf")) return "pdf";
  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "img"].includes(ext) ||
    fileType?.startsWith("image/")
  ) {
    return "image";
  }
  if (["xlsx", "xls", "csv"].includes(ext)) return "spreadsheet";
  if (["pptx", "ppt"].includes(ext)) return "presentation";
  if (["docx", "doc"].includes(ext)) return "document";
  return "other";
}

export function fileTypeColor(kind: FileTypeKind): string {
  switch (kind) {
    case "pdf":
      return ACCENT_RED;
    case "image":
      return "#3B82F6";
    case "spreadsheet":
      return "#22C55E";
    case "presentation":
      return "#F97316";
    case "document":
      return "#3B82F6";
    default:
      return "#555555";
  }
}

export function fileTypeLabel(name: string, fileType?: string | null): string {
  const kind = getFileTypeKind(name, fileType);
  if (kind === "image") return "IMG";
  if (kind === "spreadsheet") {
    const ext = getFileExtension(name, fileType);
    return ext === "csv" ? "CSV" : "XLSX";
  }
  if (kind === "presentation") return "PPTX";
  if (kind === "document") return "DOCX";
  if (kind === "pdf") return "PDF";
  const ext = getFileExtension(name, fileType);
  if (!ext || ext === "file") return "FILE";
  return ext.toUpperCase();
}

function isThumbnailImage(doc: DocumentListItem): boolean {
  const ext = getFileExtension(doc.name, doc.file_type);
  return (
    Boolean(doc.file_url) &&
    ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)
  );
}

export function previewKindForDocument(
  doc: DocumentListItem,
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

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function sortDocuments(
  docs: DocumentListItem[],
  sortBy: SortOption,
): DocumentListItem[] {
  const sorted = [...docs];
  switch (sortBy) {
    case "oldest":
      sorted.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      break;
    case "name_az":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "file_size":
      sorted.sort((a, b) => (b.file_size ?? 0) - (a.file_size ?? 0));
      break;
    case "newest":
    case "recently_updated":
    default:
      sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      break;
  }
  return sorted;
}

type ServiceKind =
  | "google_drive"
  | "google_docs"
  | "linkedin"
  | "instagram"
  | "github"
  | "other";

function linkTypeLabel(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("drive.google.com")) return "Drive";
  if (lower.includes("forms.google.com")) return "Form";
  if (lower.includes("docs.google.com") || lower.includes("sheets.google.com")) {
    return "Resource";
  }
  if (
    lower.includes("linkedin.com") ||
    lower.includes("instagram.com") ||
    lower.includes("twitter.com") ||
    lower.includes("x.com") ||
    lower.includes("facebook.com") ||
    lower.includes("tiktok.com")
  ) {
    return "Social Link";
  }
  return "Website";
}

function linkTypeBadgeStyle(label: string): CSSProperties {
  const styles: Record<string, CSSProperties> = {
    Drive: { background: "rgba(15,157,88,0.12)", border: "1px solid #0F9D58", color: "#4ade80" },
    Form: { background: "rgba(255,196,41,0.12)", border: "1px solid #FFC429", color: "#FFC429" },
    Resource: { background: "rgba(59,130,246,0.12)", border: "1px solid #3B82F6", color: "#93c5fd" },
    "Social Link": { background: "#1a1a1a", border: "1px solid #555555", color: "#999999" },
    Website: { background: "#1a1a1a", border: "1px solid #444444", color: "#777777" },
  };
  return {
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "10px",
    fontWeight: 600,
    display: "inline-block",
    ...(styles[label] ?? styles.Website),
  };
}

export function linkDisplayLabel(url: string): string {
  try {
    const normalized = url.trim().match(/^https?:\/\//i) ? url.trim() : `https://${url.trim()}`;
    const parsed = new URL(normalized);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

    if (host === "drive.google.com") return "Google Drive link";
    if (host === "docs.google.com") return "Google Docs link";
    if (host === "sheets.google.com") return "Google Sheets link";
    if (host === "forms.google.com") return "Google Form link";

    return host;
  } catch {
    return "External link";
  }
}

function formatLinkDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function detectService(url: string): ServiceKind {
  const lower = url.toLowerCase();
  if (lower.includes("drive.google.com")) return "google_drive";
  if (lower.includes("docs.google.com")) return "google_docs";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("github.com")) return "github";
  return "other";
}

function ServiceIcon({ url }: { url: string }) {
  const service = detectService(url);
  const base: CSSProperties = {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: "14px",
    fontWeight: 700,
  };

  switch (service) {
    case "google_drive":
      return (
        <div style={{ ...base, background: "#0F9D58", color: "#ffffff" }} aria-hidden>
          D
        </div>
      );
    case "google_docs":
      return (
        <div style={{ ...base, background: "#4285F4", color: "#ffffff" }} aria-hidden>
          <FileText size={18} color="#ffffff" />
        </div>
      );
    case "linkedin":
      return (
        <div style={{ ...base, background: "#0A66C2", color: "#ffffff" }} aria-hidden>
          in
        </div>
      );
    case "instagram":
      return (
        <div
          style={{
            ...base,
            background: "linear-gradient(135deg, #F58529, #DD2A7B, #8134AF)",
            color: "#ffffff",
          }}
          aria-hidden
        >
          <ImageIcon size={16} color="#ffffff" />
        </div>
      );
    case "github":
      return (
        <div style={{ ...base, background: "#24292f", color: "#ffffff" }} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.395-.135-.345-.72-1.41-1.23-1.935l-.42-.405c-.42-.405-.315-.54.105-.87.42-.33.915-.03 1.125.165.315.285 1.26.945 1.545 1.14.285.195.57.12.705-.075.135-.195.12-.57-.03-.885-.15-.315-.42-.495-.78-.645-.27-.12-1.08-.33-1.965-1.05-.72-.645-1.215-1.44-1.35-2.67-.12-1.125.405-1.695.75-1.995-.21-.6-.45-1.17-.45-2.37 0-.54.18-1.05.495-1.485-.045-.12-.21-.6.045-1.245 0 0 .405-.135 1.32.51.39-.105.81-.165 1.215-.165.405 0 .825.06 1.215.165.915-.66 1.32-.51 1.32-.51.255.645.09 1.125.045 1.245.315.435.495.945.495 1.485 0 1.215-.24 1.785-.465 2.385.345.3.87.87.87 2.01 0 1.455-.015 2.625-.015 2.985 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
        </div>
      );
    default:
      return (
        <div style={{ ...base, background: "#1a1a1a", border: `1px solid ${CARD_BORDER}` }} aria-hidden>
          <Globe size={18} color="#555555" />
        </div>
      );
  }
}

export function FileTypeIcon({
  name,
  fileType,
  size = 40,
}: {
  name: string;
  fileType?: string | null;
  size?: number;
}) {
  const kind = getFileTypeKind(name, fileType);
  const color = fileTypeColor(kind);
  const iconSize = size <= 40 ? 18 : size <= 56 ? 26 : 20;
  const pdfFontSize = size <= 40 ? "11px" : "13px";

  let content: ReactNode;
  if (kind === "pdf") {
    content = (
      <span style={{ fontSize: pdfFontSize, fontWeight: 800, color: "#ffffff", letterSpacing: "0.02em" }}>
        PDF
      </span>
    );
  } else if (kind === "image") {
    content = <ImageIcon size={iconSize} color="#ffffff" aria-hidden />;
  } else if (kind === "spreadsheet") {
    content = <Grid3x3 size={iconSize} color="#ffffff" aria-hidden />;
  } else if (kind === "presentation") {
    content = <Monitor size={iconSize} color="#ffffff" aria-hidden />;
  } else if (kind === "document") {
    content = <FileText size={iconSize} color="#ffffff" aria-hidden />;
  } else {
    content = <File size={iconSize} color="#ffffff" aria-hidden />;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "8px",
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      {content}
    </div>
  );
}

function categoryBadgeStyle(): CSSProperties {
  return {
    background: "#1a1a1a",
    border: `1px solid ${CARD_BORDER}`,
    color: "#999999",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    display: "inline-block",
  };
}

function fileTypePillStyle(color: string): CSSProperties {
  return {
    background: `${color}26`,
    border: `1px solid ${color}40`,
    color,
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 600,
    display: "inline-block",
  };
}

const docActionButtonStyle = (hovered: boolean, half = false): CSSProperties => ({
  flex: half ? "1 1 50%" : undefined,
  width: half ? "50%" : undefined,
  background: "transparent",
  border: `1px solid ${hovered ? ACCENT_RED : CARD_BORDER}`,
  color: hovered ? ACCENT_RED : "#777777",
  borderRadius: "6px",
  padding: "8px 14px",
  fontSize: "12px",
  cursor: "pointer",
  transition: "border-color 0.15s ease, color 0.15s ease",
});

export function DocumentCard({
  doc,
  isPrivileged,
  deleting,
  onDelete,
  onEdit,
  onMoveCategory,
  onPreview,
  onDownload,
  categoryName,
}: {
  doc: DocumentListItem;
  isPrivileged: boolean;
  deleting: boolean;
  onDelete: (doc: DocumentListItem) => void;
  onEdit: (doc: DocumentListItem) => void;
  onMoveCategory: (doc: DocumentListItem) => void;
  onPreview: (doc: DocumentListItem) => void;
  onDownload: (doc: DocumentListItem) => void;
  categoryName: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloadHovered, setDownloadHovered] = useState(false);
  const [previewHovered, setPreviewHovered] = useState(false);
  const previewKind = previewKindForDocument(doc);
  const showThumbnail = isThumbnailImage(doc);
  const typeKind = getFileTypeKind(doc.name, doc.file_type);
  const typeColor = fileTypeColor(typeKind);
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
        background: CARD_BG,
        border: `1px solid ${hovered ? "#333333" : CARD_BORDER}`,
        borderRadius: "10px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.15s ease",
      }}
    >
      {isPrivileged ? (
        <div style={{ position: "absolute", top: "12px", right: "12px", zIndex: 2 }}>
          <button
            type="button"
            aria-label="Document actions"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            style={{
              background: showThumbnail ? "rgba(0,0,0,0.5)" : "transparent",
              border: "none",
              color: showThumbnail ? "#ffffff" : "#777777",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              padding: "4px",
              borderRadius: "4px",
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
                border: `1px solid ${CARD_BORDER}`,
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
                  color: ACCENT_RED,
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

      {showThumbnail ? (
        <img
          src={doc.file_url}
          alt=""
          style={{
            width: "100%",
            height: "120px",
            objectFit: "cover",
            borderRadius: "8px 8px 0 0",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            height: "120px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            background: `${typeColor}14`,
            borderBottom: `1px solid ${CARD_BORDER}`,
          }}
        >
          <FileTypeIcon name={doc.name} fileType={doc.file_type} size={56} />
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: typeColor,
              letterSpacing: "0.04em",
            }}
          >
            {fileTypeLabel(doc.name, doc.file_type)}
          </span>
        </div>
      )}

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#ffffff",
            margin: 0,
            lineHeight: 1.3,
            paddingRight: isPrivileged ? "24px" : 0,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {doc.name}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span style={fileTypePillStyle(typeColor)}>
            {fileTypeLabel(doc.name, doc.file_type)}
          </span>
          <span style={categoryBadgeStyle()}>{categoryName}</span>
        </div>

        <p style={{ fontSize: "11px", color: "#555555", margin: 0 }}>
          Uploaded by {doc.uploaderName ?? "Unknown"} · {formattedDate} ·{" "}
          {formatFileSize(doc.file_size)}
        </p>

        <p
          style={{
            fontSize: "12px",
            color: doc.description?.trim() ? "#777777" : "#555555",
            margin: 0,
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {doc.description?.trim() || "No description added yet."}
        </p>

        <div style={{ display: "flex", gap: "8px", marginTop: "auto", paddingTop: "4px" }}>
          {previewKind ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPreview(doc);
              }}
              onMouseEnter={() => setPreviewHovered(true)}
              onMouseLeave={() => setPreviewHovered(false)}
              style={docActionButtonStyle(previewHovered, true)}
            >
              Preview
            </button>
          ) : (
            <button
              type="button"
              disabled
              style={{
                ...docActionButtonStyle(false, true),
                opacity: 0.35,
                cursor: "not-allowed",
              }}
            >
              Preview
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void onDownload(doc);
            }}
            onMouseEnter={() => setDownloadHovered(true)}
            onMouseLeave={() => setDownloadHovered(false)}
            style={docActionButtonStyle(downloadHovered, true)}
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
}

export function ResourceLinkRow({
  link,
  canManage,
  onDelete,
  deleting,
  isLast,
}: {
  link: ResourceLinkItem;
  canManage: boolean;
  onDelete: (link: ResourceLinkItem) => void;
  deleting: boolean;
  isLast: boolean;
}) {
  const [openHovered, setOpenHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const typeLabel = linkTypeLabel(link.url);
  const displayUrl = linkDisplayLabel(link.url);
  const addedDate = formatLinkDate(link.created_at);
  const metaParts: string[] = [];
  if (link.addedByName) metaParts.push(`Added by ${link.addedByName}`);
  if (addedDate) metaParts.push(`Added ${addedDate}`);

  function openLink() {
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "14px",
        padding: "14px 0",
        borderBottom: isLast ? "none" : `1px solid #1a1a1a`,
      }}
    >
      <ServiceIcon url={link.url} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "8px",
            marginBottom: "4px",
          }}
        >
          <p
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              minWidth: 0,
              flex: "1 1 auto",
            }}
          >
            {link.title}
          </p>
          <span style={linkTypeBadgeStyle(typeLabel)}>{typeLabel}</span>
        </div>
        <p
          style={{
            fontSize: "12px",
            color: link.description?.trim() ? "#777777" : "#555555",
            margin: "0 0 4px",
            lineHeight: 1.45,
          }}
        >
          {link.description?.trim() || "No description added yet."}
        </p>
        <p
          style={{
            fontSize: "12px",
            color: "#555555",
            margin: "0 0 2px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayUrl}
        </p>
        {metaParts.length > 0 ? (
          <p style={{ fontSize: "11px", color: "#444444", margin: 0 }}>{metaParts.join(" · ")}</p>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        <button
          type="button"
          onClick={openLink}
          onMouseEnter={() => setOpenHovered(true)}
          onMouseLeave={() => setOpenHovered(false)}
          style={{
            background: "transparent",
            border: `1px solid ${openHovered ? ACCENT_RED : CARD_BORDER}`,
            color: openHovered ? ACCENT_RED : "#777777",
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
                  border: `1px solid ${CARD_BORDER}`,
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
                    color: ACCENT_RED,
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

export function SortDropdown({
  value,
  onChange,
}: {
  value: SortOption;
  onChange: (value: SortOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Recently Updated";

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          height: "44px",
          background: "#111111",
          border: `1px solid ${open ? ACCENT_RED : CARD_BORDER}`,
          borderRadius: "8px",
          padding: "0 12px",
          fontSize: "13px",
          color: "#cccccc",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {current}
        <ChevronDown size={14} color="#777777" aria-hidden />
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 4px)",
            minWidth: "180px",
            background: "#151515",
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: "8px",
            overflow: "hidden",
            zIndex: 20,
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              style={{
                width: "100%",
                background: value === option.value ? "#1f1f1f" : "transparent",
                border: "none",
                textAlign: "left",
                color: value === option.value ? "#ffffff" : "#999999",
                fontSize: "13px",
                padding: "10px 12px",
                cursor: "pointer",
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DocumentsTipBar() {
  return (
    <div
      style={{
        marginTop: "32px",
        background: CARD_BG,
        border: `1px solid ${CARD_BORDER}`,
        borderRadius: "8px",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
      }}
    >
      <Lightbulb size={16} color={GOLD} aria-hidden style={{ flexShrink: 0 }} />
      <p style={{ flex: 1, margin: 0, fontSize: "13px", color: "#777777", minWidth: 0 }}>
        Tip: Add documents to the right category to help members find them faster.
      </p>
    </div>
  );
}

export function ResourceLinksEmptyState({ onAddLink }: { onAddLink: () => void }) {
  return (
    <div style={{ padding: "20px 0 8px", textAlign: "center" }}>
      <p style={{ fontSize: "13px", color: "#555555", margin: "0 0 8px" }}>
        No resource links added yet.
      </p>
      <p style={{ fontSize: "12px", color: "#444444", margin: "0 0 12px" }}>
        Upload a file or add a link to get started.
      </p>
      <button
        type="button"
        onClick={onAddLink}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "transparent",
          border: `1px solid ${CARD_BORDER}`,
          color: "#cccccc",
          borderRadius: "6px",
          padding: "8px 14px",
          fontSize: "12px",
          cursor: "pointer",
        }}
      >
        <Plus size={14} aria-hidden />
        Add Link
      </button>
    </div>
  );
}

export function UploadedFilesEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <File size={36} color="#555555" aria-hidden style={{ margin: "0 auto 12px", display: "block" }} />
      <p style={{ fontSize: "14px", color: "#555555", margin: "0 0 8px" }}>
        No files uploaded yet.
      </p>
      <p style={{ fontSize: "12px", color: "#444444", margin: "0 0 12px" }}>
        Upload a file or add a link to get started.
      </p>
      <button
        type="button"
        onClick={onUpload}
        style={{
          background: "transparent",
          border: "none",
          color: ACCENT_RED,
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        Upload File
      </button>
    </div>
  );
}
