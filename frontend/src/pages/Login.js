import React from 'react';
import LoginButton from '../components/LoginButton';

function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg flex w-full max-w-md p-10 flex-col items-center">
        
        <h2 className="text-3xl font-bold mb-4 text-center">Login to your account</h2>
        <p className="text-gray-500 mb-6 text-center">Sign in securely using Auth0</p>

        {/* Auth0 Login Button */}
        <LoginButton />
        
      </div>
    </div>
  );
}

export default Login;
