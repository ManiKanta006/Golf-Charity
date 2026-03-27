import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function LoginPage({ token, onAuthSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@golfcharity.test");
  const [password, setPassword] = useState("Password@123");
  const [error, setError] = useState("");

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    try {
      const data = await api.login({ email, password });
      onAuthSuccess(data);
      navigate(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="auth-layout">
      <form className="panel form" onSubmit={onSubmit}>
        <h1>Welcome back</h1>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label>
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Login
        </button>
      </form>
    </section>
  );
}
