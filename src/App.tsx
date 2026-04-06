import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { ClubProvider } from "./context/ClubContext";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ClubDetails from "./pages/ClubDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ClubProvider>
          <Routes>
            <Route element={<AppShell />}>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/explore"
                element={
                  <ProtectedRoute>
                    <Explore />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/explore/:clubId"
                element={
                  <ProtectedRoute>
                    <ClubDetails />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </ClubProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
