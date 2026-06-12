import { useState } from "react";
import {
  EXECUTIVE_INVITE_ACCESS_OPTIONS,
} from "../../lib/executiveInviteUtils";
import {
  ROLE_TITLE_CUSTOM,
  ROLE_TITLE_GROUPS,
  accessLevelBadgeLabel,
  resolveRoleTitleFromSelection,
  roleTitleGroupForAccessLevel,
  roleTitleOptionsForAccessLevel,
} from "../../lib/memberRoleTitle";
import type { AccessLevel } from "../../types";
import { showToast } from "../ui/Toast";

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

const EXECUTIVE_REQUEST_LEVELS = EXECUTIVE_INVITE_ACCESS_OPTIONS.filter(
  (option) => option.value !== "member",
);

function ClubLogoDisplay({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "12px",
          objectFit: "cover",
          border: "1px solid #333333",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: "64px",
        height: "64px",
        borderRadius: "12px",
        background: "#111111",
        border: "1px solid #333333",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "20px",
        fontWeight: 700,
        color: "#888888",
      }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
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
      <label
        htmlFor="exec-request-role-title"
        style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}
      >
        Expected role title
      </label>
      <select
        id="exec-request-role-title"
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
        ) : null}
        <option value={ROLE_TITLE_CUSTOM}>Custom title…</option>
      </select>
      {selection === ROLE_TITLE_CUSTOM ? (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="Enter custom role title"
          style={{ ...inputStyle, marginTop: "8px" }}
        />
      ) : null}
    </div>
  );
}

export interface ClubJoinAccessConfirmationProps {
  clubName: string;
  logoUrl?: string;
  joining?: boolean;
  submittingRequest?: boolean;
  onJoinAsGeneralMember: () => void;
  onRequestExecutiveInvite: (payload: {
    accessLevel: AccessLevel;
    roleTitle: string;
    message?: string;
  }) => Promise<void>;
  onBack?: () => void;
  backLabel?: string;
}

