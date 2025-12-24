import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { startSession } from "../utils/qrSession";

const CORRECT_PASSWORD = "1234"; // demo only

export default function QrPasswordPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function handleSubmit() {
    if (password === CORRECT_PASSWORD) {
      // ✅ SINGLE SOURCE OF TRUTH
      startSession();

      navigate(`/qr/${id}/content`);
    } else {
      setError("Invalid password");
    }
  }

  return (
    <div style={container}>
      <h2>🔒 Protected QR Content</h2>
      <p>Enter password to continue</p>

      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={input}
        placeholder="Enter password"
      />

      {error && <p style={{ color: "red", marginTop: 8 }}>{error}</p>}

      <button onClick={handleSubmit} style={button}>
        Unlock
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 🎨 Styles (unchanged)                                                       */
/* -------------------------------------------------------------------------- */

const container = {
  maxWidth: 360,
  margin: "100px auto",
  padding: 24,
  border: "1px solid #ddd",
  borderRadius: 12,
  textAlign: "center" as const,
};

const input = {
  width: "100%",
  padding: 10,
  marginTop: 12,
};

const button = {
  marginTop: 16,
  padding: 12,
  width: "100%",
  cursor: "pointer",
};
