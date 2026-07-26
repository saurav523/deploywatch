import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ClustersPage } from "./pages/ClustersPage";
import { ClusterDetailPage } from "./pages/ClusterDetailPage";
import { DeploymentDetailPage } from "./pages/DeploymentDetailPage";
import { IncidentsPage } from "./pages/IncidentsPage";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clusters" element={<ClustersPage />} />
        <Route path="/clusters/:id" element={<ClusterDetailPage />} />
        <Route path="/deployments/:depId" element={<DeploymentDetailPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
