import React, { useContext } from 'react';
import './navbar.css';
import { IoSearchOutline } from "react-icons/io5";
import { PiUserCircleLight } from "react-icons/pi";
import logo from '../assets/Logo_landing.png';
import { useNavigate,useLocation } from 'react-router-dom';
import { UserContext } from "../context/userContext.jsx";


export default function NavbarUser() {

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(UserContext);

  const handleProfileClick = () => { 
    navigate("/profile", { state: { from: location.pathname } }); 
  };
  return (
    <nav className="nav">
      <div className="nav-left">
        <a href="/" className="logo-link">
          <img src={logo} alt="Logo" className="logo-img" />
        </a>
      </div>

      <div className="nav-center">
        <form className="search-form">
          <input
            type="search"
            className="search-input"
            placeholder="Search content, subscriptions"
            aria-label="Search"
          />
          <button type="submit" className="search-btn">
            <IoSearchOutline />
            </button>

        </form>
      </div>

      <div className="nav-right">
        {user?.loggedIn && user?.role === 'admin' && (
          <button onClick={() => navigate('/adminDashboard')} className="admin-btn">
            Admin
          </button>
        )}
        <span className="nav-greeting">Hello {user?.name || user?.username || 'User'}</span>
        <button onClick={handleProfileClick} className='logged-in' aria-label="Open profile">
            <PiUserCircleLight />
        </button>
      </div>
    </nav>
  );
}
