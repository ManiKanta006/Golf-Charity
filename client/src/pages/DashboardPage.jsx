import { useEffect, useState } from "react";
import { api } from "../services/api";

export default function DashboardPage({ token, user }) {
  const [data, setData] = useState(null);
  const [winnerEntries, setWinnerEntries] = useState([]);
  const [charities, setCharities] = useState([]);
  const [donations, setDonations] = useState([]);
  const [proofDrafts, setProofDrafts] = useState({});
  const [proofFiles, setProofFiles] = useState({});
  const [scoreDrafts, setScoreDrafts] = useState({});
  const [score, setScore] = useState("");
  const [datePlayed, setDatePlayed] = useState(new Date().toISOString().slice(0, 10));
  const [selectedCharityId, setSelectedCharityId] = useState("");
  const [charityPercentageDraft, setCharityPercentageDraft] = useState(10);
  const [paymentPlan, setPaymentPlan] = useState("monthly");
  const [paymentCharityPercentage, setPaymentCharityPercentage] = useState(10);
  const [paymentCharityId, setPaymentCharityId] = useState("");
  const [lastPaymentOrderId, setLastPaymentOrderId] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [donationAmount, setDonationAmount] = useState("");
  const [donationNote, setDonationNote] = useState("");
  const [donationCharityId, setDonationCharityId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [dashboard, entries, charityRows, donationRows] = await Promise.all([
        api.getDashboard(token),
        api.getMyWinnerEntries(token),
        api.getCharities(),
        api.getMyDonations(token)
      ]);
      setData(dashboard);
      setWinnerEntries(entries);
      setCharities(charityRows);
      setDonations(donationRows);
      setSelectedCharityId(String(dashboard.selectedCharity?.id || ""));
      setDonationCharityId(String(dashboard.selectedCharity?.id || ""));
      setCharityPercentageDraft(Number(dashboard.subscription?.charity_percentage || 10));
      setPaymentPlan(dashboard.subscription?.plan || "monthly");
      setPaymentCharityPercentage(Number(dashboard.subscription?.charity_percentage || 10));
      setPaymentCharityId(String(dashboard.selectedCharity?.id || ""));

      const drafts = {};
      for (const row of dashboard.scores || []) {
        drafts[row.id] = {
          score: String(row.score),
          datePlayed: new Date(row.date_played).toISOString().slice(0, 10)
        };
      }
      setScoreDrafts(drafts);
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

  const addScore = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.addScore(token, { score: Number(score), datePlayed });
      setScore("");
      setMessage("Score saved.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelSubscription = async () => {
    setError("");
    setMessage("");
    try {
      await api.cancelSubscription(token);
      setMessage("Subscription cancelled.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitProof = async (entryId) => {
    const url = proofDrafts[entryId]?.trim();
    const file = proofFiles[entryId] || null;
    if (!url && !file) {
      setError("Please paste a proof URL or select a screenshot file.");
      return;
    }

    setError("");
    setMessage("");
    try {
      if (file) {
        await api.submitWinnerProofFile(token, entryId, file);
      } else {
        await api.submitWinnerProof(token, entryId, url);
      }
      setMessage(`Proof submitted for entry ${entryId}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateScore = async (scoreId) => {
    const draft = scoreDrafts[scoreId];
    if (!draft) return;

    setError("");
    setMessage("");
    try {
      await api.updateScore(token, scoreId, {
        score: Number(draft.score),
        datePlayed: draft.datePlayed
      });
      setMessage("Score updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateCharityPreference = async () => {
    if (!selectedCharityId) {
      setError("Please select a charity.");
      return;
    }

    setError("");
    setMessage("");
    try {
      await api.updateMyCharitySelection(token, Number(selectedCharityId));
      setMessage("Charity preference updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateCharityPercentage = async () => {
    setError("");
    setMessage("");
    try {
      await api.updateMyCharityPercentage(token, Number(charityPercentageDraft));
      setMessage("Charity contribution percentage updated.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const submitDonation = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!donationAmount || Number(donationAmount) <= 0) {
      setError("Donation amount must be greater than 0.");
      return;
    }

    try {
      await api.createDonation(token, {
        charityId: donationCharityId ? Number(donationCharityId) : null,
        amount: Number(donationAmount),
        note: donationNote || null
      });
      setDonationAmount("");
      setDonationNote("");
      setMessage("Independent donation recorded.");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const beginPaymentActivation = async () => {
    setError("");
    setMessage("");
    setPaymentBusy(true);

    const payload = {
      plan: paymentPlan === "yearly" ? "yearly" : "monthly",
      charityPercentage: Number(paymentCharityPercentage || 10),
      charityId: paymentCharityId ? Number(paymentCharityId) : null
    };

    try {
      const order = await api.createPaymentOrder(token, payload);
      setLastPaymentOrderId(order.orderId || "");

      if (order.provider === "mock") {
        await api.verifyPayment(token, { orderId: order.orderId, ...payload });
        setMessage("Mock payment completed. Subscription activated.");
        await load();
        return;
      }

      setMessage(
        "Payment order created. Complete the gateway payment, then click 'Verify Payment' to activate subscription."
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentBusy(false);
    }
  };

  const verifyPaymentOrder = async () => {
    if (!lastPaymentOrderId) {
      setError("No payment order found. Start payment first.");
      return;
    }

    setError("");
    setMessage("");
    setPaymentBusy(true);
    try {
      await api.verifyPayment(token, { orderId: lastPaymentOrderId });
      setMessage("Payment verified. Subscription activated.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPaymentBusy(false);
    }
  };

  if (!data) {
    return <p>Loading dashboard...</p>;
  }

  const isSubscriptionActive = data.subscription?.status === "active";

  return (
    <div className="stack gap-lg">
      {(message || error) && (
        <div className={`toast-feedback ${error ? "toast-error" : "toast-success"}`}>
          {error || message}
        </div>
      )}

      <section className="grid two">
        <article className="panel">
          <h2>{user?.name || "Subscriber"}</h2>
          <p>
            Plan: <strong>{data.subscription?.plan || "n/a"}</strong>
          </p>
          <p>
            Status: <strong>{data.subscription?.status || "inactive"}</strong>
          </p>
          <p>
            Renewal: <strong>{data.subscription?.renewal_date?.slice(0, 10) || "n/a"}</strong>
          </p>
          <div className="cta-row">
            {isSubscriptionActive ? (
              <button className="btn btn-ghost" type="button" onClick={cancelSubscription}>
                Cancel Subscription
              </button>
            ) : (
              <button
                className="btn btn-primary"
                type="button"
                onClick={beginPaymentActivation}
                disabled={paymentBusy}
              >
                {paymentBusy ? "Processing..." : "Pay & Activate"}
              </button>
            )}
          </div>

          {!isSubscriptionActive && (
            <div className="form compact">
              <label>
                Payment Plan
                <select value={paymentPlan} onChange={(e) => setPaymentPlan(e.target.value)}>
                  <option value="monthly">monthly</option>
                  <option value="yearly">yearly</option>
                </select>
              </label>
              <label>
                Charity %
                <input
                  type="number"
                  min={10}
                  max={90}
                  value={paymentCharityPercentage}
                  onChange={(e) => setPaymentCharityPercentage(e.target.value)}
                />
              </label>
              <label>
                Charity
                <select value={paymentCharityId} onChange={(e) => setPaymentCharityId(e.target.value)}>
                  <option value="">No charity selected</option>
                  {charities.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="cta-row">
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={verifyPaymentOrder}
                  disabled={paymentBusy}
                >
                  Verify Payment
                </button>
                {lastPaymentOrderId && <span className="muted-small">Order: {lastPaymentOrderId}</span>}
              </div>
            </div>
          )}
        </article>

        <article className="panel">
          <h2>Winnings Overview</h2>
          <p>Total Won: INR {Number(data.winnings?.totalWon || 0).toFixed(2)}</p>
          <p>Pending Payouts: {data.winnings?.pendingPayouts || 0}</p>
          <p>Paid Payouts: {data.winnings?.paidPayouts || 0}</p>
          <p>Draws Entered: {data.participation?.drawsEntered || 0}</p>
          <p>
            Upcoming Draw: {" "}
            {data.participation?.upcomingDrawMonth
              ? new Date(data.participation.upcomingDrawMonth).toLocaleDateString()
              : "n/a"}
          </p>
        </article>
      </section>

      <section className="grid two">
        <article className="panel">
          <h2>Add New Score</h2>
          {!isSubscriptionActive && (
            <p className="error-text">Complete payment activation to add or edit your golf scores.</p>
          )}
          <form className="form compact" onSubmit={addScore}>
            <label>
              Score (1-45)
              <input
                type="number"
                min={1}
                max={45}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                disabled={!isSubscriptionActive}
                required
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={datePlayed}
                onChange={(e) => setDatePlayed(e.target.value)}
                disabled={!isSubscriptionActive}
                required
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={!isSubscriptionActive}>
              Save Score
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>Selected Charity</h2>
          {data.selectedCharity ? (
            <>
              <h3>{data.selectedCharity.name}</h3>
              <p>{data.selectedCharity.description}</p>
              <p>
                Contribution: <strong>{data.subscription?.charity_percentage || 10}%</strong>
              </p>
              <div className="form compact">
                <label>
                  Increase contribution %
                  <input
                    type="number"
                    min={10}
                    max={90}
                    value={charityPercentageDraft}
                    onChange={(e) => setCharityPercentageDraft(e.target.value)}
                    disabled={!isSubscriptionActive}
                  />
                </label>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={updateCharityPercentage}
                  disabled={!isSubscriptionActive}
                >
                  Save Percentage
                </button>
              </div>
            </>
          ) : (
            <p>No charity selected yet.</p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Latest 5 Scores</h2>
        {data.scores.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Score</th>
                  <th>Date</th>
                  <th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {data.scores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <input
                        type="number"
                        min={1}
                        max={45}
                        value={scoreDrafts[s.id]?.score || ""}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({
                            ...prev,
                            [s.id]: {
                              ...(prev[s.id] || {}),
                              score: e.target.value
                            }
                          }))
                        }
                        disabled={!isSubscriptionActive}
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={scoreDrafts[s.id]?.datePlayed || ""}
                        onChange={(e) =>
                          setScoreDrafts((prev) => ({
                            ...prev,
                            [s.id]: {
                              ...(prev[s.id] || {}),
                              datePlayed: e.target.value
                            }
                          }))
                        }
                        disabled={!isSubscriptionActive}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-small"
                        type="button"
                        disabled={!isSubscriptionActive}
                        onClick={() => updateScore(s.id)}
                      >
                        Update
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No scores added yet.</p>
        )}
      </section>

      <section className="grid two">
        <article className="panel">
          <h2>Charity Preference</h2>
          <label>
            Selected Charity
            <select value={selectedCharityId} onChange={(e) => setSelectedCharityId(e.target.value)}>
              <option value="">Select a charity</option>
              {charities.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary" type="button" onClick={updateCharityPreference}>
            Save Charity Preference
          </button>
        </article>

        <article className="panel">
          <h2>Independent Donation</h2>
          <form className="form compact" onSubmit={submitDonation}>
            <label>
              Charity (optional)
              <select
                value={donationCharityId}
                onChange={(e) => setDonationCharityId(e.target.value)}
              >
                <option value="">No specific charity</option>
                {charities.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input
                type="number"
                min={1}
                step="0.01"
                value={donationAmount}
                onChange={(e) => setDonationAmount(e.target.value)}
              />
            </label>
            <label>
              Note
              <input value={donationNote} onChange={(e) => setDonationNote(e.target.value)} />
            </label>
            <button className="btn btn-primary" type="submit">
              Donate
            </button>
          </form>
          <p>
            Total independent donated: INR 
            {Number(data.independentDonations?.totalIndependentDonated || 0).toFixed(2)} ({data.independentDonations?.donationsCount || 0} donations)
          </p>
          {!!donations.length && (
            <p className="muted-small">
              Latest: INR {Number(donations[0].amount).toFixed(2)} on {new Date(donations[0].created_at).toLocaleDateString()}
            </p>
          )}
        </article>
      </section>

      <section className="panel">
        <h2>Winner Verification</h2>
        {winnerEntries.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Draw Month</th>
                  <th>Tier</th>
                  <th>Prize</th>
                  <th>Verification</th>
                  <th>Payment</th>
                  <th>Proof URL</th>
                  <th>Submit</th>
                </tr>
              </thead>
              <tbody>
                {winnerEntries.map((entry) => (
                  (() => {
                    const canEditProof =
                      entry.verification_status !== "approved" && entry.payment_status !== "paid";

                    return (
                  <tr key={entry.id}>
                    <td>{new Date(entry.draw_month).toLocaleDateString()}</td>
                    <td>{entry.match_count}-match</td>
                    <td>INR {Number(entry.prize_amount).toFixed(2)}</td>
                    <td>{entry.verification_status}</td>
                    <td>{entry.payment_status}</td>
                    <td>
                      <input
                        value={proofDrafts[entry.id] ?? entry.proof_url ?? ""}
                        onChange={(e) =>
                          setProofDrafts((prev) => ({ ...prev, [entry.id]: e.target.value }))
                        }
                        placeholder="Paste URL (optional if file selected)"
                        disabled={!canEditProof}
                        readOnly={!canEditProof}
                      />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setProofFiles((prev) => ({ ...prev, [entry.id]: e.target.files?.[0] || null }))
                        }
                        disabled={!canEditProof}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-small"
                        onClick={() => submitProof(entry.id)}
                        disabled={!canEditProof}
                        type="button"
                      >
                        {canEditProof ? "Upload" : "Locked"}
                      </button>
                    </td>
                  </tr>
                    );
                  })()
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No winning entries yet.</p>
        )}
      </section>

    </div>
  );
}
