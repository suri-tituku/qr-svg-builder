import { useEffect } from "react";

export default function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div style={toastStyle}>
      ⚠️ {message}
    </div>
  );
}

const toastStyle = {
  position: "fixed" as const,
  bottom: 20,
  left: "50%",
  transform: "translateX(-50%)",
  background: "#111827",
  color: "#fff",
  padding: "12px 18px",
  borderRadius: 8,
  fontSize: 14,
  zIndex: 9999,
};
