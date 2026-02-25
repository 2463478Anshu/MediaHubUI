import React from "react";
import "./Footer.css";
import { MdEmail, MdPhone, MdLocationOn } from "react-icons/md";
import { FaGithub, FaLinkedin, FaGlobe } from "react-icons/fa";

export default function Footer() {
  return (
    <footer className="site-footer" role="contentinfo">
      <div className="footer-inner">
        {/* Brand */}
        <div className="footer-brand">
          <h3 className="footer-title">MediaHub</h3>
          <p className="footer-tagline">
            Quality digital content, available anytime.
          </p>
        </div>

        {/* Contact */}
        <div className="footer-contact">
          <h4 className="footer-section-title">Contact</h4>
          <ul className="contact-list">
            <li>
              <MdEmail aria-hidden="true" />
              <a href="mailto:support@mediahub.example">support@mediahub.example</a>
            </li>
            <li>
              <MdPhone aria-hidden="true" />
              <a href="tel:+919876543210">+91 98765 43210</a>
            </li>
            <li>
              <MdLocationOn aria-hidden="true" />
              <span>Chennai, TN</span>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div className="footer-links">
          <h4 className="footer-section-title">Links</h4>
          <ul className="links-list">
            <li>
              <FaGlobe aria-hidden="true" />
              <a href="/" aria-label="Visit MediaHub Home">Home</a>
            </li>
            <li>
              <FaGithub aria-hidden="true" />
              <a
                href="https://github.com/2463478Anshu/digital-content-management-and-subscription-platform"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </li>
            <li>
              <FaLinkedin aria-hidden="true" />
              <a
                href="https://www.linkedin.com/company/your-company"
                target="_blank"
                rel="noopener noreferrer"
              >
                LinkedIn
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <p className="footer-copy">
          © {new Date().getFullYear()} MediaHub. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

