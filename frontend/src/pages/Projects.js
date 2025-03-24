import React, { useCallback, useEffect, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import axios from "axios";
import Navbar from "../components/Navbar";
import ProjectCard from "../components/ProjectCard";
import { Power } from "lucide-react";
import CreateProjectPopup from "../components/CreateProjectPopup";

const Projects = () => {
  const { user, isLoading } = useAuth0();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [instanceStatus, setInstanceStatus] = useState("checking");
  const [showPopup, setShowPopup] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user) {
      console.error("User not available");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const userId = user.sub.split("|")[1];
      const response = await axios.get(`http://localhost:8000/s3/projects/${userId}`);
      setProjects(response.data.projects || []);
      setError("");
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError("Failed to load projects. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const checkInstanceStatus = useCallback(async () => {
    try {
      const response = await axios.get("http://localhost:8000/lambda/check_instance");
      if (response.data.instance && response.data.instance.status === "active") {
        setInstanceStatus("running");
      } else if (response.data.instance && response.data.instance.status === "booting") {
        setInstanceStatus("loading");
      } else {
        setInstanceStatus("stopped");
      }
    } catch (error) {
      console.error("Error checking instance status:", error);
      setInstanceStatus("stopped");
    }
  }, []);

  const handleDelete = async (projectName) => {
    if (!user || !projectName) {
      console.error("Missing user information or project name");
      return;
    }

    try {
      const userId = user.sub.split("|")[1];
      await axios.delete(`http://localhost:8000/s3/projects/${userId}/${projectName}`);
      setProjects(projects.filter((project) => project !== projectName));
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete the project. Please try again later.");
    }
  };

  const handleStartInstance = async () => {
    setInstanceStatus("loading");
    try {
      const response = await axios.post("http://localhost:8000/lambda/start_instance");
      if (
        response.data.instance_status === "launched" ||
        response.data.instance_status === "existing"
      ) {
        const intervalId = setInterval(async () => {
          try {
            const checkResponse = await axios.get("http://localhost:8000/lambda/check_instance");
            if (checkResponse.data.instance && checkResponse.data.instance.status === "active") {
              setInstanceStatus("running");
              clearInterval(intervalId);
            }
          } catch (error) {
            console.error("Error polling instance status:", error);
          }
        }, 30000); // Check every 5 seconds
        // Clear interval after 5 minutes maximum (prevent infinite polling)
        setTimeout(() => {
          clearInterval(intervalId);
          checkInstanceStatus();
        }, 300000);
      }
    } catch (error) {
      console.error("Error starting instance:", error);
      setError("Failed to start instance. Please try again later.");
      setInstanceStatus("stopped");
    }
  };

  const handleStopInstance = async () => {
    setInstanceStatus("loading");
    try {
      await axios.post("http://localhost:8000/lambda/stop_instance");
      setInstanceStatus("stopped");
    } catch (error) {
      console.error("Error stopping instance:", error);
      setError("Failed to stop instance. Please try again later.");
      setInstanceStatus("running");
    }
  };

  const togglePopup = () => {
    setShowPopup(!showPopup);
  };

  const handleCreateProject = async (projectName, file) => {
    await fetchProjects();
    setShowPopup(false);
  };

  useEffect(() => {
    if (user && user.sub) {
      checkInstanceStatus();
      fetchProjects();
      const statusCheckInterval = setInterval(() => {
        if (instanceStatus === "loading") {
          checkInstanceStatus();
        }
      }, 30000);
      return () => clearInterval(statusCheckInterval);
    }
  }, [user, instanceStatus, fetchProjects, checkInstanceStatus]);

  if (isLoading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  return (
    <div>
      <Navbar />
      <div className="p-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Your Projects</h1>
            <button
              onClick={togglePopup}
              className="bg-teal-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-600"
            >
              <span>Create new project</span>
              <span className="bg-white text-teal-500 rounded-full h-6 w-6 flex items-center justify-center">
                +
              </span>
            </button>
          </div>
          <div className="flex gap-4 items-center">
            <span
              className={`px-3 py-1 rounded-full text-sm ${
                instanceStatus === "checking"
                  ? "bg-yellow-100 text-yellow-800"
                  : instanceStatus === "running"
                  ? "bg-green-100 text-green-800"
                  : instanceStatus === "loading"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              Instance:{" "}
              {instanceStatus === "checking"
                ? "Checking..."
                : instanceStatus === "loading"
                ? "Loading..."
                : instanceStatus}
            </span>
            <button
              onClick={
                instanceStatus === "stopped" ? handleStartInstance : handleStopInstance
              }
              disabled={instanceStatus === "checking" || instanceStatus === "loading"}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 ${
                instanceStatus === "checking" || instanceStatus === "loading"
                  ? "bg-gray-300 cursor-not-allowed"
                  : instanceStatus === "stopped"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              <Power className="w-4 h-4" />
              {instanceStatus === "checking"
                ? "Checking..."
                : instanceStatus === "loading"
                ? "Processing..."
                : instanceStatus === "stopped"
                ? "Start Instance"
                : "Stop Instance"}
            </button>
          </div>
        </div>

        {loading ? (
          <div>Loading projects...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : projects.length > 0 ? (
          <div className="flex flex-wrap items-start gap-8">
            {projects.map((project) => (
              <ProjectCard
                key={project}
                project={project}
                onDelete={handleDelete}
                instanceRunning={instanceStatus === "running"}
              />
            ))}
          </div>
        ) : (
          <div>No projects found. Start creating one!</div>
        )}
      </div>

      <CreateProjectPopup
        isOpen={showPopup}
        onClose={togglePopup}
        onCreate={handleCreateProject}
      />
    </div>
  );
};

export default withAuthenticationRequired(Projects, {
  onRedirecting: () => <p className="text-center mt-10">Loading authentication...</p>,
});
