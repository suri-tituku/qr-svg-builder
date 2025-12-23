import { useState } from "react";
import QrSvg from "../components/QrSvg";
import type { ErrorLevel } from "../components/QrSvg";
import { downloadSvg } from "../utils/downloadSvg";

export default function QrBuilder() {
  const [value, setValue] = useState("https://example.com");
  const [fgColor, setFgColor] = useState("#000000");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [size, setSize] = useState(320);
  const [margin, setMargin] = useState(2);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>("M");
  const [svg, setSvg] = useState("");
  const [transparentBg, setTransparentBg] = useState(false);


  return (
    <div style={{ maxWidth: 1000, margin: "40px auto", padding: 20 }}>
      <h1>SVG QR Code Generator</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24 }}>
        {/* Controls */}
        <div style={{ display: "grid", gap: 14 }}>
          <label>
            QR Value
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              style={{ width: "100%", padding: 10, marginTop: 6 }}
            />
          </label>

          <label>
            Foreground Color
            <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
          </label>

          <label>
            Background Color
            <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
          </label>

          <label>
            Size (px)
            <input type="number" value={size} min={120} max={2000} onChange={(e) => setSize(+e.target.value)} />
          </label>

          <label>
            Margin (quiet zone)
            <input type="number" value={margin} min={0} max={20} onChange={(e) => setMargin(+e.target.value)} />
          </label>

          <label>
            Error Correction
            <select value={errorLevel} onChange={(e) => setErrorLevel(e.target.value as ErrorLevel)}>
              <option value="L">L (7%)</option>
              <option value="M">M (15%)</option>
              <option value="Q">Q (25%)</option>
              <option value="H">H (30%)</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={transparentBg}
              onChange={(e) => setTransparentBg(e.target.checked)}
            />
            Transparent background
          </label>

          <button
            onClick={() => downloadSvg(svg)}
            disabled={!svg}
            style={{ padding: 12, cursor: "pointer" }}
          >
            Download SVG
          </button>
        </div>

        {/* Preview */}
        <div style={{ border: "1px solid #ccc", padding: 16 }}>
          <QrSvg
            value={value}
            size={size}
            margin={margin}
            errorLevel={errorLevel}
            fgColor={fgColor}
            transparentBg={transparentBg}
            bgColor={bgColor}
            onGenerated={setSvg}
          />
        </div>
      </div>
    </div>
  );
}
