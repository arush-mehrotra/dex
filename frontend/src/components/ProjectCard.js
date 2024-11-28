import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

const ProjectCard = ({ project, onDelete }) => {
  const { user } = useAuth0();
  const [showDetails, setShowDetails] = useState(false);
  const [objFileUrl, setObjFileUrl] = useState(null); // URL of the .obj file
  const [objFileStatus, setObjFileStatus] = useState("loading"); // 'loading', 'available', 'unavailable'
  const navigate = useNavigate();
  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the project "${project}"?`)) {
      onDelete(project);
    }
  };
  const fetchProjectFiles = async (userId, projectName) => {
    try {
      const response = await fetch(`http://localhost:8000/s3/projects/${userId}/${projectName}/files`);
      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Fetched project files:", data.files);
      return data.files; // Returns the array of files
    } catch (error) {
      console.error("Error fetching project files:", error);
      return [];
    }
  };

  useEffect(() => {
    if (showDetails && user) {
      setObjFileStatus("loading"); // Set loading state while fetching
      fetchProjectFiles(user.sub, project)
        .then((fileList) => {
          const objFile = fileList.find((file) => file.fileName.endsWith(".obj"));
          if (objFile) {
            setObjFileUrl(objFile.url);
            setObjFileStatus("available");
          } else {
            setObjFileStatus("unavailable");
          }
        })
        .catch((error) => {
          console.error("Error fetching files:", error);
          setObjFileStatus("unavailable"); // Handle error case
        });
    }
  }, [showDetails, user, project]);

  const handleViewRendering = () => {
    if (objFileUrl) {
      const renderingUrl = `/rendering?objFileUrl=${encodeURIComponent(objFileUrl)}`;
      window.open(renderingUrl, "_blank"); // Open the rendering view in a new tab
    }
  };

  return (
    <div className="max-w-sm w-full bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition-shadow duration-200">
      <h2 className="text-xl font-semibold text-teal-600">{project}</h2>
      <button
        onClick={toggleDetails}
        className="mt-4 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors duration-200 mr-2"
      >
        {showDetails ? "Hide Details" : "View Details"}
      </button>
      <button
        onClick={handleDelete}
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
      >
        Delete Project
      </button>
      {showDetails && (
        <div className="mt-4 p-3 border-t border-gray-200 text-gray-700">
          <p><strong>Created On:</strong> {project.createdOn || "Unknown date"}</p>

          {objFileStatus === "loading" && <p className="text-gray-500 mt-2">Loading...</p>}
          {objFileStatus === "available" && (
            <button
              onClick={handleViewRendering}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
            >
              View 3D Rendering
            </button>
          )}
          {objFileStatus === "unavailable" && (
            <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200">
              Train 3D Model
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectCard;
