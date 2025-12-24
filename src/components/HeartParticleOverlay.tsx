import React, { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
};

/* -------------------------------------------------------------------------- */
/* ❤️ Draw heart shape                                                        */
/* -------------------------------------------------------------------------- */
function drawHeart(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  alpha: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  ctx.beginPath();
  ctx.moveTo(0, size / 4);
  ctx.bezierCurveTo(size / 2, -size / 2, size * 1.5, size / 3, 0, size);
  ctx.bezierCurveTo(
    -size * 1.5,
    size / 3,
    -size / 2,
    -size / 2,
    0,
    size / 4
  );
  ctx.closePath();

  ctx.fillStyle = "#ff3b6b";
  ctx.shadowColor = "rgba(255, 59, 107, 0.4)";
  ctx.shadowBlur = 8;
  ctx.fill();

  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* ❤️ Continuous Floating Hearts (Bottom → Top)                               */
/* -------------------------------------------------------------------------- */
export default function HeartParticleOverlay() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    let width = 0;
    let height = 0;

    function resize() {
      width = window.visualViewport?.width || window.innerWidth;
      height = window.visualViewport?.height || window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);

    let particles: Particle[] = [];

    function spawnHeart() {
      particles.push({
        x: Math.random() * width,
        y: height + 30,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(0.6 + Math.random() * 1.2),
        size: 10 + Math.random() * 6,
        alpha: 1,
      });
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);

      // spawn rate
      if (Math.random() < 0.12) spawnHeart();

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // fade as it goes up
        p.alpha = Math.max(0, p.y / height);

        drawHeart(ctx, p.x, p.y, p.size, p.alpha);
      });

      // remove hearts after top
      particles = particles.filter((p) => p.y > -40);

      rafRef.current = requestAnimationFrame(animate);
    }

    animate();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div style={overlay}>
      <canvas ref={canvasRef} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Full Screen Overlay                                                      */
/* -------------------------------------------------------------------------- */
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  width: "100vw",
  height: "100vh",
  pointerEvents: "none",
  zIndex: 9999,
};
