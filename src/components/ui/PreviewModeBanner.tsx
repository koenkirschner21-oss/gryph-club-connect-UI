import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function previewRoleLabel(role: string): string {
  if (role === "owner") return "President";
  if (role === "executive") return "Executive";
  return "Member";
}

export default function PreviewModeBanner() {
  const navigate = useNavigate();
  const [previewRole, setPreviewRole] = useState<string | null>(() =>
    localStorage.getItem("previewRole"),
  );

  const syncPreviewRole = useCallback(() => {
    setPreviewRole(localStorage.getItem("previewRole"));
  }, []);

  useEffect(() => {
    syncPreviewRole();
    window.addEventListener("storage", syncPreviewRole);
    window.addEventListener("previewrole-change", syncPreviewRole);
    return () => {
      window.removeEventListener("storage", syncPreviewRole);
      window.removeEventListener("previewrole-change", syncPreviewRole);
    };
  }, [syncPreviewRole]);

  if (!previewRole) return null;

  function handleExit() {
    localStorage.removeItem("previewRole");
    setPreviewRole(null);
    window.dispatchEvent(new Event("previewrole-change"));
    navigate("/admin");
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 200,
        background: "#FFC429",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "14px",
          fontWeight: 600,
          color: "#000000",
        }}
      >
        Previewing as {previewRoleLabel(previewRole)}
      </p>
      <button
        type="button"
        onClick={handleExit}
        style={{
          background: "#000000",
          color: "#FFC429",
          borderRadius: "6px",
          padding: "6px 16px",
          fontSize: "13px",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        Exit Preview
      </button>
    </div>
  );
}
