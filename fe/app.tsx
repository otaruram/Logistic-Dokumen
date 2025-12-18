import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Import halaman-halaman yang sudah kamu buat
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";
import Dashboard from "@/pages/Index"; // Kita panggil Index sebagai Dashboard

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Kalau buka link kosong, lempar ke Landing */}
        <Route path="/" element={<Navigate to="/landing" replace />} />
        
        <Route path="/landing" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        
        {/* 🔥 INI KUNCINYA: /dashboard membuka file Index.tsx */}
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  );
}
