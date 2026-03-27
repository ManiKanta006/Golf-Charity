import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";

export default function CharityProfilePage() {
  const { charityId } = useParams();
  const [charity, setCharity] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .getCharityById(charityId)
      .then(setCharity)
      .catch((err) => setError(err.message));
  }, [charityId]);

  if (error) {
    return <p className="error-text">{error}</p>;
  }

  if (!charity) {
    return <p>Loading charity profile...</p>;
  }

  return (
    <div className="stack gap-lg">
      <section className="panel profile-hero">
        <div>
          <p className="eyebrow">Charity Profile</p>
          <h1>{charity.name}</h1>
          <p>{charity.description}</p>
          <div className="chip-row">
            {charity.impactHighlights.map((item) => (
              <span className="chip" key={item}>
                {item}
              </span>
            ))}
          </div>
          <Link className="btn btn-ghost" to="/charities">
            Back to Directory
          </Link>
        </div>
        <img className="profile-image" src={charity.image_url} alt={charity.name} />
      </section>

      <section className="panel">
        <h2>Upcoming Events</h2>
        {charity.upcomingEvents.length ? (
          <div className="grid two">
            {charity.upcomingEvents.map((event) => (
              <article className="subpanel" key={`${event.title}-${event.date}`}>
                <h3>{event.title}</h3>
                <p>
                  {new Date(event.date).toLocaleDateString()} - {event.city}
                </p>
                <p>{event.description}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No events announced yet.</p>
        )}
      </section>

      <section className="panel">
        <h2>Gallery</h2>
        <div className="gallery-grid">
          {charity.gallery.map((url) => (
            <img className="gallery-image" src={url} alt={charity.name} key={url} />
          ))}
        </div>
      </section>
    </div>
  );
}
