import { BrowserRouter, Routes, Route, NavLink, Outlet } from "react-router-dom";
import { Briefcase, LayoutDashboard } from "lucide-react";
import AppShell from "./components/layout/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import WorkspaceLayout from "./components/workspace/WorkspaceLayout";
import { AuthProvider } from "./context/AuthContext";
import { ClubProvider } from "./context/ClubContext";
import { NotificationsProvider } from "./context/NotificationsProvider";
import Home from "./pages/Home";
import Explore from "./pages/Explore";
import ClubPublicProfilePage from "./pages/ClubPublicProfilePage";
import ClubDetails from "./pages/ClubDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DashboardPage from "./pages/app/DashboardPage";
import CreateClubPage from "./pages/app/CreateClubPage";
import JoinClubPage from "./pages/app/JoinClubPage";
import ClubHomePage from "./pages/app/ClubHomePage";
import ClubChatPage from "./pages/app/ClubChatPage";
import ClubTasksPage from "./pages/app/ClubTasksPage";
import ClubEventsPage from "./pages/app/ClubEventsPage";
import ClubMembersPage from "./pages/app/ClubMembersPage";
import ClubSettingsPage from "./pages/app/ClubSettingsPage";
import ClubAnnouncementsPage from "./pages/app/ClubAnnouncementsPage";
import ClubAnalyticsPage from "./pages/app/ClubAnalyticsPage";
import ClubDocumentsPage from "./pages/app/ClubDocumentsPage";
import OnboardingPage from "./pages/app/OnboardingPage";
import ProfilePage from "./pages/app/ProfilePage";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminClubs from "./pages/admin/AdminClubs";
import AdminUsers from "./pages/admin/AdminUsers";
import EventRSVPPage from "./pages/public/EventRSVPPage";
import HiringBoardPage from "./pages/app/HiringBoardPage";
import ClubRecruitingPage from "./pages/app/ClubRecruitingPage";

function appSidebarNavClass(isActive: boolean) {
  const base =
    "flex items-center gap-2 rounded-[6px] border-l-[3px] py-[9px] pr-[14px] text-[13px] font-normal transition-colors";
  if (isActive) {
    return `${base} border-l-[#E51937] bg-[#1f1f1f] pl-[11px] text-white`;
  }
  return `${base} border-l-transparent pl-[14px] text-[#777777] hover:bg-[#1a1a1a] hover:text-[#cccccc]`;
}

function AppMainSidebarLayout() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside
        className="hidden w-52 flex-shrink-0 border-r md:block"
        style={{ backgroundColor: "#111111", borderColor: "#1e1e1e" }}
      >
        <nav className="space-y-0.5 p-3" aria-label="App navigation">
          <NavLink
            to="/app"
            end
            className={({ isActive }) => appSidebarNavClass(isActive)}
          >
            <LayoutDashboard size={16} strokeWidth={2} aria-hidden />
            Dashboard
          </NavLink>
          <NavLink
            to="/app/hiring"
            className={({ isActive }) => appSidebarNavClass(isActive)}
          >
            <Briefcase size={16} strokeWidth={2} aria-hidden />
            Hiring
          </NavLink>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 py-2 md:hidden">
          <NavLink
            to="/app"
            end
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-surface-alt"
              }`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/app/hiring"
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted hover:bg-surface-alt"
              }`
            }
          >
            Hiring
          </NavLink>
        </nav>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ClubProvider>
            <NotificationsProvider>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:shadow-lg"
            >
              Skip to main content
            </a>
            <Routes>
              <Route path="/events/:eventId/rsvp" element={<EventRSVPPage />} />
              {/* Public browsing — no auth guard */}
              <Route element={<AppShell />}>
                <Route path="/explore" element={<Explore />} />
                <Route path="/clubs/:slug" element={<ClubPublicProfilePage />} />
              </Route>
              <Route element={<AppShell />}>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />

                {/* Legacy route — redirect old explore/:id links */}
                <Route path="/explore/:slug" element={<ClubDetails />} />

                {/* ───── Authenticated routes (/app/*) ───── */}
                <Route
                  element={
                    <ProtectedRoute>
                      <AppMainSidebarLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/app" element={<DashboardPage />} />
                  <Route path="/app/hiring" element={<HiringBoardPage />} />
                </Route>
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
                <Route
                  path="/app/profile"
                  element={
                    <ProtectedRoute>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/onboarding"
                  element={
                    <ProtectedRoute>
                      <OnboardingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/admin"
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/admin/clubs"
                  element={
                    <ProtectedRoute>
                      <AdminClubs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/admin/users"
                  element={
                    <ProtectedRoute>
                      <AdminUsers />
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
                  <Route path="announcements" element={<ClubAnnouncementsPage />} />
                  <Route path="chat" element={<ClubChatPage />} />
                  <Route path="tasks" element={<ClubTasksPage />} />
                  <Route path="documents" element={<ClubDocumentsPage />} />
                  <Route path="events" element={<ClubEventsPage />} />
                  <Route path="recruiting" element={<ClubRecruitingPage />} />
                  <Route path="members" element={<ClubMembersPage />} />
                  <Route path="analytics" element={<ClubAnalyticsPage />} />
                  <Route path="settings" element={<ClubSettingsPage />} />
                </Route>

                {/* Catch-all 404 */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
            </NotificationsProvider>
          </ClubProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