export default function ClubJoinAccessConfirmation({
  clubName,
  logoUrl,
  joining = false,
  submittingRequest = false,
  onJoinAsGeneralMember,
  onRequestExecutiveInvite,
  onBack,
  backLabel = "Use a different join code",
}: ClubJoinAccessConfirmationProps) {
  const [view, setView] = useState<"confirm" | "executive" | "request_form">("confirm");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("executive");
  const [titleSelection, setTitleSelection] = useState("");
  const [titleCustom, setTitleCustom] = useState("");
  const [optionalMessage, setOptionalMessage] = useState("");
  const [requestSubmitting, setRequestSubmitting] = useState(false);

  const roleTitle = resolveRoleTitleFromSelection(titleSelection, titleCustom);
  const roleLabelForCopy =
    roleTitle ||
    EXECUTIVE_REQUEST_LEVELS.find((option) => option.value === accessLevel)?.label ||
    accessLevelBadgeLabel(accessLevel);

  async function handleCopyPresidentMessage() {
    const text = `Hi, I'm trying to join ${clubName} as ${roleLabelForCopy}. Could you send me an executive invite on Gryph ClubConnect?`;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Message copied to clipboard.", "success");
    } catch {
      showToast("Could not copy to clipboard.", "error");
    }
  }

  async function handleSubmitExecutiveRequest() {
    if (!roleTitle) {
      showToast("Please select or enter an expected role title.", "error");
      return;
    }

    setRequestSubmitting(true);
    try {
      await onRequestExecutiveInvite({
        accessLevel,
        roleTitle,
        message: optionalMessage.trim() || undefined,
      });
      showToast("Your executive invite request was sent to club leadership.", "success");
      setView("executive");
    } catch {
      showToast("Failed to send request. Please try again.", "error");
    } finally {
      setRequestSubmitting(false);
    }
  }

  if (view === "executive") {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
          <ClubLogoDisplay name={clubName} logoUrl={logoUrl} />
        </div>
        <h1 className="mb-2 text-center text-2xl font-bold text-white">{clubName}</h1>
        <p className="mb-6 text-center text-sm text-muted">
          Executive access must be granted by a President or Co-President. Ask your club
          President or Co-President to send you an executive invite.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            type="button"
            onClick={() => setView("request_form")}
            style={{
              width: "100%",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "11px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Request Executive Invite
          </button>
          <button
            type="button"
            onClick={() => void handleCopyPresidentMessage()}
            style={{
              width: "100%",
              background: "transparent",
              color: "#ffffff",
              border: "1px solid #333333",
              borderRadius: "6px",
              padding: "11px 20px",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Copy message to send to President
          </button>
          <button
            type="button"
            disabled={joining || submittingRequest}
            onClick={onJoinAsGeneralMember}
            style={{
              width: "100%",
              background: "transparent",
              color: "#888888",
              border: "none",
              padding: "8px",
              fontSize: "13px",
              cursor: joining || submittingRequest ? "not-allowed" : "pointer",
              textDecoration: "underline",
            }}
          >
            {joining || submittingRequest ? "Joining…" : "Join as General Member anyway"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setView("confirm")}
            className="text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (view === "request_form") {
    return (
      <div>
        <h2 className="mb-4 text-center text-lg font-bold text-white">
          Request Executive Invite
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              htmlFor="exec-request-level"
              style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}
            >
              Expected access level
            </label>
            <select
              id="exec-request-level"
              value={accessLevel}
              onChange={(e) => {
                const next = e.target.value as AccessLevel;
                setAccessLevel(next);
                setTitleSelection("");
                setTitleCustom("");
              }}
              style={inputStyle}
            >
              {EXECUTIVE_REQUEST_LEVELS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <RoleTitleField
            accessLevel={accessLevel}
            selection={titleSelection}
            customValue={titleCustom}
            onSelectionChange={setTitleSelection}
            onCustomChange={setTitleCustom}
          />

          <div>
            <label
              htmlFor="exec-request-message"
              style={{ display: "block", fontSize: "12px", color: "#888888", marginBottom: "6px" }}
            >
              Optional message
            </label>
            <textarea
              id="exec-request-message"
              value={optionalMessage}
              onChange={(e) => setOptionalMessage(e.target.value)}
              rows={3}
              placeholder="Add context for the President…"
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <button
            type="button"
            disabled={requestSubmitting}
            onClick={() => void handleSubmitExecutiveRequest()}
            style={{
              width: "100%",
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "11px 20px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: requestSubmitting ? "not-allowed" : "pointer",
              opacity: requestSubmitting ? 0.7 : 1,
            }}
          >
            {requestSubmitting ? "Sending…" : "Send request"}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setView("executive")}
            className="text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
        <ClubLogoDisplay name={clubName} logoUrl={logoUrl} />
      </div>
      <h1 className="mb-2 text-center text-2xl font-bold text-white">{clubName}</h1>
      <p className="mb-6 text-center text-sm text-muted">
        This code will add you as a General Member.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <button
          type="button"
          disabled={joining || submittingRequest}
          onClick={onJoinAsGeneralMember}
          style={{
            width: "100%",
            background: "#E51937",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "12px 20px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: joining || submittingRequest ? "not-allowed" : "pointer",
            opacity: joining || submittingRequest ? 0.7 : 1,
          }}
        >
          {joining || submittingRequest ? "Joining…" : "Join as General Member"}
        </button>
        <button
          type="button"
          onClick={() => setView("executive")}
          style={{
            width: "100%",
            background: "transparent",
            color: "#888888",
            border: "none",
            padding: "8px",
            fontSize: "13px",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          I&apos;m supposed to be an executive
        </button>
      </div>

      {onBack ? (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-primary transition-colors hover:text-primary-dark cursor-pointer"
          >
            {backLabel}
          </button>
        </div>
      ) : null}
    </div>
  );
}
