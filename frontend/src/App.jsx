import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import AppHeader from "./components/layout/AppHeader";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import PaperDetailsPage from "./pages/PaperDetailsPage";
import PaperReviewsPage from "./pages/PaperReviewsPage";
import PapersDiscoveryPage from "./pages/PapersDiscoveryPage";
import SignupPage from "./pages/SignupPage";
import AuthorPage from "./pages/AuthorPage";
import AuthorSearchPage from "./pages/AuthorSearchPage";
import ResearcherClaimsPage from "./pages/ResearcherClaimsPage";
import AdminClaimsPage from "./pages/AdminClaimsPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppHeader />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
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
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
