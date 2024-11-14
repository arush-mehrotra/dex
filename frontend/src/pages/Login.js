import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle, faFacebook, faApple } from '@fortawesome/free-brands-svg-icons';

function Login() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="bg-white shadow-lg rounded-lg flex w-3/4 max-w-4xl">
        
        {/* Login Section */}
        <div className="w-1/2 p-10">
          <h2 className="text-3xl font-bold mb-4 text-center">Login to your account</h2>
          <p className="text-gray-500 mb-4 text-center">Login using SSO</p>

          {/* SSO Dots */}
          <div className="flex justify-center space-x-3 mb-6">
            <FontAwesomeIcon icon={faGoogle} size="2x" className="text-teal-500" />
            <FontAwesomeIcon icon={faFacebook} size="2x" className="text-teal-500" />
            <FontAwesomeIcon icon={faApple} size="2x" className="text-teal-500" />
          </div>

          {/* Login Form */}
          <form>
            <input 
              type="email" 
              placeholder="Email Address" 
              className="w-full p-3 border rounded-md mb-4 bg-gray-200 focus:outline-none focus:border-teal-500" 
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="w-full p-3 border rounded-md mb-6 bg-gray-200 focus:outline-none focus:border-teal-500" 
            />
            <button 
              type="submit" 
              className="w-full bg-teal-500 text-white p-3 rounded-md font-semibold hover:bg-teal-600"
            >
              Log In
            </button>
          </form>
        </div>

        {/* Sign Up Section */}
        <div className="w-1/2 p-10 bg-gray-50 flex flex-col items-center justify-center border-l border-gray-200">
          <h2 className="text-2xl font-semibold mb-4">New User?</h2>
          <p className="text-gray-500 mb-6 text-center">
            Sign up for dex.ai today and begin your drone exploration journey!
          </p>
          <button 
            className="bg-teal-500 text-white px-6 py-2 rounded-md font-semibold hover:bg-teal-600"
          >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
