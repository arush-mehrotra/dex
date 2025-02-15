import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import Navbar from "../components/Navbar";
import CreateProjectPopup from "../components/CreateProjectPopup";
import HowItWorks from "../components/HowItWorks";

const Home = () => {
  const { user, isAuthenticated, loginWithRedirect, isLoading } = useAuth0();
  const [showPopup, setShowPopup] = useState(false);

  const togglePopup = () => {
    setShowPopup(!showPopup);
  };

  const handleCreateProject = (projectName, file) => {
    // Simulate project creation
    alert(`Project "${projectName}" created successfully!`);
    console.log("Uploaded file:", file);
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  if (isLoading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      <Navbar />
      <div className="flex justify-between items-center p-10">
        <h1 className="text-2xl font-semibold">Welcome back, {user.name}!</h1>
        <button
          onClick={togglePopup}
          className="bg-teal-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-600"
        >
          <span>Create new project</span>
          <span className="bg-white text-teal-500 rounded-full h-6 w-6 flex items-center justify-center">
            +
          </span>
        </button>
      </div>

      <div className="px-10 py-6">
        <HowItWorks />
      </div>

      {/* Popup Component */}
      <CreateProjectPopup
        isOpen={showPopup}
        onClose={togglePopup}
        onCreate={handleCreateProject}
      />
    </div>
  );
};

export default Home;
