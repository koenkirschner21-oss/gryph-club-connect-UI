import MockupDeviceFrame from "../../components/dev/MockupDeviceFrame";
import {
  MOCKUP_BG,
  MOCKUP_BORDER,
  MOCKUP_GOLD,
  MOCKUP_MUTED,
  MOCKUP_RED,
  MOCKUP_TEXT,
} from "../../dev/mockupFixtures";
import ExploreClubsMockup from "./mockups/ExploreClubsMockup";
import StudentDashboardMockup from "./mockups/StudentDashboardMockup";
import WorkspaceCommandCenterMockup from "./mockups/WorkspaceCommandCenterMockup";

/**
 * DEV-only gallery for marketing website screenshots.
 * Dummy data only — never wired to Supabase or production nav.
 */
export default function MockupGalleryPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: MOCKUP_BG,
        color: MOCKUP_TEXT,
        fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif",
        padding: "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: "1480px", margin: "0 auto" }}>
        <header
          style={{
            marginBottom: "40px",
            paddingBottom: "24px",
            borderBottom: `1px solid ${MOCKUP_BORDER}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
            <img
              src="/assets/gryph-icon.png"
              alt=""
              style={{ height: "32px", width: "auto" }}
              aria-hidden
            />
            <span style={{ fontWeight: 800, fontStyle: "italic", fontSize: "18px" }}>
              <span style={{ color: MOCKUP_RED }}>Club</span>
              <span style={{ color: MOCKUP_GOLD }}>Connect</span>
            </span>
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            Website Mockup Gallery
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              color: MOCKUP_MUTED,
              maxWidth: "640px",
              lineHeight: 1.5,
            }}
          >
            Dev-only mockups for marketing screenshots. Dummy data only.
          </p>
          <p
            style={{
              margin: "10px 0 0",
              fontSize: "12px",
              color: "#555555",
            }}
          >
            Tip: screenshot each framed section at ~1440×900. This page is not linked from production navigation.
          </p>
        </header>

        <MockupDeviceFrame
          title="Student Dashboard"
          note="Student hub: clubs, events, tasks, announcements, applications, and pending requests."
        >
          <StudentDashboardMockup />
        </MockupDeviceFrame>

        <MockupDeviceFrame
          title="Explore Clubs"
          note="Discovery: search, categories, club cards, and join/recruiting status badges."
        >
          <ExploreClubsMockup />
        </MockupDeviceFrame>

        <MockupDeviceFrame
          title="Club Workspace"
          note="Leader command center: sidebar, setup checklist, joins, events, tasks, and hiring snapshot."
        >
          <WorkspaceCommandCenterMockup />
        </MockupDeviceFrame>
      </div>
    </div>
  );
}
