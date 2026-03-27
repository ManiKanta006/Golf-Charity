import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function RegisterPage({ token, onAuthSuccess }) {
  const navigate = useNavigate();
  const [charities, setCharities] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    plan: "monthly",
    charityId: "",
    charityPercentage: 10
  });
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCharities().then(setCharities).catch(() => setCharities([]));
  }, []);

  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (Number(form.charityPercentage) < 10) {
      setError("Minimum charity contribution is 10%.");
      return;
    }

    try {
      const payload = {
        ...form,
        charityId: form.charityId ? Number(form.charityId) : null,
        charityPercentage: Number(form.charityPercentage)
      };
      const data = await api.register(payload);
      onAuthSuccess(data);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="auth-layout">
      <form className="panel form" onSubmit={onSubmit}>
        <h1>Create your subscription</h1>
        <label>
          Full name
          <input
            value={form.name}
            onChange={(e) => onChange("name", e.target.value)}
            type="text"
            required
          />
        </label>
        <label>
          Email
          <input
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            type="email"
            required
          />
        </label>
        <label>
          Password
          <input
            value={form.password}
            onChange={(e) => onChange("password", e.target.value)}
            type="password"
            minLength={8}
            required
          />
        </label>
        <label>
          Plan
          <select value={form.plan} onChange={(e) => onChange("plan", e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
        <label>
          Charity
          <select value={form.charityId} onChange={(e) => onChange("charityId", e.target.value)}>
            <option value="">Select a charity</option>
            {charities.map((charity) => (
              <option key={charity.id} value={charity.id}>
                {charity.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Charity contribution (%)
          <input
            value={form.charityPercentage}
            onChange={(e) => onChange("charityPercentage", e.target.value)}
            type="number"
            min={10}
            max={90}
            required
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn btn-primary" type="submit">
          Create Account
        </button>
      </form>
    </section>
  );
}
