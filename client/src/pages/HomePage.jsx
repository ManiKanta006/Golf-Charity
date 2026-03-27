import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

export default function HomePage({ token }) {
  const [featured, setFeatured] = useState(null);
  const [draw, setDraw] = useState(null);

  useEffect(() => {
    api.getFeaturedCharity().then(setFeatured).catch(() => setFeatured(null));
    api.latestDraw().then(setDraw).catch(() => setDraw(null));
  }, []);

  return (
    <div className="stack gap-xl">
      <section className="hero">
        <div>
          <p className="eyebrow">Subscription + Sport + Charity</p>
          <h1>Play your form. Win monthly draws. Fund real impact.</h1>
          <p className="lede">
            Enter your latest 5 Stableford scores, join the monthly number draw, and direct a
            portion of your subscription to a cause you care about.
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" to={token ? "/dashboard" : "/register"}>
              {token ? "Open Dashboard" : "Start Subscription"}
            </Link>
            <Link className="btn btn-ghost" to="/charities">
              Explore Charities
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <h3>How it works</h3>
          <ol>
            <li>Subscribe monthly or yearly.</li>
            <li>Maintain your latest 5 scores.</li>
            <li>Join monthly draw for 3/4/5 matches.</li>
            <li>Support a chosen charity every cycle.</li>
          </ol>
        </div>
      </section>

      <section className="grid two">
        <article className="panel">
          <h2>Featured Charity</h2>
          {featured ? (
            <>
              <h3>{featured.name}</h3>
              <p>{featured.description}</p>
            </>
          ) : (
            <p>No featured charity published yet.</p>
          )}
        </article>

        <article className="panel">
          <h2>Latest Published Draw</h2>
          {draw ? (
            <>
              <p>{new Date(draw.draw_month).toLocaleDateString()}</p>
              <div className="chip-row">
                {draw.winning_numbers.map((n) => (
                  <span className="chip" key={n}>
                    {n}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p>No draw has been published yet.</p>
          )}
        </article>
      </section>
    </div>
  );
}
