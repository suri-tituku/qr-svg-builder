import React, { useEffect } from "react";
import "./PageRevealOverlay.css";

type Props = {
  onDone: () => void;
};

export default function PageRevealOverlay({ onDone }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDone, 1000); // 1s animation
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="page-reveal-overlay">
      {/* You can swap this with a heart/SVG */}
      <div className="pulse-heart"></div>
    </div>
  );
}
