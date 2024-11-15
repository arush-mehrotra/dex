import axios from 'axios';
import { React, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Navbar from '../components/Navbar';

const Home = () => {
  const { user, isAuthenticated, loginWithRedirect, isLoading } = useAuth0();
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');

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

  // Handle file selection
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  // Handle file upload to backend
  const handleFileUpload = async () => {
    if (!file) {
      alert("Please select a file first!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("http://localhost:8000/s3/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });
      setUploadMessage(response.data.message || "File uploaded successfully!");
      console.log("Response:", response.data);
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadMessage("Error uploading file. Check the console for details.");
    }
  };

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
      <div>
        <input type="file" onChange={handleFileChange} />
        <button onClick={handleFileUpload}>Upload File</button>
        <p>{uploadMessage}</p>
      </div>
    </div>
  );
};

export default Home;
