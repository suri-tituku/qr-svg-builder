// src/components/CachedVideoPlayer.tsx
import React, { useEffect, useState } from "react";
import { loadVideoWithCache } from "../utils/videoCache";

type Props = {
  src: string;
};

export default function CachedVideoPlayer({ src }: Props) {
  const [videoUrl, setVideoUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let revoke = "";

    (async () => {
      try {
        const { url } = await loadVideoWithCache({
          url: src,
          ttlMs: 30 * 60 * 1000, // 30 min
          encrypt: true,
        });

        revoke = url;
        setVideoUrl(url);
      } catch {
        setError("Failed to load video");
      }
    })();

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [src]);

  if (error) return <div>{error}</div>;
  if (!videoUrl) return <div>Loading video…</div>;

  return (
    <video
      src={videoUrl}
      controls
      controlsList="nodownload noplaybackrate"
      disablePictureInPicture
      style={{ width: "100%", borderRadius: 12 }}
    />
  );
}
