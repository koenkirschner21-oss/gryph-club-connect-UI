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

export default function TermsOfService() {
  return (
    <div style={pageStyle}>
      <div style={{ ...cardStyle, marginLeft: 16, marginRight: 16 }}>
        <Link to="/" style={backLinkStyle}>
          ← Back to Home
        </Link>
        <h1 style={titleStyle}>Terms of Service</h1>
        <p style={updatedStyle}>Last updated: May 2025</p>
        <p style={{ ...bodyStyle, marginBottom: 0 }}>
          By creating an account on GryphClubConnect, you agree to these Terms of Service.
          Please read them carefully. If you do not agree, do not use the platform.
        </p>
        <Section
          title="Section 1 — Eligibility"
          body="GryphClubConnect is intended for current students, alumni, and faculty of the University of Guelph. By registering, you confirm that you are a member of the UofG community or have been granted access by a club administrator. You must be at least 13 years of age to use this platform."
        />
        <Section
          title="Section 2 — Your Account"
          body="You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information when registering and to keep your profile information current. You may not create accounts on behalf of others or impersonate any person or organization."
        />
        <Section
          title="Section 3 — Acceptable Use"
          body="You agree not to use GryphClubConnect to post content that is harmful, harassing, discriminatory, or illegal. You agree not to spam other users, post unauthorized advertising, or use the platform for any purpose other than legitimate club organization and communication. You agree not to attempt to gain unauthorized access to any part of the platform or another user's account."
        />
        <Section
          title="Section 4 — Club Responsibilities"
          body="Club owners are responsible for the content posted within their club workspaces. Club owners agree to manage their clubs in accordance with University of Guelph community standards and applicable laws. GryphClubConnect reserves the right to remove any club that violates these terms."
        />
        <Section
          title="Section 5 — Content Ownership"
          body="You retain ownership of content you create on GryphClubConnect. By posting content, you grant GryphClubConnect a limited license to store and display that content to authorized users of the platform. You may delete your content at any time. We do not claim ownership over your posts, messages, or files."
        />
        <Section
          title="Section 6 — Intellectual Property"
          body="The GryphClubConnect name, logo, and platform design are the property of the platform developers. You may not reproduce or use them without permission. The University of Guelph name and Gryphon imagery belong to the University of Guelph and are used with respect to their brand guidelines."
        />
        <Section
          title="Section 7 — Termination"
          body='We reserve the right to suspend or terminate accounts that violate these Terms of Service, at our discretion. You may delete your account at any time. Upon termination, your access to club workspaces will be revoked.'
        />
        <Section
          title="Section 8 — Disclaimers"
          body='GryphClubConnect is provided "as is" without warranties of any kind. We are a student-built platform and do not guarantee uninterrupted availability. We are not responsible for any loss of data or damages resulting from use of the platform.'
        />
        <Section
          title="Section 9 — Changes to These Terms"
          body="We may update these Terms of Service at any time. We will notify users of significant changes within the platform. Continued use after changes are posted constitutes acceptance of the revised terms."
        />
        <h2 style={h2Style}>Section 10 — Contact</h2>
        <p style={bodyStyle}>
          Questions about these Terms of Service can be directed to{" "}
          <a href="mailto:gryphclubconnect@gmail.com" style={linkStyle}>
            gryphclubconnect@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
