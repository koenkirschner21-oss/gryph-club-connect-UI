import { useState } from "react";
import { X } from "lucide-react";
import { useAuthContext } from "../../context/useAuthContext";
import { supabase } from "../../lib/supabaseClient";
import {
  createExecutiveInvites,
  EXECUTIVE_INVITE_ACCESS_OPTIONS,
  type CreateExecutiveInviteInput,
} from "../../lib/executiveInviteUtils";
import {
  ROLE_TITLE_CUSTOM,
  ROLE_TITLE_GROUPS,
  resolveRoleTitleFromSelection,
  roleTitleGroupForAccessLevel,
  roleTitleOptionsForAccessLevel,
} from "../../lib/memberRoleTitle";
import type { AccessLevel } from "../../types";

interface InviteRowState {
  localId: string;
  email: string;
  accessLevel: AccessLevel;
  titleSelection: string;
  titleCustom: string;
}

const inputStyle = {
  width: "100%",
  background: "#111111",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "10px 12px",
  color: "#ffffff",
  fontSize: "13px",
  boxSizing: "border-box" as const,
};

function newInviteRow(): InviteRowState {
  return {
    localId: crypto.randomUUID(),
    email: "",
    accessLevel: "executive",
    titleSelection: "",
    titleCustom: "",
  };
}

function RoleTitleField({
  accessLevel,
  selection,
  customValue,
  onSelectionChange,
  onCustomChange,
}: {
  accessLevel: AccessLevel;
  selection: string;
  customValue: string;
  onSelectionChange: (value: string) => void;
  onCustomChange: (value: string) => void;
}) {
  const options = roleTitleOptionsForAccessLevel(accessLevel);
  const group = ROLE_TITLE_GROUPS.find(
    (entry) => entry.label === roleTitleGroupForAccessLevel(accessLevel),
  );

  return (
    <div>
      <select
        value={selection}
        onChange={(e) => onSelectionChange(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select role title…</option>
        {group ? (
          <optgroup label={group.label}>
            {options.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </optgroup>
        ) : (
          options.map((title) => (
            <option key={title} value={title}>
              {title}
            </option>
          ))
        )}
        <option value={ROLE_TITLE_CUSTOM}>Custom</option>
      </select>
      {selection === ROLE_TITLE_CUSTOM ? (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Enter a custom title"
          style={{ ...inputStyle, marginTop: "8px" }}
        />
      ) : null}
    </div>
  );
}

export default function InviteExecutiveModal({
  open,
  onClose,
  clubId,
  clubName,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  clubId: string;
  clubName: string;
  onSubmitted: () => void;
}) {
  const { user } = useAuthContext();
  const [rows, setRows] = useState<InviteRowState[]>([newInviteRow()]);
  const [sharedMessage, setSharedMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function handleClose() {
    setRows([newInviteRow()]);
    setSharedMessage("");
    setError(null);
    onClose();
  }

  function updateRow(localId: string, patch: Partial<InviteRowState>) {
    setRows((prev) =>
      prev.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );
  }

  async function handleSubmit() {
    if (!user?.id || submitting) return;

    const invites: CreateExecutiveInviteInput[] = rows
      .map((row) => ({
        email: row.email.trim().toLowerCase(),
        accessLevel: row.accessLevel,
        roleTitle: resolveRoleTitleFromSelection(row.titleSelection, row.titleCustom),
      }))
      .filter((row) => row.email);

    if (invites.length === 0) {
      setError("Enter at least one email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const { created, failed } = await createExecutiveInvites(supabase, {
      clubId,
      clubName,
      invitedBy: user.id,
      invites,
      sharedMessage,
    });

    setSubmitting(false);

    if (created.length === 0) {
      setError("Failed to send invites. Please try again.");
      return;
    }

    if (failed > 0) {
      setError(
        `Sent ${created.length} invite${created.length === 1 ? "" : "s"}, but ${failed} could not be created.`,
      );
    }

    onSubmitted();
    handleClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-executive-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "560px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "transparent",
            border: "none",
            color: "#777777",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <X size={18} aria-hidden />
        </button>

        <h2
          id="invite-executive-title"
          style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "#ffffff" }}
        >
          Invite Executive
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#555555", lineHeight: 1.5 }}>
          Send single-use invites with a specific access level and role title.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {rows.map((row, index) => (
            <div
              key={row.localId}
              style={{
                background: "#111111",
                border: "1px solid #2a2a2a",
                borderRadius: "10px",
                padding: "14px",
              }}
            >
              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "#777777",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Invite {index + 1}
              </p>
              <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
                Email *
              </label>
              <input
                type="email"
                value={row.email}
                onChange={(e) => updateRow(row.localId, { email: e.target.value })}
                placeholder="name@uoguelph.ca"
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
                Access level
              </label>
              <select
                value={row.accessLevel}
                onChange={(e) =>
                  updateRow(row.localId, {
                    accessLevel: e.target.value as AccessLevel,
                    titleSelection: "",
                    titleCustom: "",
                  })
                }
                style={{ ...inputStyle, marginBottom: "12px" }}
              >
                {EXECUTIVE_INVITE_ACCESS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}>
                Role title
              </label>
              <RoleTitleField
                accessLevel={row.accessLevel}
                selection={row.titleSelection}
                customValue={row.titleCustom}
                onSelectionChange={(value) =>
                  updateRow(row.localId, { titleSelection: value })
                }
                onCustomChange={(value) => updateRow(row.localId, { titleCustom: value })}
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newInviteRow()])}
          style={{
            marginTop: "12px",
            background: "transparent",
            border: "1px dashed #333333",
            color: "#aaaaaa",
            borderRadius: "8px",
            padding: "8px 12px",
            fontSize: "12px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          Add another
        </button>

        <label
          style={{ display: "block", fontSize: "12px", color: "#888888", margin: "16px 0 6px" }}
        >
          Optional message
        </label>
        <textarea
          value={sharedMessage}
          onChange={(e) => setSharedMessage(e.target.value)}
          rows={3}
          placeholder="Add a note included with every invite…"
          style={{ ...inputStyle, resize: "vertical", marginBottom: "16px" }}
        />

        {error ? (
          <p style={{ color: "#E51937", fontSize: "12px", margin: "0 0 12px" }}>{error}</p>
        ) : null}

        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleSubmit()}
          style={{
            width: "100%",
            background: "#E51937",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Sending…" : "Send Invites"}
        </button>
      </div>
    </div>
  );
}
