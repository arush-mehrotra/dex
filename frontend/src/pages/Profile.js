import {React, useEffect} from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Navbar from '../components/Navbar';

const Profile = () => {
  const { user, isAuthenticated, loginWithRedirect, isLoading } = useAuth0();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect();
    }
  }, [isLoading, isAuthenticated, loginWithRedirect]);

  if (isLoading) {
    return <p className="text-center mt-10">Loading...</p>; // Display a loading message while checking authentication status
  }

  if (!isAuthenticated) {
    return null; // Return null to prevent rendering the page content while redirecting
  }

  return (
    <div>
      <Navbar />
      <div className="flex flex-col items-center p-10">
        <h1 className="text-3xl font-bold mb-6">Profile</h1>
        <div className="w-full max-w-md bg-white shadow-lg rounded-lg p-6 flex flex-col items-center">
          {user.picture && (
            <img
              src={user.picture}
              alt="Profile"
              className="rounded-full w-32 h-32 mb-4"
            />
          )}
          <h2 className="text-xl font-semibold">{user.name}</h2>
          <p className="text-gray-500">{user.email}</p>
        </div>
      </div>
    </div>
  );
};

export default Profile;
