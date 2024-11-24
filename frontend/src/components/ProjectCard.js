import React, { useState } from "react";

const ProjectCard = ({ project, onDelete }) => {
  const [showDetails, setShowDetails] = useState(false);

  const toggleDetails = () => {
    setShowDetails(!showDetails);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the project "${project}"?`)) {
      onDelete(project); 
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
          <p><strong>Description:</strong> {project.description || "No additional details provided."}</p>
          <p><strong>Created On:</strong> {project.createdOn || "Unknown date"}</p>
          <p><strong>Status:</strong> {project.status || "No status available."}</p>
        </div>
      )}
    </div>
  );
};

export default ProjectCard;