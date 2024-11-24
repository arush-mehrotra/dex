import React, { useCallback, useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import Navbar from "../components/Navbar";
import ProjectCard from "../components/ProjectCard";

const Projects = () => {
  const { user, isAuthenticated, isLoading, loginWithRedirect } = useAuth0();
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`http://localhost:8000/s3/projects/${user.sub}`);
      setProjects(response.data.projects || []);
      setError("");
    } catch (error) {
      console.error("Error fetching projects:", error);
      setError("Failed to load projects. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleDelete = async (projectName) => {
    if (!user || !projectName) {
      console.error("Missing user information or project name");
      return;
    }

    try {
      await axios.delete(`http://localhost:8000/s3/projects/${user.sub}/${projectName}`);
      setProjects(projects.filter((project) => project !== projectName));
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete the project. Please try again later.");
    }

  }

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      loginWithRedirect(); // Redirect to the login page if not authenticated
    } else if (user) {
      fetchProjects();
    }
  }, [isLoading, isAuthenticated, user, fetchProjects, loginWithRedirect]);

  if (isLoading) {
    return <p className="text-center mt-10">Loading...</p>;
  }

  return (
    <div>
      <Navbar />
      <div className="container mx-auto mt-8 p-4">
        <h1 className="text-2xl font-bold mb-4">Your Projects</h1>
        {loading ? (
          <div>Loading projects...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : projects.length > 0 ? (
          <ul className="list-disc">
            {projects.map((project, index) => (
              <ProjectCard project={project} onDelete={handleDelete} />
            ))}
          </ul>
        ) : (
          <div>No projects found. Start creating one!</div>
        )}
      </div>
    </div>
  );
};

export default Projects;
