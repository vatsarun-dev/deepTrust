import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./pages/Home.jsx";
import CheckPage from "./pages/CheckPage.jsx";
import ComplaintPage from "./pages/ComplaintPage.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ReputationPage from "./pages/ReputationPage.jsx";

function App() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-strong)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(255,59,59,0.24),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_30%),linear-gradient(180deg,_#050505_0%,_#070707_45%,_#030303_100%)]" />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/check" element={<CheckPage />} />
        <Route path="/reputation" element={<ReputationPage />} />
        <Route path="/complaint" element={<ComplaintPage />} />
        <Route path="/auth" element={<AuthPage />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
