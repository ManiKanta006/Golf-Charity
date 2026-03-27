import { useMemo, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import AdminPage from "./pages/AdminPage";
import CharitiesPage from "./pages/CharitiesPage";
import CharityProfilePage from "./pages/CharityProfilePage";

function ProtectedRoute({ token, children }) {
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AdminRoute({ token, user, children }) {
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

function getStoredAuth() {
  const token = localStorage.getItem("token");
  const rawUser = localStorage.getItem("user");
  return {
    token: token || "",
    user: rawUser ? JSON.parse(rawUser) : null
  };
}

export default function App() {
  const initial = useMemo(() => getStoredAuth(), []);
  const [token, setToken] = useState(initial.token);
  const [user, setUser] = useState(initial.user);

  const handleAuthSuccess = (payload) => {
    setToken(payload.token);
    setUser(payload.user);
    localStorage.setItem("token", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
  };

  const logout = () => {
    setToken("");
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <div className="app-shell">
      <Header token={token} user={user} onLogout={logout} />
      <main className="page-wrap">
        <Routes>
          <Route path="/" element={<HomePage token={token} />} />
          <Route path="/charities" element={<CharitiesPage />} />
          <Route path="/charities/:charityId" element={<CharityProfilePage />} />
          <Route
            path="/login"
            element={<LoginPage token={token} onAuthSuccess={handleAuthSuccess} />}
          />
          <Route
            path="/register"
            element={<RegisterPage token={token} onAuthSuccess={handleAuthSuccess} />}
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute token={token}>
                <DashboardPage token={token} user={user} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute token={token} user={user}>
                <AdminPage token={token} />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
