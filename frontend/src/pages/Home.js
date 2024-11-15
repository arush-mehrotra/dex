import {React, useEffect} from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Navbar from '../components/Navbar';

const Home = () => {
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
      <div className="p-10">
        {isAuthenticated ? (
          <h1 className="text-2xl font-semibold">
            Welcome back, {user.name}!
          </h1>
        ) : (
          <h1 className="text-2xl font-semibold">
            Welcome to dex.ai!
          </h1>
        )}
      </div>
    </div>
  );
};

export default Home;
