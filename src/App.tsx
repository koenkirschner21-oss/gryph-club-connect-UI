import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { ClubProvider } from "./context/ClubContext";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ClubDetails from "./pages/ClubDetails";

export default function App() {
  return (
    <BrowserRouter>
      <ClubProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/explore/:clubId" element={<ClubDetails />} />
          </Route>
        </Routes>
      </ClubProvider>
    </BrowserRouter>
  );
}
