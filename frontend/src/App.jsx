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
import ResearcherSuggestPaperPage from './pages/ResearcherSuggestPaperPage';
import AdminAddPaperPage from './pages/AdminAddPaperPage';
import StatisticsPage from './pages/StatisticsPage';
import AdminDuplicateClaimsPage from './pages/AdminDuplicateClaimsPage';

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
            path="/researchers/:id/suggest-paper"
            element={
              <ProtectedRoute allowedRoles={["researcher"]} requireUserIdParam="id">
                <ResearcherSuggestPaperPage />
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
          <Route
            path="/admin/papers"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAddPaperPage />
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
          <Route path="/statistics" element={<ProtectedRoute><StatisticsPage /></ProtectedRoute>} />

          {/* Admin only */}
          <Route
            path="/admin/feedback"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminFeedbackPage /></ProtectedRoute>}
          />
          <Route
            path="/admin/duplicate-claims"
            element={<ProtectedRoute allowedRoles={['admin']}><AdminDuplicateClaimsPage /></ProtectedRoute>}
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
