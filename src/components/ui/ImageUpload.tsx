import { useRef, useState, type ChangeEvent } from "react";
import Button from "./Button";

interface ImageUploadProps {
  /** Current image URL (for preview). */
  currentUrl?: string;
  /** Called with the chosen File when the user picks one. */
  onFileSelected: (file: File) => void;
  /** Whether an upload is in progress. */
  uploading?: boolean;
  /** Label for the upload button. */
  label?: string;
  /** Shape of the preview — "circle" for avatars, "rect" for banners/logos. */
  shape?: "circle" | "rect";
  /** Extra CSS class for the preview container. */
  previewClassName?: string;
}

/** Accepted image MIME types. */
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

export default function ImageUpload({
  currentUrl,
  onFileSelected,
  uploading = false,
  label = "Upload Image",
  shape = "rect",
  previewClassName = "",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show a local preview immediately
    const reader = new FileReader();
    reader.onload = () => setPreviewSrc(reader.result as string);
    reader.readAsDataURL(file);

    onFileSelected(file);
  }

  const displayUrl = previewSrc ?? currentUrl;

  const shapeClasses =
    shape === "circle"
      ? "h-20 w-20 rounded-full"
      : "h-24 w-full max-w-xs rounded-lg";

  return (
    <div className="flex items-center gap-4">
      {/* Preview */}
      <div
        className={`flex-shrink-0 overflow-hidden border border-border bg-surface-alt flex items-center justify-center ${shapeClasses} ${previewClassName}`}
      >
        {displayUrl ? (
          <img
            src={displayUrl}
            alt="Preview"
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <svg
            className="h-8 w-8 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        )}
      </div>

      {/* File input (hidden) + trigger button */}
      <div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={handleChange}
          className="hidden"
          aria-label={label}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : label}
        </Button>
      </div>
    </div>
  );
}
