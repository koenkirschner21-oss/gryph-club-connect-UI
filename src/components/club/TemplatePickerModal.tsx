import { useMemo, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import {
  applyAnnouncementTemplate,
  applyDescriptionTemplate,
  getTemplatesForType,
  templatePreviewText,
  templateTypeLabel,
  type AppliedAnnouncementTemplate,
  type AppliedDescriptionTemplate,
  type AnnouncementTemplate,
  type ContentTemplate,
  type TemplatePickerType,
} from "../../lib/clubTemplates";

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.7)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
  zIndex: 60,
};

const panelStyle: CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #2a2a2a",
  borderRadius: "12px",
  padding: "24px",
  maxWidth: "560px",
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
};

const cardStyle = (selected: boolean): CSSProperties => ({
  background: selected ? "#1f1414" : "#141414",
  border: selected ? "1px solid #E51937" : "1px solid #2a2a2a",
  borderRadius: "10px",
  padding: "14px 16px",
  textAlign: "left",
  cursor: "pointer",
  width: "100%",
});

export type TemplatePickerSelection =
  | AppliedAnnouncementTemplate
  | AppliedDescriptionTemplate;

export interface TemplatePickerModalProps {
  type: TemplatePickerType;
  clubName: string;
  clubCategory?: string;
  onSelect: (template: TemplatePickerSelection) => void;
  onClose: () => void;
}

export default function TemplatePickerModal({
  type,
  clubName,
  clubCategory = "",
  onSelect,
  onClose,
}: TemplatePickerModalProps) {
  const templates = useMemo(() => getTemplatesForType(type), [type]);
  const [selectedId, setSelectedId] = useState<string | null>(
    templates[0]?.id ?? null,
  );

  const selectedTemplate = templates.find((template) => template.id === selectedId);

  function applyTemplate(template: ContentTemplate): TemplatePickerSelection {
    if (type === "announcement") {
      return applyAnnouncementTemplate(
        template as AnnouncementTemplate,
        clubName,
        clubCategory,
      );
    }
    return applyDescriptionTemplate(
      template as Exclude<ContentTemplate, AnnouncementTemplate>,
      clubName,
      clubCategory,
    );
  }

  function handleUseTemplate() {
    if (!selectedTemplate) return;
    onSelect(applyTemplate(selectedTemplate));
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-picker-title"
      style={overlayStyle}
      onClick={onClose}
    >
      <div style={panelStyle} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "16px",
          }}
        >
          <div>
            <h2
              id="template-picker-title"
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              Choose a {templateTypeLabel(type)} Template
            </h2>
            <p style={{ margin: "6px 0 0", fontSize: "13px", color: "#777777" }}>
              Pre-fill your form with a starter template for {clubName}.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
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

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {templates.map((template) => {
            const preview = applyTemplateTextPreview(
              templatePreviewText(template),
              clubName,
              clubCategory,
            );
            const selected = selectedId === template.id;

            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedId(template.id)}
                style={cardStyle(selected)}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                  }}
                >
                  {template.label}
                </p>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "12px",
                    color: "#888888",
                    lineHeight: 1.5,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {preview}
                </p>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-end",
            gap: "10px",
            marginTop: "20px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid #333333",
              color: "#cccccc",
              borderRadius: "8px",
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Start from Scratch
          </button>
          <button
            type="button"
            disabled={!selectedTemplate}
            onClick={handleUseTemplate}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "9px 16px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: selectedTemplate ? "pointer" : "not-allowed",
              opacity: selectedTemplate ? 1 : 0.6,
            }}
          >
            Use Template
          </button>
        </div>
      </div>
    </div>
  );
}

function applyTemplateTextPreview(
  text: string,
  clubName: string,
  category: string,
): string {
  const categoryLabel = category.trim() || "your field";
  return text
    .replace(/\[Club Name\]/g, clubName)
    .replace(/\[category\]/g, categoryLabel);
}
