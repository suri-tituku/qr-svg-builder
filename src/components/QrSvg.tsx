import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export type ErrorLevel = "L" | "M" | "Q" | "H";

type Props = {
  value: string;
  size: number;
  margin: number;
  errorLevel: ErrorLevel;
  fgColor: string;
  bgColor?: string;
  transparentBg?: boolean;
  onGenerated?: (svg: string) => void;
};

function makeBackgroundTransparent(svg: string) {
  // remove background rect completely
  return svg.replace(
    /<rect[^>]*fill="[^"]*"[^>]*\/?>/i,
    ""
  );
}

export default function QrSvg({
  value,
  size,
  margin,
  errorLevel,
  fgColor,
  bgColor = "#ffffff",
  transparentBg = false,
  onGenerated,
}: Props) {
  const [svg, setSvg] = useState("");

  const options = useMemo(
    () => ({
      type: "svg" as const,
      width: size,
      margin,
      errorCorrectionLevel: errorLevel,
      color: {
        dark: fgColor,
        light: bgColor, // MUST be valid hex
      },
    }),
    [size, margin, errorLevel, fgColor, bgColor]
  );

  useEffect(() => {
    if (!value.trim()) {
      setSvg("");
      return;
    }

    QRCode.toString(value, options).then((result) => {
      const finalSvg = transparentBg
        ? makeBackgroundTransparent(result)
        : result;

      setSvg(finalSvg);
      onGenerated?.(finalSvg);
    });
  }, [value, options, transparentBg, onGenerated]);

  if (!svg) return null;

  return (
    <div
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
