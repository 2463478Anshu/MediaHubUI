import { Link } from "react-router-dom";
import React, { useContext } from "react";
import "./sidebar.css";
import { UserContext } from "../context/userContext.jsx";
import { PiHouse } from "react-icons/pi";
import { AiOutlinePlayCircle } from "react-icons/ai";
import { AiOutlineAudio } from "react-icons/ai";
import { IoNewspaperOutline } from "react-icons/io5";
import { PiCrownSimple } from "react-icons/pi";
import { HiOutlinePlusCircle } from "react-icons/hi2";
import Logo_nav from '../assets/Logo_nav.png';

export default function Sidebar() {
  const { user } = useContext(UserContext);

  const isAdmin = user?.role === "admin";
  const isUser = user?.role === "user";

  return (
    <div className="sidebar">
      <ul>
        <li>
          <div className="logo">
            <a href="/" className="logo-link">
              <img src={Logo_nav} alt="Logo" className="logo-img" />     
            </a>
          </div>
        </li>

        <li>
          <div className="icons">
            <Link to="/"><PiHouse /><h6>Home</h6></Link>
          </div>
        </li>

        <li>
          <div className="icons">
            <Link to="/videos"><AiOutlinePlayCircle /><h6>Videos</h6></Link>
          </div>
        </li>

        <li>
          <div className="icons">
            <Link to="/podcast"><AiOutlineAudio /><h6>Podcast</h6></Link>
          </div>
        </li>

        <li>
          <div className="icons">
            <Link to="/articles"><IoNewspaperOutline /><h6>Articles</h6></Link>
          </div>
        </li>

        {user?.loggedIn && (
          <>
            {/* Subscription only visible for non-admin users */}
            {!isAdmin && (
              <li>
                <div className="icons">
                  <Link to="/subscription">
                    <PiCrownSimple />
                    <h6>Subscription</h6>
                  </Link>
                </div>
              </li>
            )}

            {/* Publish only visible for admins */}
            {isAdmin && (
              <li>
                <div className="icons">
                  <Link to="/publishing">
                    <HiOutlinePlusCircle />
                    <h6>Publish</h6>
                  </Link>
                </div>
              </li>
            )}
          </>
        )}
      </ul>
    </div>
  );
}
