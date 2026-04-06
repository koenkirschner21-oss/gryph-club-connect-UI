import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import HomePage from "./pages/HomePage";
import ExplorePage from "./pages/ExplorePage";
import ClubProfilePage from "./pages/ClubProfilePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/explore/:clubId" element={<ClubProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
