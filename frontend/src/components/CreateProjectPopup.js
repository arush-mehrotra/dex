import React, { useState, useEffect, useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";

const CreateProjectPopup = ({ isOpen, onClose, onCreate }) => {
  const { user } = useAuth0();
  const [projectName, setProjectName] = useState("");
  const [file, setFile] = useState(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [existingProjects, setExistingProjects] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const fetchExistingProjects = useCallback(async () => {
    try {
      const userId = user.sub.split('|')[1];
      const response = await axios.get(`http://localhost:8000/s3/projects/${userId}`);
      setExistingProjects(response.data.projects || []);
    } catch (error) {
      console.error("Error fetching existing projects:", error);
      setExistingProjects([]);
    }
  }, [user.sub]);

  useEffect(() => {
    if (isOpen) {
      fetchExistingProjects();
    }
  }, [isOpen, fetchExistingProjects]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith(".zip")) {
      setFile(selectedFile);
      setUploadMessage(""); // Clear any previous error messages
    } else {
      setFile(null);
      setUploadMessage("Please upload a valid .zip file.");
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!projectName || !file) {
      setErrorMessage("Please fill out all fields.");
      return;
    }

    if (existingProjects.includes(projectName)) {
      setErrorMessage("A project with this name already exists. Please choose a different name.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectName", projectName);
    formData.append("userId", user.sub.split('|')[1]);

    try {
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
      setErrorMessage("");
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
              onChange={(e) => {
                setProjectName(e.target.value);
                setErrorMessage(""); // Clear error message on input change
              }}
              className="w-full border-gray-300 rounded-lg shadow-sm p-2 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Enter project name"
            />
          </div>
          {errorMessage && (
            <p className="text-red-500 text-sm mb-4">{errorMessage}</p>
          )}
          <div className="mb-4">
            <label
              htmlFor="fileUpload"
              className="block text-gray-700 font-medium mb-2"
            >
              Upload Dataset (.zip)
            </label>
            <input
              type="file"
              id="fileUpload"
              accept=".zip"
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