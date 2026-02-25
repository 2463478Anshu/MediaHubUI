import React, { useContext, useState } from 'react';
import './navbar.css';
import { IoSearchOutline } from "react-icons/io5";
import { PiUserCircleLight } from "react-icons/pi";
import { useNavigate, useLocation } from 'react-router-dom';
import { UserContext } from "../context/userContext.jsx";

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(UserContext);

  const [searchTerm, setSearchTerm] = useState("");

  const handleSignInClick = () => {
    navigate("/login", { state: { from: location.pathname } });
  };

  const handleSignUpClick = () => {
    navigate("/signup", { state: { from: location.pathname } });
  };

  const handleProfileClick = () => {
    navigate("/profile", { state: { from: location.pathname } });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/search?category=${encodeURIComponent(searchTerm.trim())}`);
    }
  };

  return (
    <nav className="nav">
      <div className="nav-center">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="search"
            className="search-input"
            placeholder="Search by category…"
            aria-label="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button type="submit" className="search-btn">
            <IoSearchOutline color="#63e" size={25} />
          </button>
        </form>
      </div>

      <div className="nav-right">
        {user.loggedIn ? (
          <>
            {(() => {
              const displayName =
                (user.name && user.name.trim()) ||
                (user.username && user.username.trim()) ||
                (user.email && user.email.split("@")[0]) ||
                'User';
              return (
                <span className="nav-greeting">
                  <b>Hello, {displayName} 👨‍💻</b>
                </span>
              );
            })()}
            <button
              onClick={handleProfileClick}
              className="logged-in"
              aria-label="Open profile"
            >
              <PiUserCircleLight color="#63e" size={30} />
            </button>
          </>
        ) : (
          <>
            <button onClick={handleSignInClick} className="signin">
              Log In
            </button>
            <button onClick={handleSignUpClick} className="signup">
              Sign Up
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
