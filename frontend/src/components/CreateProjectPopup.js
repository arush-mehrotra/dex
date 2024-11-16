import React, { useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";

const CreateProjectPopup = ({ isOpen, onClose, onCreate }) => {
  const { user } = useAuth0();
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!projectName || !file) {
      alert("Please fill out all fields!");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectName", projectName);
    formData.append("userId", user.sub); 

    try {
      // Upload the file to the backend (S3)
      const response = await axios.post("http://localhost:8000/s3/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setUploadMessage(response.data.message || "File uploaded successfully!");
      console.log("File uploaded:", response.data);

      // Notify parent component of the new project
      onCreate(projectName, response.data);

      // Reset form fields
      setProjectName("");
      setFile(null);
      setUploadMessage("");
      onClose();
    } catch (error) {
      console.error("Error uploading file:", error);
      setUploadMessage("Error uploading file. Check the console for details.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-96">
        <h2 className="text-xl font-semibold mb-4">Create New Project</h2>
        <form onSubmit={handleFormSubmit}>
          <div className="mb-4">
            <label
              htmlFor="projectName"
              className="block text-gray-700 font-medium mb-2"
            >
              Project Name
            </label>
            <input
              type="text"
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full border-gray-300 rounded-lg shadow-sm p-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Enter project name"
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="fileUpload"
              className="block text-gray-700 font-medium mb-2"
            >
              Upload Dataset
            </label>
            <input
              type="file"
              id="fileUpload"
              onChange={handleFileChange}
              className="w-full"
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600"
            >
              Create
            </button>
          </div>
        </form>
        {uploadMessage && (
          <p className="mt-4 text-center text-green-500">{uploadMessage}</p>
        )}
      </div>
    </div>
  );
};

export default CreateProjectPopup;
