import React, { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

const ProjectCard = ({ project, onDelete }) => {
  const { user } = useAuth0();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [objFileUrl, setObjFileUrl] = useState(null);
  const [objFileStatus, setObjFileStatus] = useState("loading");
  const navigate = useNavigate();

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
      return data.files;
    } catch (error) {
      console.error("Error fetching project files:", error);
      return [];
    }
  };

  useEffect(() => {
    if (isModalOpen && user) {
      setObjFileStatus("loading");
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
          setObjFileStatus("unavailable");
        });
    }
  }, [isModalOpen, user, project]);

  const handleViewRendering = () => {
    if (objFileUrl) {
      const renderingUrl = `/rendering?objFileUrl=${encodeURIComponent(objFileUrl)}`;
      window.open(renderingUrl, "_blank");
    }
  };

  return (
    <>
      <div className="bg-white shadow-md rounded-lg p-4 hover:shadow-lg transition-shadow duration-200">
        <h2 className="text-xl font-semibold text-teal-600">{project}</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors duration-200 mr-2"
        >
          View Details
        </button>
        <button
          onClick={handleDelete}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors duration-200"
        >
          Delete Project
        </button>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-teal-600">{project} Details</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <div className="mt-4 text-gray-700">
              <p><strong>Created On:</strong> {project.createdOn || "Unknown date"}</p>

              {objFileStatus === "loading" && (
                <p className="text-gray-500 mt-2">Loading...</p>
              )}
              {objFileStatus === "available" && (
                <button
                  onClick={handleViewRendering}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
                >
                  View 3D Rendering
                </button>
              )}
              {objFileStatus === "unavailable" && (
                <button className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200">
                  Train 3D Model
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectCard;
