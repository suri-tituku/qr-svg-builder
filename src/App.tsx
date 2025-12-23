import { Routes, Route } from "react-router-dom";
import QrBuilder from "./pages/QrBuilder";
import QrProtectedPage from "./pages/QrProtectedPage";
import QrPasswordPage from "./pages/QrPasswordPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<QrBuilder />} />
      <Route path="/qr/:id" element={<QrPasswordPage />} />
      <Route path="/qr/:id/content" element={<QrProtectedPage />} />
    </Routes>
  );
}
