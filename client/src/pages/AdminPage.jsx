import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function AdminPage({ token }) {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [winnerEntries, setWinnerEntries] = useState([]);
  const [charities, setCharities] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userScores, setUserScores] = useState([]);
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [userForm, setUserForm] = useState({ name: "", email: "", role: "subscriber" });
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: "monthly",
    status: "active",
    charityPercentage: 10,
    renewalDate: new Date().toISOString().slice(0, 10)
  });
  const [editingCharityId, setEditingCharityId] = useState(null);
  const [charityForm, setCharityForm] = useState({
    name: "",
    description: "",
    imageUrl: "",
    featured: false
  });
  const [mode, setMode] = useState("random");
  const [simulation, setSimulation] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const [summaryData, usersData, entriesData] = await Promise.all([
        api.getAdminSummary(token),
        api.getAdminUsers(token),
        api.getWinnerEntries(token)
      ]);
      const charityData = await api.getCharities();
      setSummary(summaryData);
      setUsers(usersData);
      setWinnerEntries(entriesData);
      setCharities(charityData);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!message && !error) {
      return;
    }

    const timer = setTimeout(() => {
      setMessage("");
      setError("");
    }, 3200);

    return () => clearTimeout(timer);
  }, [message, error]);

  const simulate = async () => {
    setError("");
    setMessage("");
    try {
      const data = await api.simulateDraw(token, mode);
      setSimulation(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const publish = async () => {
    setError("");
    setMessage("");
    try {
      const result = await api.publishDraw(token, mode);
      setMessage(`Draw published. ID: ${result.drawId}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const verifyEntry = async (entryId, status) => {
    setError("");
    setMessage("");
    try {
      await api.verifyWinnerEntry(token, entryId, status);
      setMessage(`Entry ${entryId} marked as ${status}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const markPaid = async (entryId) => {
    setError("");
    setMessage("");
    try {
      await api.payWinnerEntry(token, entryId);
      setMessage(`Payout completed for entry ${entryId}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const onChangeCharityField = (key, value) => {
    setCharityForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetCharityForm = () => {
    setEditingCharityId(null);
    setCharityForm({ name: "", description: "", imageUrl: "", featured: false });
  };

  const startEditCharity = (charity) => {
    setEditingCharityId(charity.id);
    setCharityForm({
      name: charity.name,
      description: charity.description,
      imageUrl: charity.image_url || "",
      featured: Boolean(charity.featured)
    });
  };

  const submitCharity = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const payload = {
        name: charityForm.name,
        description: charityForm.description,
        imageUrl: charityForm.imageUrl || null,
        featured: charityForm.featured ? 1 : 0,
        active: 1
      };

      if (editingCharityId) {
        await api.updateCharity(token, editingCharityId, payload);
        setMessage("Charity updated.");
      } else {
        await api.createCharity(token, payload);
        setMessage("Charity created.");
      }

      resetCharityForm();
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const archiveCharity = async (charityId) => {
    setError("");
    setMessage("");
    try {
      await api.archiveCharity(token, charityId);
      setMessage("Charity archived.");
      if (editingCharityId === charityId) {
        resetCharityForm();
      }
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const selectUser = async (userRecord) => {
    setSelectedUser(userRecord);
    setUserForm({ name: userRecord.name, email: userRecord.email, role: userRecord.role });
    setSubscriptionForm({
      plan: userRecord.latest_plan || "monthly",
      status: userRecord.latest_subscription_status || "active",
      charityPercentage: 10,
      renewalDate: userRecord.latest_renewal_date
        ? new Date(userRecord.latest_renewal_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    });

    try {
      const scores = await api.getAdminUserScores(token, userRecord.id);
      setUserScores(scores);
      const initialDrafts = {};
      for (const score of scores) {
        initialDrafts[score.id] = {
          score: String(score.score),
          datePlayed: new Date(score.date_played).toISOString().slice(0, 10)
        };
      }
      setScoreDrafts(initialDrafts);
    } catch (err) {
      setError(err.message);
    }
  };

  const saveUserProfile = async () => {
    if (!selectedUser) return;
    setError("");
    setMessage("");
    try {
      await api.updateAdminUser(token, selectedUser.id, userForm);
      setMessage("User profile updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveSubscriptionOverride = async () => {
    if (!selectedUser) return;
    setError("");
    setMessage("");
    try {
      await api.overrideAdminUserSubscription(token, selectedUser.id, subscriptionForm);
      setMessage("Subscription override saved.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveScoreEdit = async (scoreId) => {
    if (!selectedUser || !scoreDrafts[scoreId]) return;
    setError("");
    setMessage("");
    try {
      await api.updateAdminUserScore(token, selectedUser.id, scoreId, scoreDrafts[scoreId]);
      setMessage("Score updated.");
      const scores = await api.getAdminUserScores(token, selectedUser.id);
      setUserScores(scores);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!summary) {
    return <p>Loading admin panel...</p>;
  }

  return (
    <div className="stack gap-lg">
      {(message || error) && (
        <div className={`toast-feedback ${error ? "toast-error" : "toast-success"}`}>
          {error || message}
        </div>
      )}

      <section className="grid two">
        <article className="panel">
          <h2>Platform Metrics</h2>
          <p>Total Users: {summary.users?.totalUsers || 0}</p>
          <p>Total Prize Pool: INR {Number(summary.prizePool?.totalPrizePool || 0).toFixed(2)}</p>
          <p>
            Charity Contributions: INR {
              Number(summary.charityTotals?.totalCharityContributions || 0).toFixed(2)
            }
          </p>
          <p>
            Independent Donations: INR 
            {Number(summary.independentDonationStats?.totalIndependentDonations || 0).toFixed(2)}
          </p>
          <p>Published Draws: {summary.drawStats?.publishedDraws || 0}</p>
        </article>

        <article className="panel">
          <h2>Draw Controls</h2>
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="random">Random</option>
              <option value="algorithmic">Algorithmic</option>
            </select>
          </label>
          <div className="cta-row">
            <button className="btn btn-ghost" type="button" onClick={simulate}>
              Run Simulation
            </button>
            <button className="btn btn-primary" type="button" onClick={publish}>
              Publish Draw
            </button>
          </div>
        </article>
      </section>

      {simulation && (
        <section className="panel">
          <h2>Simulation Preview</h2>
          <p>Participants: {simulation.participants}</p>
          <div className="chip-row">
            {simulation.preview.winningNumbers.map((n) => (
              <span className="chip" key={n}>
                {n}
              </span>
            ))}
          </div>
          <div className="grid three">
            {simulation.preview.payouts.map((p) => (
              <article className="subpanel" key={p.tier}>
                <h3>{p.tier}-Match</h3>
                <p>Winners: {p.winners}</p>
                <p>Total: INR {Number(p.totalPool).toFixed(2)}</p>
                <p>Per Winner: INR {Number(p.perWinner).toFixed(2)}</p>
              </article>
            ))}
          </div>
          <p>Next jackpot carryover: INR {Number(simulation.preview.nextCarryover).toFixed(2)}</p>
        </section>
      )}

      <section className="panel">
        <h2>Users and Subscriptions</h2>
        {users.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Renewal</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>{u.latest_plan || "n/a"}</td>
                    <td>{u.latest_subscription_status || "n/a"}</td>
                    <td>{u.latest_renewal_date ? new Date(u.latest_renewal_date).toLocaleDateString() : "n/a"}</td>
                    <td>
                      <button className="btn btn-ghost btn-small" type="button" onClick={() => selectUser(u)}>
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No users found.</p>
        )}
      </section>

      {selectedUser && (
        <section className="panel">
          <h2>Manage User: {selectedUser.name}</h2>
          <div className="grid two">
            <article className="subpanel">
              <h3>Profile</h3>
              <label>
                Name
                <input
                  value={userForm.name}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </label>
              <label>
                Role
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="subscriber">subscriber</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <button className="btn btn-primary" type="button" onClick={saveUserProfile}>
                Save Profile
              </button>
            </article>

            <article className="subpanel">
              <h3>Subscription Override</h3>
              <label>
                Plan
                <select
                  value={subscriptionForm.plan}
                  onChange={(e) =>
                    setSubscriptionForm((prev) => ({ ...prev, plan: e.target.value }))
                  }
                >
                  <option value="monthly">monthly</option>
                  <option value="yearly">yearly</option>
                </select>
              </label>
              <label>
                Status
                <select
                  value={subscriptionForm.status}
                  onChange={(e) =>
                    setSubscriptionForm((prev) => ({ ...prev, status: e.target.value }))
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="lapsed">lapsed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </label>
              <label>
                Renewal Date
                <input
                  type="date"
                  value={subscriptionForm.renewalDate}
                  onChange={(e) =>
                    setSubscriptionForm((prev) => ({ ...prev, renewalDate: e.target.value }))
                  }
                />
              </label>
              <label>
                Charity %
                <input
                  type="number"
                  min={10}
                  max={90}
                  value={subscriptionForm.charityPercentage}
                  onChange={(e) =>
                    setSubscriptionForm((prev) => ({ ...prev, charityPercentage: Number(e.target.value) }))
                  }
                />
              </label>
              <button className="btn btn-primary" type="button" onClick={saveSubscriptionOverride}>
                Save Subscription
              </button>
            </article>
          </div>

          <h3>User Scores</h3>
          {userScores.length ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Score</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {userScores.map((scoreRow) => (
                    <tr key={scoreRow.id}>
                      <td>
                        <input
                          type="number"
                          min={1}
                          max={45}
                          value={scoreDrafts[scoreRow.id]?.score || ""}
                          onChange={(e) =>
                            setScoreDrafts((prev) => ({
                              ...prev,
                              [scoreRow.id]: {
                                ...(prev[scoreRow.id] || {}),
                                score: e.target.value
                              }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={scoreDrafts[scoreRow.id]?.datePlayed || ""}
                          onChange={(e) =>
                            setScoreDrafts((prev) => ({
                              ...prev,
                              [scoreRow.id]: {
                                ...(prev[scoreRow.id] || {}),
                                datePlayed: e.target.value
                              }
                            }))
                          }
                        />
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost btn-small"
                          type="button"
                          onClick={() => saveScoreEdit(scoreRow.id)}
                        >
                          Save Score
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No scores for this user yet.</p>
          )}
        </section>
      )}

      <section className="panel">
        <h2>Charity Management</h2>
        <form className="form compact" onSubmit={submitCharity}>
          <label>
            Charity Name
            <input
              value={charityForm.name}
              onChange={(e) => onChangeCharityField("name", e.target.value)}
              required
            />
          </label>
          <label>
            Description
            <input
              value={charityForm.description}
              onChange={(e) => onChangeCharityField("description", e.target.value)}
              required
            />
          </label>
          <label>
            Image URL
            <input
              value={charityForm.imageUrl}
              onChange={(e) => onChangeCharityField("imageUrl", e.target.value)}
            />
          </label>
          <label className="inline-check">
            <input
              type="checkbox"
              checked={charityForm.featured}
              onChange={(e) => onChangeCharityField("featured", e.target.checked)}
            />
            Featured Charity
          </label>
          <div className="cta-row">
            <button className="btn btn-primary" type="submit">
              {editingCharityId ? "Update Charity" : "Add Charity"}
            </button>
            {editingCharityId && (
              <button className="btn btn-ghost" type="button" onClick={resetCharityForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        {charities.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Featured</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {charities.map((charity) => (
                  <tr key={charity.id}>
                    <td>{charity.name}</td>
                    <td>{charity.featured ? "Yes" : "No"}</td>
                    <td className="action-cell">
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        onClick={() => startEditCharity(charity)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        onClick={() => archiveCharity(charity.id)}
                      >
                        Archive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No charities available.</p>
        )}
      </section>

      <section className="panel">
        <h2>Winner Verification and Payouts</h2>
        {winnerEntries.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Tier</th>
                  <th>Prize</th>
                  <th>Proof</th>
                  <th>Verification</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {winnerEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.user_name}</td>
                    <td>{entry.match_count}-match</td>
                    <td>INR {Number(entry.prize_amount).toFixed(2)}</td>
                    <td>
                      {entry.proof_url ? (
                        <a href={entry.proof_url} target="_blank" rel="noreferrer">
                          View
                        </a>
                      ) : (
                        "Not submitted"
                      )}
                    </td>
                    <td>{entry.verification_status}</td>
                    <td>{entry.payment_status}</td>
                    <td className="action-cell">
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        onClick={() => verifyEntry(entry.id, "approved")}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        onClick={() => verifyEntry(entry.id, "rejected")}
                      >
                        Reject
                      </button>
                      <button
                        className="btn btn-primary btn-small"
                        type="button"
                        onClick={() => markPaid(entry.id)}
                      >
                        Mark Paid
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No winning entries yet. Publish a draw first.</p>
        )}
      </section>

    </div>
  );
}
