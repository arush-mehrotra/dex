import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Navbar from '../components/Navbar';

const Home = () => {
  const { user, isAuthenticated } = useAuth0();

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
