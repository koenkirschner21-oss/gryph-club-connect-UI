import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { FileText, Plus, Search, X } from "lucide-react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuthContext } from "../../context/useAuthContext";
import { useIsMobile } from "../../hooks/useWindowWidth";
import { supabase } from "../../lib/supabaseClient";
import { useClubMemberAccess } from "../../hooks/useClubMemberAccess";
import { isExecutiveAccessLevel } from "../../lib/clubPermissions";
import {
  filterByVisibility,
  canViewContent,
  normalizeVisibility,
  toStandardVisibility,
} from "../../lib/contentVisibility";
import { notifyNewDocumentUploaded } from "../../lib/notifications";
import type { AccessLevel, Visibility } from "../../types";
import ContentVisibilityDropdown from "../../components/club/ContentVisibilityDropdown";
import {
  normalizeAccessLevelArray,
  normalizeUuidArray,
} from "../../lib/selectedVisibility";
import {
  AddContentDropdown,
  CategoryFilterDropdown,
  DocumentCard,
  DocumentsTipBar,
  RecentFilesRow,
  ResourceLinkRow,
  ResourceLinksEmptyState,
  SortDropdown,
  UploadedFilesEmptyState,
  previewKindForDocument,
  sortDocuments,
  type AddContentAction,
  type SortOption,
} from "./documents/DocumentsListUI";
import {
  CLUB_DOCUMENTS_BUCKET,
  downloadClubDocumentsFile,
  resolveClubDocumentsAccessUrl,
  storagePathFromClubDocumentsReference,
} from "../../lib/clubDocumentsStorage";

const STORAGE_BUCKET = CLUB_DOCUMENTS_BUCKET;
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
  visibility_roles?: unknown;
  visibility_user_ids?: unknown;
  visibilityRoles?: AccessLevel[];
  visibilityUserIds?: string[];
  uploaderName?: string;
  access_url?: string | null;
}

interface ResourceLink {
  id: string;
  club_id: string;
  title: string;
  url: string;
  description: string | null;
  added_by: string | null;
  created_at: string;
  addedByName?: string;
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

function categoryEmptySubtext(category: string): string {
  const messages: Record<string, string> = {
    finance: "Upload budgets, receipts, or funding forms here.",
    meeting_notes: "Upload meeting agendas, minutes, and summaries here.",
    legal: "Upload constitutions, policies, or legal documents here.",
  };
  return messages[category] ?? "No files in this category yet.";
}

async function downloadClubDocument(
  doc: ClubDocument,
): Promise<boolean> {
  return downloadClubDocumentsFile(supabase, doc.file_url, doc.name);
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
            New Category
          </span>
        </button>
      ) : null}
    </div>
  );
}

