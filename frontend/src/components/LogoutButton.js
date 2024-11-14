import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LogoutButton = () => {
    const { logout } = useAuth0();

  return (
    <button
      onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
      className="bg-teal-500 text-white px-6 py-2 rounded-md font-semibold hover:bg-teal-600"
    >
      Log Out
    </button>
  );
};

export default LogoutButton;
