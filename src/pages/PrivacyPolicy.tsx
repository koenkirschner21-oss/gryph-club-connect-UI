import { Link } from "react-router-dom";

const pageStyle = { background: "#0f0f0f", minHeight: "100vh" } as const;
const cardStyle = {
  background: "#1a1a1a",
  border: "1px solid #242424",
  borderRadius: 12,
  borderTop: "3px solid #E51937",
  padding: 40,
  maxWidth: 800,
  margin: "40px auto",
} as const;
const titleStyle = { fontWeight: 700, fontSize: 28, color: "#ffffff", margin: 0 } as const;
const updatedStyle = { fontSize: 13, color: "#555555", marginTop: 8, marginBottom: 32 } as const;
const backLinkStyle = {
  color: "#E51937",
  fontSize: 13,
  textDecoration: "none",
  display: "inline-block",
  marginBottom: 24,
} as const;
const h2Style = {
  fontWeight: 600,
  fontSize: 16,
  color: "#ffffff",
  marginTop: 28,
  marginBottom: 10,
  paddingBottom: 6,
  borderBottom: "1px solid #222",
} as const;
const bodyStyle = { fontSize: 14, color: "#cccccc", lineHeight: 1.7, margin: 0 } as const;
const linkStyle = { color: "#E51937", textDecoration: "none" } as const;

function Section({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h2 style={h2Style}>{title}</h2>
      <p style={bodyStyle}>{body}</p>
    </>
  );
}

export default function PrivacyPolicy() {
  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, marginLeft: 16, marginRight: 16 }}>
        <Link to="/" style={backLinkStyle}>
          ← Back to Home
        </Link>
        <h1 style={titleStyle}>Privacy Policy</h1>
        <p style={updatedStyle}>Last updated: May 2025</p>
        <p style={{ ...bodyStyle, marginBottom: 0 }}>
          GryphClubConnect (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is a student club
          management platform built for the University of Guelph community. This Privacy
          Policy explains what information we collect, how we use it, and your rights
          regarding your data.
        </p>
        <Section
          title="Section 1 — Information We Collect"
          body="We collect information you provide directly when you create an account, including your name, University of Guelph email address, academic program, and year of study. We also collect content you create within the platform such as club posts, announcements, chat messages, tasks, and event RSVPs. We automatically collect basic usage data such as pages visited and features used to improve the platform."
        />
        <Section
          title="Section 2 — How We Use Your Information"
          body="We use your information to operate and improve GryphClubConnect, to display your profile within clubs you are a member of, to send you notifications about club activity you have opted into, and to ensure the platform functions correctly. We do not sell your personal information to any third party."
        />
        <Section
          title="Section 3 — Who Can See Your Information"
          body="Your name, program, and year are visible to other members of clubs you join. Your email address is visible only to club owners and administrators of clubs you belong to. Chat messages and announcements are visible to all members of the relevant club. Your profile is not publicly searchable outside of the platform."
        />
        <Section
          title="Section 4 — Data Storage and Security"
          body="GryphClubConnect uses Supabase for data storage and authentication, which stores data on secure cloud infrastructure. We use row-level security policies to ensure users can only access data they are authorized to view. While we take reasonable steps to protect your data, no system is completely secure and we cannot guarantee absolute security."
        />
        <Section
          title="Section 5 — University of Guelph Affiliation"
          body="GryphClubConnect is an independent student-built platform and is not officially affiliated with or endorsed by the University of Guelph. Use of a UofG email address to register does not imply any institutional relationship."
        />
        <Section
          title="Section 6 — Data Retention"
          body="Your data is retained for as long as your account is active. You may request deletion of your account and associated data by contacting us at the email below. Some data may be retained in backups for a short period following deletion."
        />
        <h2 style={h2Style}>Section 7 — Your Rights</h2>
        <p style={bodyStyle}>
          You have the right to access the personal information we hold about you, to
          request corrections to inaccurate data, and to request deletion of your account.
          To exercise these rights, contact us at{" "}
          <a href="mailto:privacy@gryphclubconnect.com" style={linkStyle}>
            privacy@gryphclubconnect.com
          </a>
          .
        </p>
        <Section
          title="Section 8 — Changes to This Policy"
          body="We may update this Privacy Policy from time to time. We will notify users of significant changes by posting a notice within the platform. Continued use of GryphClubConnect after changes are posted constitutes acceptance of the updated policy."
        />
        <h2 style={h2Style}>Section 9 — Contact</h2>
        <p style={bodyStyle}>
          If you have questions about this Privacy Policy, contact us at{" "}
          <a href="mailto:privacy@gryphclubconnect.com" style={linkStyle}>
            privacy@gryphclubconnect.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
