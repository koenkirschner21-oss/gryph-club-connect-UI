import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function AppShell() {
  const location = useLocation();
  const showFooter = !location.pathname.startsWith("/app/");

  return (
    <div className="flex min-h-screen flex-col bg-page-bg font-sans text-white">
      <Navbar />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