export default function ClubDocumentsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { user } = useAuthContext();

  const memberAccess = useClubMemberAccess(clubId);
  const canManageDocuments =
    memberAccess.isPresident || memberAccess.can("manage_documents");
  const isExecutiveForVisibility = isExecutiveAccessLevel(
    memberAccess.accessLevel,
    memberAccess.role,
  );
  const isMember = memberAccess.hasMembership;
  const isPrivileged = canManageDocuments;

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
  const [previewAccessUrl, setPreviewAccessUrl] = useState<string | null>(null);
  const [editingDocument, setEditingDocument] = useState<ClubDocument | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editDocVisibility, setEditDocVisibility] =
    useState<Visibility>("members_only");
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
  const [sortBy, setSortBy] = useState<SortOption>("recently_updated");
  const [showAllFiles, setShowAllFiles] = useState(false);

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
      const rows = (data ?? []) as ResourceLink[];
      const adderIds = [
        ...new Set(rows.map((row) => row.added_by).filter(Boolean)),
      ] as string[];

      let profileMap: Record<string, string> = {};
      if (adderIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", adderIds);
        profileMap = Object.fromEntries(
          (profiles ?? []).map((p) => [
            p.id as string,
            (p.full_name as string) ?? "Unknown",
          ]),
        );
      }

      setResourceLinks(
        rows.map((row) => ({
          ...row,
          addedByName: row.added_by
            ? profileMap[row.added_by] ?? "Unknown"
            : undefined,
        })),
      );
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
      await Promise.all(
        rows.map(async (row) => {
          const accessUrl = await resolveClubDocumentsAccessUrl(
            supabase,
            row.file_url,
          );
          return {
            ...row,
            visibility: normalizeVisibility(row.visibility, "members_only"),
            visibilityRoles: normalizeAccessLevelArray(row.visibility_roles),
            visibilityUserIds: normalizeUuidArray(row.visibility_user_ids),
            uploaderName: row.uploaded_by
              ? profileMap[row.uploaded_by] ?? "Unknown"
              : "Unknown",
            access_url: accessUrl,
          };
        }),
      ),
    );
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!previewDoc) {
      setPreviewAccessUrl(null);
      return;
    }

    let cancelled = false;
    void resolveClubDocumentsAccessUrl(supabase, previewDoc.file_url).then((url) => {
      if (!cancelled) setPreviewAccessUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [previewDoc]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const filteredDocuments = useMemo(() => {
    let result = filterByVisibility(documents, {
      isMember,
      isPrivileged: isExecutiveForVisibility,
      userId: user?.id,
      accessLevel: memberAccess.accessLevel,
      role: memberAccess.role,
    });
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
  }, [
    documents,
    filterCategory,
    searchQuery,
    allCategories,
    isMember,
    isExecutiveForVisibility,
    user?.id,
    memberAccess.accessLevel,
    memberAccess.role,
  ]);

  const sortedDocuments = useMemo(
    () => sortDocuments(filteredDocuments, sortBy),
    [filteredDocuments, sortBy],
  );

  const filteredResourceLinks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return resourceLinks;
    return resourceLinks.filter((link) => {
      return (
        link.title.toLowerCase().includes(query) ||
        link.url.toLowerCase().includes(query) ||
        (link.description?.toLowerCase().includes(query) ?? false) ||
        (link.addedByName?.toLowerCase().includes(query) ?? false)
      );
    });
  }, [resourceLinks, searchQuery]);

  const displayedDocuments = useMemo(() => {
    if (showAllFiles || sortedDocuments.length <= 6) return sortedDocuments;
    return sortedDocuments.slice(0, 6);
  }, [sortedDocuments, showAllFiles]);

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

  useEffect(() => {
    if (!isPrivileged) return;
    const openUpload = searchParams.get("openUpload") === "true";
    const openAddLink = searchParams.get("openAddLink") === "true";
    if (!openUpload && !openAddLink) return;
    if (openUpload) setShowUploadModal(true);
    if (openAddLink) setShowAddLinkModal(true);
    const next = new URLSearchParams(searchParams);
    next.delete("openUpload");
    next.delete("openAddLink");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, isPrivileged]);

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
    setUploadProgress(100);
    return path;
  }

  function storagePathFromUrl(url: string): string | null {
    return storagePathFromClubDocumentsReference(url);
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

    const documentId = crypto.randomUUID();
    const { error } = await supabase
      .from("club_documents")
      .insert({
        id: documentId,
        club_id: clubId,
        uploaded_by: user.id,
        name: docName.trim(),
        description: docDescription.trim() || null,
        file_url: fileUrl,
        file_type: selectedFile.type || null,
        file_size: selectedFile.size,
        category: uploadCategory,
        visibility: uploadVisibility,
        visibility_roles: [],
        visibility_user_ids: [],
      });

    setUploading(false);

    if (error) {
      console.error("Failed to save document:", error?.message);
      setFeedback({ type: "error", text: "Failed to save document record." });
      return;
    }

    void notifyNewDocumentUploaded(supabase, {
      clubId,
      documentId,
      documentName: docName.trim(),
      visibility: uploadVisibility,
      visibilityRoles: [],
      visibilityUserIds: [],
      uploadedByUserId: user.id,
    });

    setFeedback({ type: "success", text: "Document uploaded." });
    closeUploadModal();
    void loadDocuments();
  }

  async function handleDownloadDocument(doc: ClubDocument) {
    setFeedback(null);
    const allowed = canViewContent(
      doc.visibility,
      {
        isMember,
        isPrivileged: isExecutiveForVisibility,
        userId: user?.id,
        accessLevel: memberAccess.accessLevel,
        role: memberAccess.role,
      },
      {
        visibilityRoles: doc.visibilityRoles,
        visibilityUserIds: doc.visibilityUserIds,
      },
    );
    if (!allowed) {
      setFeedback({
        type: "error",
        text: "You do not have access to this document.",
      });
      return;
    }
    const ok = await downloadClubDocument(doc);
    if (!ok) {
      setFeedback({ type: "error", text: "Failed to download document." });
    }
  }

  function openEditDocument(doc: ClubDocument) {
    setEditingDocument(doc);
    setEditDocName(doc.name);
    // Legacy "selected" visibility is normalized to Members Only since the
    // picker for choosing specific roles/members has been removed.
    setEditDocVisibility(toStandardVisibility(doc.visibility, "members_only"));
  }

  function closeEditModal() {
    if (savingEdit) return;
    setEditingDocument(null);
    setEditDocName("");
    setEditDocVisibility("members_only");
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
      .update({
        name: editDocName.trim(),
        visibility: editDocVisibility,
        visibility_roles: [],
        visibility_user_ids: [],
      })
      .eq("id", editingDocument.id);

    setSavingEdit(false);

    if (error) {
      console.error("Failed to rename document:", error.message);
      setFeedback({ type: "error", text: "Failed to rename document." });
      return;
    }

    setFeedback({ type: "success", text: "Document updated." });
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
    gridTemplateColumns: isMobile
      ? "1fr"
      : "repeat(auto-fill, minmax(240px, 1fr))",
    gap: "12px",
    maxWidth: "1100px",
  };

  const recentDocuments = useMemo(() => {
    if (searchActive || categoryFiltered) return [];
    return sortedDocuments.slice(0, 4);
  }, [sortedDocuments, searchActive, categoryFiltered]);

  const addContentActions: AddContentAction[] = isPrivileged
    ? [
        {
          id: "upload_file",
          label: "Upload File",
          onClick: () => setShowUploadModal(true),
        },
        {
          id: "add_link",
          label: "Add Resource Link",
          onClick: () => setShowAddLinkModal(true),
        },
        {
          id: "create_category",
          label: "Create Category",
          onClick: () => setShowCreateCategoryModal(true),
        },
      ]
    : [];

  function handleDocumentPreview(doc: ClubDocument) {
    const allowed = canViewContent(
      doc.visibility,
      {
        isMember,
        isPrivileged: isExecutiveForVisibility,
        userId: user?.id,
        accessLevel: memberAccess.accessLevel,
        role: memberAccess.role,
      },
      {
        visibilityRoles: doc.visibilityRoles,
        visibilityUserIds: doc.visibilityUserIds,
      },
    );
    if (!allowed) {
      setFeedback({
        type: "error",
        text: "You do not have access to this document.",
      });
      return;
    }
    setPreviewDoc(doc);
  }

  return (
    <div
      style={{
        backgroundColor: "#0f0f0f",
        minHeight: "100%",
        padding: isMobile ? "16px" : "24px",
      }}
    >
      <div style={{ maxWidth: "1100px" }}>
      <Box
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "16px",
          marginBottom: "20px",
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
          <p style={{ fontSize: "14px", color: "#777777", marginTop: "4px", marginBottom: 0 }}>
            Club files and resource links in one library. Organized by category.
          </p>
          <p style={{ fontSize: "12px", color: "#555555", marginTop: "4px", marginBottom: 0 }}>
            {documents.length} {documents.length === 1 ? "file" : "files"} ·{" "}
            {resourceLinks.length} {resourceLinks.length === 1 ? "link" : "links"}
          </p>
        </Box>
        {isPrivileged ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              style={{
                background: "#E51937",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Upload File
            </button>
            <button
              type="button"
              onClick={() => setShowAddLinkModal(true)}
              style={{
                background: "transparent",
                color: "#cccccc",
                border: "1px solid #333333",
                borderRadius: "6px",
                padding: "8px 14px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add Resource Link
            </button>
            <AddContentDropdown actions={addContentActions} />
          </div>
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

      {/* 1. Search and filters */}
      <section aria-label="Search and filters" style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: isMobile ? "wrap" : "nowrap",
          }}
        >
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
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
              placeholder="Search files, links, categories, and descriptions…"
              aria-label="Search documents"
              style={{
                width: "100%",
                height: "48px",
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
          <SortDropdown value={sortBy} onChange={setSortBy} />
        </div>
      </section>

      {/* 2. Categories */}
      <section aria-label="Categories" style={{ marginBottom: "24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "10px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
              Categories
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666666" }}>
              Filter the file library by topic. Categories group files — they are not separate folders.
            </p>
          </div>
          {isPrivileged ? (
            <button
              type="button"
              onClick={() => setShowCreateCategoryModal(true)}
              style={{
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: "#cccccc",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Create Category
            </button>
          ) : null}
        </div>
        <CategoryFilterDropdown
          value={filterCategory}
          onChange={setFilterCategory}
          categories={allCategories}
        />
      </section>

      {/* 3. Recent files */}
      {!loading && recentDocuments.length > 0 ? (
        <section aria-label="Recent files" style={{ marginBottom: "24px" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
            Recent Files
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#666666" }}>
            Newest uploads across all categories
          </p>
          <RecentFilesRow
            docs={recentDocuments}
            categoryNameFor={(value) => categoryLabel(value, allCategories)}
            onPreview={(item) => handleDocumentPreview(item as ClubDocument)}
            onDownload={(item) => void handleDownloadDocument(item as ClubDocument)}
          />
        </section>
      ) : null}

      {/* 4. Uploaded files */}
      <section aria-label="Uploaded files" style={{ marginBottom: "28px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>
              Uploaded Files
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666666" }}>
              {filteredDocuments.length}{" "}
              {filteredDocuments.length === 1 ? "file matches" : "files match"} current filters
            </p>
          </div>
          {sortedDocuments.length > 6 && !showAllFiles ? (
            <button
              type="button"
              onClick={() => setShowAllFiles(true)}
              style={{
                background: "transparent",
                border: "none",
                color: "#E51937",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              View All Files
            </button>
          ) : null}
        </div>

        {loading ? (
          <div style={gridStyle}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filteredDocuments.length === 0 ? (
          documents.length === 0 && !searchActive && !categoryFiltered && isPrivileged ? (
            <UploadedFilesEmptyState onUpload={() => setShowUploadModal(true)} />
          ) : (
            <div style={{ padding: "28px 4px" }}>
              <FileText
                size={28}
                color="#2a2a2a"
                aria-hidden
                style={{ marginBottom: "10px" }}
              />
              <p style={{ fontSize: "14px", fontWeight: 600, color: "#777777", margin: 0 }}>
                {documents.length === 0 && !searchActive && !categoryFiltered
                  ? "No documents yet"
                  : categoryFiltered && !searchActive
                    ? "No files in this category yet"
                    : "No files found"}
              </p>
              <p style={{ fontSize: "12px", color: "#555555", marginTop: "4px", marginBottom: 0 }}>
                {searchActive
                  ? "Try a different search or clear the category filter."
                  : categoryFiltered &&
                      !documents.some((doc) => doc.category === filterCategory)
                    ? categoryEmptySubtext(filterCategory)
                    : documents.length === 0
                      ? "Upload a file or add a resource link to get started."
                      : "Try another category or upload a new file."}
              </p>
            </div>
          )
        ) : (
          <div style={gridStyle}>
            {displayedDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                categoryName={categoryLabel(doc.category, allCategories)}
                isPrivileged={isPrivileged}
                deleting={deletingId === doc.id}
                onDelete={(item) => void handleDelete(item as ClubDocument)}
                onEdit={(item) => openEditDocument(item as ClubDocument)}
                onMoveCategory={(item) => openMoveCategory(item as ClubDocument)}
                onPreview={(item) => handleDocumentPreview(item as ClubDocument)}
                onDownload={(item) => void handleDownloadDocument(item as ClubDocument)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 5. Resource links */}
      <section
        aria-label="Resource links"
        style={{
          marginBottom: "20px",
          background: "#141414",
          border: "1px solid #2a2a2a",
          borderRadius: "12px",
          padding: isMobile ? "16px" : "18px 20px",
          maxWidth: "1100px",
        }}
      >
        <Box
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
            <h2
              style={{
                fontWeight: 700,
                fontSize: "15px",
                color: "#ffffff",
                margin: 0,
              }}
            >
              Resource Links
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#666666" }}>
              External tools and shared destinations (Google Drive, forms, social pages)
            </p>
          </div>
          {isPrivileged ? (
            <button
              type="button"
              onClick={() => setShowAddLinkModal(true)}
              style={{
                background: "transparent",
                border: "1px solid #2a2a2a",
                color: "#cccccc",
                borderRadius: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Add Resource Link
            </button>
          ) : null}
        </Box>

        {linksLoading ? (
          <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
            Loading links…
          </p>
        ) : filteredResourceLinks.length === 0 ? (
          searchActive ? (
            <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
              No links match your search.
            </p>
          ) : isPrivileged ? (
            <ResourceLinksEmptyState onAddLink={() => setShowAddLinkModal(true)} />
          ) : (
            <p style={{ fontSize: "13px", color: "#555555", margin: 0 }}>
              No resource links added yet.
            </p>
          )
        ) : (
          <Box>
            {filteredResourceLinks.map((link, index) => (
              <ResourceLinkRow
                key={link.id}
                link={link}
                canManage={isPrivileged}
                deleting={deletingLinkId === link.id}
                isLast={index === filteredResourceLinks.length - 1}
                onDelete={(item) => void handleDeleteLink(item as ResourceLink)}
              />
            ))}
          </Box>
        )}
      </section>

      <DocumentsTipBar canManage={isPrivileged} />
      </div>
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
              Add Resource Link
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
                {savingLink ? "Saving…" : "Add Resource Link"}
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
              Upload File
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
              <ContentVisibilityDropdown
                value={uploadVisibility}
                onChange={setUploadVisibility}
                disabled={uploading}
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
                  opacity: uploading || !selectedFile || !docName.trim() ? 0.5 : 1,
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
            previewAccessUrl ? (
              <img
                src={previewAccessUrl}
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
              <p
                onClick={(e) => e.stopPropagation()}
                style={{ color: "#cccccc", fontSize: "14px" }}
              >
                Loading preview…
              </p>
            )
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
              {previewAccessUrl ? (
                <iframe
                  title={previewDoc.name}
                  src={previewAccessUrl}
                  style={{ flex: 1, width: "100%", border: "none", background: "#111" }}
                />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#777777",
                    fontSize: "14px",
                  }}
                >
                  Loading preview…
                </div>
              )}
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

            <Box style={{ marginBottom: "16px" }}>
              <ContentVisibilityDropdown
                value={editDocVisibility}
                onChange={setEditDocVisibility}
                disabled={savingEdit}
              />
            </Box>

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
                {savingEdit ? "Saving…" : "Save Changes"}
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
                {savingMove ? "Saving…" : "Move Category"}
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
              Create Category
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
                Confirm Category
              </button>
            </Box>
          </div>
        </div>
      ) : null}
    </div>
  );
}
