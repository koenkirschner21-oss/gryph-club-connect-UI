import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { AuthProvider } from "./context/AuthContext";
import { ClubProvider } from "./context/ClubContext";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ClubDetails from "./pages/ClubDetails";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/explore/:clubId" element={<ClubDetails />} />
            </Route>
          </Routes>
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
