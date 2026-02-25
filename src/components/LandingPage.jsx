
import { FcKindle, FcHeadset, FcFilm } from "react-icons/fc";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import logo from "../assets/Logo_landing.png";
import Footer from "./Footer";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="landing-root">
        <div className="landing-content">
          {/* Hero header: logo + title + subtitle */}
          <div className="landing-hero">
            <img
              src={logo}
              alt="MediaHub Logo"
              className="landing-logo"
              loading="eager"
            />
            <h2 className="landing-title">Manage. Master. MediaHub</h2>
            <p className="landing-subtitle">
              Quality digital content, available anytime, anywhere.
            </p>
          </div>

          {/* Action cards */}
          <div className="card-row">
            <button
              className="glass-card border-anim"
              onClick={() => navigate("/videos")}
              aria-label="Go to Videos"
            >
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>

              <FcFilm className="card-image" />
              <span className="card-label"></span>
            </button>

            <button
              className="glass-card border-anim"
              onClick={() => navigate("/podcast")}
              aria-label="Open Podcasts"
            >
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>

              <FcHeadset className="card-image" />
              <span className="card-label"></span>
            </button>

            <button
              className="glass-card border-anim"
              onClick={() => navigate("/articles")}
              aria-label="Go to Articles"
            >
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>
              <span aria-hidden="true"></span>

              <FcKindle className="card-image" />
              <span className="card-label"></span>
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
