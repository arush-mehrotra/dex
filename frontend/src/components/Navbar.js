import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth0();

  return (
    <nav className="flex items-center justify-between px-10 py-4 border-b">
      {/* Left-aligned links */}
      <div className="flex space-x-4">
        <Link to="/" className="text-teal-500 font-semibold">
          Home
        </Link>
        <Link to="/projects" className="font-semibold hover:underline">
          My Projects
        </Link>
      </div>

      {/* Right-aligned buttons */}
      {isAuthenticated && (
        <div className="flex items-center space-x-4">
          <Link to="/profile" className="font-semibold hover:underline">
            Profile
          </Link>
          <button
            onClick={() => logout({ returnTo: window.location.origin })}
            className="bg-teal-500 text-white px-4 py-2 rounded-md font-semibold hover:bg-teal-600"
          >
            Log Out
          </button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
