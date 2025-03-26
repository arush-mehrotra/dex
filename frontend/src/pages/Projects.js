import React, { useCallback, useEffect, useState } from "react";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import axios from "axios";
import Navbar from "../components/Navbar";
import ProjectCard from "../components/ProjectCard";
import { Power, AlertCircle, CheckCircle, Clock, Cloud, CloudOff, Server } from "lucide-react";
import CreateProjectPopup from "../components/CreateProjectPopup";

const Projects = () => {
  const { user, isLoading } = useAuth0();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [instanceStatus, setInstanceStatus] = useState("checking");
  const [instanceDetails, setInstanceDetails] = useState(null);
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
        setInstanceDetails(response.data.instance);
      } else if (response.data.instance && response.data.instance.status === "booting") {
        setInstanceStatus("loading");
        setInstanceDetails(response.data.instance);
      } else {
        setInstanceStatus("stopped");
        setInstanceDetails(null);
      }
    } catch (error) {
      console.error("Error checking instance status:", error);
      setInstanceStatus("stopped");
      setInstanceDetails(null);
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
      if (response.data.instance_status !== "launched" && 
          response.data.instance_status !== "existing") {
        // If the instance didn't start correctly, update the status
        setInstanceStatus("stopped");
        setError("Failed to start instance. Please try again later.");
      } else {
        // Success case - instance is launching or already exists
        // Even if IP isn't available yet, keep the loading status
        setInstanceStatus("loading");
        
        // Store any available instance details
        if (response.data.instanceIP) {
          setInstanceDetails({
            ip: response.data.instanceIP,
            region: response.data.region,
            type: response.data.instanceType,
            id: response.data.instanceId
          });
        }
      }
    } catch (error) {
      console.error("Error starting instance:", error);
      setError("Failed to start instance. Please try again later. Instance capacity may be full.");
      setInstanceStatus("stopped");
    }
  };

  const handleStopInstance = async () => {
    setInstanceStatus("loading");
    try {
      await axios.post("http://localhost:8000/lambda/stop_instance");
      setInstanceStatus("stopped");
      setInstanceDetails(null);
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

  const getStatusIcon = () => {
    switch (instanceStatus) {
      case "running":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "loading":
        return <Clock className="w-5 h-5 text-blue-500 animate-pulse" />;
      case "checking":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "stopped":
        return <CloudOff className="w-5 h-5 text-gray-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = () => {
    switch (instanceStatus) {
      case "running":
        return "bg-green-50 border-green-200 text-green-700";
      case "loading":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "checking":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "stopped":
        return "bg-gray-50 border-gray-200 text-gray-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  const getInstanceTypeLabel = () => {
    if (!instanceDetails || !instanceDetails.instance_type) return null;
    
    // Show the instance type if available
    return (
      <div className="text-xs flex items-center mt-1">
        <Server className="w-3 h-3 mr-1" />
        <span>{instanceDetails.instance_type.name || "GPU Instance"}</span>
      </div>
    );
  };

  const getRegionLabel = () => {
    if (!instanceDetails || !instanceDetails.region) return null;
    
    // Show the region if available
    return (
      <div className="text-xs flex items-center mt-1">
        <Cloud className="w-3 h-3 mr-1" />
        <span>{instanceDetails.region.name || "Unknown region"}</span>
      </div>
    );
  };

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
              className="bg-teal-500 text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-teal-600 shadow-sm"
            >
              <span>Create new project</span>
              <span className="bg-white text-teal-500 rounded-full h-6 w-6 flex items-center justify-center">
                +
              </span>
            </button>
          </div>
          <div className="flex gap-4 items-center">
            {/* Enhanced status badge */}
            <div className={`flex flex-col rounded-lg shadow-sm border px-4 py-2 ${getStatusColor()}`}>
              <div className="flex items-center">
                {getStatusIcon()}
                <div className="ml-2">
                  <div className="font-medium flex items-center">
                    <span>Instance:</span>
                    <span className="ml-1 capitalize">{instanceStatus === "checking" ? "Checking..." : instanceStatus === "loading" ? "Starting..." : instanceStatus}</span>
                  </div>
                  {instanceStatus === "running" && (
                    <div className="flex flex-col text-xs text-gray-600">
                      {getInstanceTypeLabel()}
                      {getRegionLabel()}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Enhanced action button */}
            <button
              onClick={
                instanceStatus === "stopped" ? handleStartInstance : handleStopInstance
              }
              disabled={instanceStatus === "checking" || instanceStatus === "loading"}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors duration-200 shadow-sm ${
                instanceStatus === "checking" || instanceStatus === "loading"
                  ? "bg-gray-300 cursor-not-allowed"
                  : instanceStatus === "stopped"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {instanceStatus === "checking"
                  ? "Checking..."
                  : instanceStatus === "loading"
                  ? "Processing..."
                  : instanceStatus === "stopped"
                  ? "Start Instance"
                  : "Stop Instance"}
              </span>
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
