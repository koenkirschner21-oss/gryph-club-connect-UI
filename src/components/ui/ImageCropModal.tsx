import { useRef, useState, type SyntheticEvent } from "react";
import ReactCrop, {
  type Crop,
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export interface ImageCropModalProps {
  imageFile: File;
  aspectRatio: number;
  circular?: boolean;
  onComplete: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

async function getCroppedBlob(
  image: HTMLImageElement,
  crop: Crop,
): Promise<Blob> {
  const pixelCrop =
    crop.unit === "%"
      ? convertToPixelCrop(crop, image.width, image.height)
      : crop;

  const canvas = document.createElement("canvas");
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.floor(pixelCrop.width * scaleX);
  canvas.height = Math.floor(pixelCrop.height * scaleY);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context unavailable");
  }
  ctx.drawImage(
    image,
    pixelCrop.x * scaleX,
    pixelCrop.y * scaleY,
    pixelCrop.width * scaleX,
    pixelCrop.height * scaleY,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create cropped image"));
      },
      "image/jpeg",
      0.95,
    );
  });
}

export default function ImageCropModal({
  imageFile,
  aspectRatio,
  circular = false,
  onComplete,
  onCancel,
}: ImageCropModalProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop>();
  const [applying, setApplying] = useState(false);
  const objectUrl = useRef(URL.createObjectURL(imageFile)).current;

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop({ unit: "%", width: 80 }, aspectRatio, width, height),
      width,
      height,
    );
    setCrop(initialCrop);
  }

  async function handleApply() {
    if (!crop || !imgRef.current) return;
    setApplying(true);
    try {
      const blob = await getCroppedBlob(imgRef.current, crop);
      onComplete(blob);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-crop-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "16px",
          padding: "28px",
          maxWidth: "520px",
          width: "100%",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="image-crop-title"
          style={{
            fontSize: "18px",
            fontWeight: 700,
            color: "#ffffff",
            margin: "0 0 16px",
          }}
        >
          Crop Image
        </h2>

        <ReactCrop
          crop={crop}
          onChange={setCrop}
          aspect={aspectRatio}
          circularCrop={circular}
          keepSelection
        >
          <img
            ref={imgRef}
            src={objectUrl}
            alt="Crop preview"
            onLoad={onImageLoad}
            style={{
              maxHeight: "400px",
              maxWidth: "100%",
              objectFit: "contain",
            }}
          />
        </ReactCrop>

        <div
          style={{
            marginTop: "20px",
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end",
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={applying}
            style={{
              background: "transparent",
              border: "1px solid #333333",
              color: "#cccccc",
              borderRadius: "6px",
              padding: "9px 20px",
              fontSize: "13px",
              cursor: applying ? "not-allowed" : "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={applying || !crop}
            style={{
              background: "#E51937",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              padding: "9px 20px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: applying || !crop ? "not-allowed" : "pointer",
              opacity: applying || !crop ? 0.6 : 1,
            }}
          >
            {applying ? "Applying…" : "Apply Crop"}
          </button>
        </div>
      </div>
    </div>
  );
}
