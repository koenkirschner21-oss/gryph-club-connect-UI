import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import WorkspaceLayout from "./components/workspace/WorkspaceLayout";
import { AuthProvider } from "./context/AuthContext";
import { ClubProvider } from "./context/ClubContext";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ClubDetails from "./pages/ClubDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import NotFound from "./pages/NotFound";
import DashboardPage from "./pages/app/DashboardPage";
import CreateClubPage from "./pages/app/CreateClubPage";
import JoinClubPage from "./pages/app/JoinClubPage";
import ClubHomePage from "./pages/app/ClubHomePage";
import ClubChatPage from "./pages/app/ClubChatPage";
import ClubTasksPage from "./pages/app/ClubTasksPage";
import ClubEventsPage from "./pages/app/ClubEventsPage";
import ClubMembersPage from "./pages/app/ClubMembersPage";

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ClubProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
            >
              Skip to main content
            </a>
            <Routes>
              <Route element={<AppShell />}>
                {/* ───── Public routes ───── */}
                <Route path="/" element={<Home />} />
                <Route path="/explore" element={<Explore />} />
                <Route path="/clubs/:slug" element={<ClubDetails />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Legacy route — redirect old explore/:id links */}
                <Route path="/explore/:slug" element={<ClubDetails />} />

                {/* ───── Authenticated routes (/app/*) ───── */}
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/create-club"
                  element={
                    <ProtectedRoute>
                      <CreateClubPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/join-club"
                  element={
                    <ProtectedRoute>
                      <JoinClubPage />
                    </ProtectedRoute>
                  }
                />

                {/* Club workspace with sidebar layout */}
                <Route
                  path="/app/clubs/:clubId"
                  element={
                    <ProtectedRoute>
                      <WorkspaceLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<ClubHomePage />} />
                  <Route path="chat" element={<ClubChatPage />} />
                  <Route path="tasks" element={<ClubTasksPage />} />
                  <Route path="events" element={<ClubEventsPage />} />
                  <Route path="members" element={<ClubMembersPage />} />
                </Route>

                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </ClubProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
