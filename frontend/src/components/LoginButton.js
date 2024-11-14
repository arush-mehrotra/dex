import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LoginButton = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <button
      onClick={() => loginWithRedirect()}
      className="bg-teal-500 text-white px-6 py-2 rounded-md font-semibold hover:bg-teal-600"
    >
      Log In
    </button>
  );
};

export default LoginButton;
