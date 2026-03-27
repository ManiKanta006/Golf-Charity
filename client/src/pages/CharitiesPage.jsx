import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

export default function CharitiesPage() {
  const [search, setSearch] = useState("");
  const [charities, setCharities] = useState([]);

  const load = async (query = "") => {
    const rows = await api.getCharities(query);
    setCharities(rows);
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    await load(search);
  };

  return (
    <div className="stack gap-lg">
      <section className="panel">
        <h1>Charity Directory</h1>
        <form className="search-row" onSubmit={onSubmit}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search charities"
          />
          <button className="btn btn-primary" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="grid three">
        {charities.map((charity) => (
          <article className="panel charity-card" key={charity.id}>
            {charity.image_url && (
              <img className="charity-card-image" src={charity.image_url} alt={charity.name} />
            )}
            <p className="eyebrow">{charity.featured ? "Featured" : "Active"}</p>
            <h2>{charity.name}</h2>
            <p>{charity.description}</p>
            <Link className="btn btn-ghost" to={`/charities/${charity.id}`}>
              View Profile
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
