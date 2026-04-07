import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="border-t border-white/10 px-4 py-10 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-lg font-semibold uppercase tracking-[0.35em] text-white">
            DeepTrust
          </p>
          <p className="mt-2 text-sm text-white/45">
            AI fake news and media verification built for decisive action.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm uppercase tracking-[0.2em] text-white/55">
          <Link to="/">Home</Link>
          <Link to="/check">Check</Link>
          <Link to="/reputation">Reputation</Link>
          <Link to="/complaint">Complaint</Link>
          <Link to="/auth">Auth</Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
