import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import AppHeader from "./components/layout/AppHeader";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import PaperDetailsPage from "./pages/PaperDetailsPage";
import PaperReviewsPage from "./pages/PaperReviewsPage";
import PapersDiscoveryPage from "./pages/PapersDiscoveryPage";
import SignupPage from "./pages/SignupPage";
import AuthorPage from "./pages/AuthorPage";
import AuthorSearchPage from "./pages/AuthorSearchPage";
import ResearcherClaimsPage from "./pages/ResearcherClaimsPage";
import AdminClaimsPage from "./pages/AdminClaimsPage";
import VenuesPage from './pages/VenuesPage';
import VenueProfilePage from './pages/VenueProfilePage';
import FeedbackPage from './pages/FeedbackPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import MyLibraryPage from './pages/MyLibraryPage';
import EditProfilePage from './pages/EditProfilePage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppHeader />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/papers" element={<PapersDiscoveryPage />} />
          <Route path="/papers/:id" element={<PaperDetailsPage />} />
          <Route
            path="/papers/:id/reviews"
            element={
              <ProtectedRoute>
                <PaperReviewsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/authors" element={<AuthorSearchPage />} />
          <Route path="/authors/:id" element={<AuthorPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/researchers/:id/claims"
            element={
              <ProtectedRoute allowedRoles={["researcher"]} requireUserIdParam="id">
                <ResearcherClaimsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/claims"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminClaimsPage />
              </ProtectedRoute>
            }
          />

          {/* Public venue routes */}
          <Route path="/venues" element={<VenuesPage />} />
          <Route path="/venues/:id" element={<VenueProfilePage />} />

          {/* Protected routes — all authenticated users */}
          <Route path="/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
          <Route path="/feedback/my" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
          <Route path="/library" element={<ProtectedRoute><MyLibraryPage /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />

          {/* Admin only */}
          <Route
            path="/admin/feedback"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminFeedbackPage /></ProtectedRoute>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
