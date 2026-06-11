import {
  useState,
  useRef,
  useLayoutEffect,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import {
  getClubBannerBrandBackground,
  isUploadedClubBanner,
} from "../../lib/clubUtils";
import type { Club } from "../../types";

const ACCENT_RED = "#E51937";

const exploreDescriptionStyle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: "13px",
  color: "#999999",
  lineHeight: 1.5,
};

const EXPLORE_DESCRIPTION_MAX_LINES = 2;

function measureExploreDescription(
  measureEl: HTMLParagraphElement,
  description: string,
  maxLines: number,
): { text: string; truncated: boolean } {
  measureEl.textContent = description;
  const lineHeight = parseFloat(getComputedStyle(measureEl).lineHeight) || 19.5;
  const maxHeight = lineHeight * maxLines + 1;

  if (measureEl.scrollHeight <= maxHeight) {
    return { text: description, truncated: false };
  }

  let lo = 0;
  let hi = description.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const prefix = description.slice(0, mid).trimEnd();
    measureEl.textContent = "";
    measureEl.append(`${prefix}… `);
    const readMoreSpan = document.createElement("span");
    readMoreSpan.textContent = "Read more";
    measureEl.append(readMoreSpan);

    if (measureEl.scrollHeight <= maxHeight) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return {
    text: description.slice(0, best).trimEnd(),
    truncated: true,
  };
}

export default function ExploreClubCard({
  club,
  joined,
  highlightUnclaimed = false,
}: {
  club: Club;
  joined: boolean;
  highlightUnclaimed?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [descriptionPreview, setDescriptionPreview] = useState<{
    text: string;
    truncated: boolean;
  }>({ text: "", truncated: false });
  const descriptionContainerRef = useRef<HTMLDivElement>(null);
  const descriptionMeasureRef = useRef<HTMLParagraphElement>(null);
  const description = (club.shortDescription || club.description)?.trim();
  const bannerUrl = club.bannerUrl?.trim();
  const showBannerImage = isUploadedClubBanner(bannerUrl);
  const brandBannerBg = getClubBannerBrandBackground(club.name);

  useLayoutEffect(() => {
    const container = descriptionContainerRef.current;
    const measure = descriptionMeasureRef.current;

    if (!description) {
      setDescriptionPreview({ text: "", truncated: false });
      return;
    }

    if (!container || !measure) return;

    function updatePreview() {
      if (!container || !measure) return;
      measure.style.width = `${container.clientWidth}px`;
      setDescriptionPreview(
        measureExploreDescription(
          measure,
          description,
          EXPLORE_DESCRIPTION_MAX_LINES,
        ),
      );
    }

    updatePreview();
    const observer = new ResizeObserver(updatePreview);
    observer.observe(container);
    return () => observer.disconnect();
  }, [description]);

  return (
    <Link
      to={`/clubs/${club.slug}`}
      className="block no-underline"
      style={{
        cursor: "pointer",
        width: "100%",
        minWidth: 0,
        display: "block",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <article
        style={{
          width: "100%",
          minWidth: 0,
          height: "320px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#1a1a1a",
          border: `1px solid ${
            highlightUnclaimed && club.claimStatus === "unclaimed"
              ? "#E51937"
              : hovered
                ? "#333333"
                : "#242424"
          }`,
          borderRadius: "12px",
          transition: "all 0.15s ease",
          transform: hovered ? "translateY(-2px)" : undefined,
          boxShadow: hovered ? "0 8px 24px rgba(0,0,0,0.4)" : undefined,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            height: "140px",
            flexShrink: 0,
            overflow: "hidden",
            width: "100%",
            position: "relative",
            background: showBannerImage ? "#1a1a1a" : undefined,
          }}
        >
          {showBannerImage ? (
            <img
              src={bannerUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center center",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: brandBannerBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "12px 16px",
                boxSizing: "border-box",
              }}
              aria-hidden="true"
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "#ffffff",
                  textAlign: "center",
                  lineHeight: 1.35,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {club.name}
              </span>
            </div>
          )}
        </div>

        <div
          style={{
            height: "180px",
            padding: "16px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "15px",
              fontWeight: 700,
              color: "#ffffff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {club.name}
          </h3>

          {description ? (
            <div ref={descriptionContainerRef} style={{ minWidth: 0, position: "relative" }}>
              <p
                ref={descriptionMeasureRef}
                aria-hidden
                style={{
                  ...exploreDescriptionStyle,
                  position: "absolute",
                  visibility: "hidden",
                  pointerEvents: "none",
                  height: "auto",
                  width: "100%",
                  margin: 0,
                  zIndex: -1,
                }}
              />
              <p style={exploreDescriptionStyle}>
                {descriptionPreview.text}
                {descriptionPreview.truncated ? (
                  <>
                    …{" "}
                    <span style={{ color: ACCENT_RED, fontWeight: 500 }}>
                      Read more
                    </span>
                  </>
                ) : null}
              </p>
            </div>
          ) : (
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                color: "#555555",
                lineHeight: 1.5,
              }}
            >
              No description available
            </p>
          )}

          {highlightUnclaimed && club.claimStatus === "unclaimed" ? (
            <div style={{ marginTop: "10px" }}>
              <span
                style={{
                  background: "#1a0505",
                  border: "1px solid #E51937",
                  color: "#E51937",
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "10px",
                  fontWeight: 600,
                  display: "inline-block",
                }}
              >
                Available to claim
              </span>
            </div>
          ) : null}

          {club.category ? (
            <div style={{ marginTop: "10px" }}>
              <span
                style={{
                  background: "#1a1a1a",
                  border: "1px solid #333333",
                  color: "#666666",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  fontSize: "10px",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  display: "inline-block",
                }}
              >
                {club.category}
              </span>
            </div>
          ) : null}

          <div
            style={{
              marginTop: "auto",
              paddingTop: "10px",
              borderTop: "1px solid #1e1e1e",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              {joined ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  <Check size={12} strokeWidth={2.5} aria-hidden />
                  Joined
                </span>
              ) : null}
            </div>
            <span
              style={{
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 500,
              }}
            >
              View Club →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
