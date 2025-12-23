import { useEffect } from "react";

export default function QrProtectedPage() {
  useEffect(() => {
    // optional: auto-play only after user interaction (browser rules)
  }, []);

  return (
    <div style={container}>
      <h2>🎉 Welcome</h2>

      <img
        src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4"
        alt="Special"
        style={{ width: "100%", borderRadius: 12 }}
      />

      <audio controls style={{ width: "100%", marginTop: 16 }}>
        <source src="/Raa_Baa.mp3" type="audio/mpeg" />
        Your browser does not support audio.
      </audio>
    </div>
  );
}

const container = {
  maxWidth: 480,
  margin: "60px auto",
  padding: 24,
  textAlign: "center" as const,
};
