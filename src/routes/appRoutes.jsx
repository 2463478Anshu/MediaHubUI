import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignUp from "../components/login/signup";
import Login from "../components/login/login";
import Podcast from "../components/mediaButtons/podcast";
import LandingPage from "../components/LandingPage";
import Articles from "../components/mediaButtons/articles";
import UserProfile from "../components/login/userProfile";
import Videos from "../components/mediaButtons/Videos";
import EditProfile from "../components/login/editProfile";
import Profile from "../components/login/userProfile";
import Publishing from "../components/publishing";
import Subscription from "../components/Subscription";
import VideoPage from "../components/mediaButtons/videoPage";
import Payment from "../components/PaymentPage";
import PodcastPlayer from "../components/mediaButtons/PodcastPlayer";
import SearchResults from "../components/SearchResults.jsx";

import ForgotPassword from "../components/login/ForgotPassword.jsx";
import ArticleViewerPage from "../components/mediaButtons/ArticleViewerPage.jsx";
import MediaLibrary from "../pages/admin/MediaLibrary.jsx";


import AdminDashboard from "../pages/admin/AdminDashboard";

export default function AppRoutes({ setLoggedIn }) {
  return (
    <>
       <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login setLoggedIn={setLoggedIn}/>} />
        <Route path="/signup" element={<SignUp setLoggedIn={setLoggedIn}/>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/podcast" element={<Podcast/>} />
        <Route path="/podcast/:id" element={<PodcastPlayer />} />
        <Route path="/articles" element={<Articles/>}/>
        <Route path="/articles/:id" element={<ArticleViewerPage />} />

        <Route path="/videos" element={<Videos/>}/>
        <Route path="/edit-profile" element={<EditProfile />} />
        <Route path="/profile" element={<Profile setLoggedIn={setLoggedIn} />} />
        <Route path="/publishing" element={<Publishing/>}/>
        <Route path="/subscription" element={<Subscription/>}/>
        <Route path="/payment" element={<Payment />} />
        <Route path="/videos/:id" element={<VideoPage />} />
        <Route path="/adminDashboard" element={<AdminDashboard />} />
        <Route path="/PodcastPlayer" element={<PodcastPlayer />} />
        <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/media-library" element={<MediaLibrary />} />

      </Routes>
    </>
  );
}
