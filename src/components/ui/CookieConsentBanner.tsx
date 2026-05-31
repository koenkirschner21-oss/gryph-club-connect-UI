import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const CONSENT_KEY = "cookie_consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent !== "accepted" && consent !== "declined") {
      setVisible(true);
    }
  }, []);

  function handleDecline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  }

  function handleAccept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9998,
        background: "#111111",
        borderTop: "1px solid #242424",
        padding: "16px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
      }}
    >
      <p style={{ margin: 0, fontSize: "13px", color: "#777777" }}>
        We use cookies to improve your experience.{" "}
        <Link
          to="/privacy"
          style={{ color: "#E51937", fontSize: "13px", textDecoration: "none" }}
        >
          Learn more
        </Link>
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <button
          type="button"
          onClick={handleDecline}
          style={{
            background: "transparent",
            border: "1px solid #333333",
            color: "#747676",
            borderRadius: "6px",
            padding: "8px 20px",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Decline
        </button>
        <button
          type="button"
          onClick={handleAccept}
          style={{
            background: "#E51937",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 20px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
