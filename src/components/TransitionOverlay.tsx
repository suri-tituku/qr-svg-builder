import React, { useEffect } from "react";
import "./TransitionOverlay.css";

type Props = {
  onFinish: () => void;
};

export default function TransitionOverlay({ onFinish }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 1000); // 1 second
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="overlay-animation">
      <div className="heart"></div>
    </div>
  );
}
