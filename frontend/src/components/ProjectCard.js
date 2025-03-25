import React, { useState, useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import { io } from "socket.io-client";

const ProjectCard = ({ project, onDelete, instanceRunning }) => {
  const { user } = useAuth0();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [splatFileUrl, setObjFileUrl] = useState(null);
  const [splatFileStatus, setObjFileStatus] = useState("loading");
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState({
    step: '',
    status: '',
    message: '',
    startTime: null
  });
  const socketRef = useRef(null);

  // Initialize socket connection when component mounts
  useEffect(() => {
    // Only create the socket if the user is logged in
    if (user) {
      const socket = io("http://localhost:8000", {
        withCredentials: true
      });
      socketRef.current = socket;

      // Set up event listeners for the socket
      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
      });

      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });

      socket.on("trainingStatus", (data) => {
        console.log("Training status update:", data);
        setTrainingProgress(prev => ({
          ...prev,
          step: data.step,
          status: data.status,
          message: data.message
        }));

        // If final step is completed, update the UI accordingly
        if (data.step === 'final' && data.status === 'completed') {
          setIsTraining(false);
          
          // Update the splat file URL if it's available
          if (data.splatPath) {
            const bucketName = process.env.REACT_APP_S3_BUCKET_NAME || 'dex-model-storage';
            const splatFileUrl = `https://${bucketName}.s3.amazonaws.com/${data.splatPath}`;
            setObjFileUrl(splatFileUrl);
            setObjFileStatus("available");
          }
        }

        // If there's an error, stop training
        if (data.status === 'error') {
          setIsTraining(false);
        }
      });

      // Clean up the socket when component unmounts
      return () => {
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
      };
    }
  }, [user]);

  // Subscribe to training updates for this project when modal opens
  useEffect(() => {
    if (isModalOpen && user && socketRef.current) {
      const userId = user.sub.split('|')[1];
      
      // Subscribe to updates for this specific project
      socketRef.current.emit('subscribe', {
        userId: userId,
        projectId: project
      });
      
      return () => {
        // No specific cleanup needed here since we maintain the socket
        // connection at the component level
      };
    }
  }, [isModalOpen, user, project]);

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the project "${project}"?`)) {
      onDelete(project);
    }
  };

  const fetchProjectFiles = async (userId, projectName) => {
    try {
      const userId = user.sub.split('|')[1];
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
      fetchProjectFiles( user.sub.split('|')[1], project)
        .then((fileList) => {
          const splatFile = fileList.find((file) => file.fileName.endsWith(".splat"));
          if (splatFile) {
            setObjFileUrl(splatFile.url);
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
    if (splatFileUrl) {
      const renderingUrl = `https://antimatter15.com/splat/?url=${encodeURIComponent(splatFileUrl)}`;
      window.open(renderingUrl, "_blank");
    }
  };

  const handleTrain = async () => {
    setIsTraining(true);
    setTrainingProgress({
      step: 'starting',
      status: 'running',
      message: 'Initializing training process...',
      startTime: new Date()
    });
    
    try {
      const userId = user.sub.split('|')[1];
      const response = await axios.post('http://localhost:8000/lambda/train', {
        userId,
        projectName: project
      });

      // The response happens when everything is complete,
      // but we'll let the socket events handle progress updates
      if (response.data.status === "success") {
        // If the API returns a direct splatPath, use it instead of searching files
        if (response.data.splatPath) {
          const bucketName = process.env.REACT_APP_S3_BUCKET_NAME || 'dex-model-storage';
          const splatFileUrl = `https://${bucketName}.s3.amazonaws.com/${response.data.splatPath}`;
          setObjFileUrl(splatFileUrl);
          setObjFileStatus("available");
        } else {
          // Fallback to searching for splat files
          setObjFileStatus("loading");
          const files = await fetchProjectFiles(userId, project);
          const splatFile = files.find((file) => file.fileName.endsWith(".splat"));
          if (splatFile) {
            setObjFileUrl(splatFile.url);
            setObjFileStatus("available");
          }
        }
      }
    } catch (error) {
      console.error("Error training model:", error);
      setTrainingProgress(prev => ({
        ...prev,
        status: 'error',
        message: `Training failed: ${error.message || 'Unknown error'}`
      }));
      setIsTraining(false);
      alert("Failed to train model. Please try again later.");
    }
  };
  
  // Helper function to render progress indicator
  const renderProgressStatus = () => {
    if (!isTraining) return null;
    
    const getStepNumber = (step) => {
      const steps = ['starting', 'download', 'unzip', 'setup', 'process', 'train', 'export', 'convert', 'upload', 'cleanup', 'final'];
      const index = steps.indexOf(step);
      return index >= 0 ? index + 1 : 0;
    };
    
    const totalSteps = 11; // Total number of possible steps
    const currentStep = getStepNumber(trainingProgress.step);
    const progressPercentage = Math.max(5, Math.min(100, (currentStep / totalSteps) * 100));
    
    const getStatusColor = (status) => {
      switch (status) {
        case 'error': return 'bg-red-500';
        case 'warning': return 'bg-yellow-500';
        case 'completed': return 'bg-green-500';
        case 'running':
        default: return 'bg-blue-500';
      }
    };
    
    const elapsedTime = trainingProgress.startTime 
      ? Math.floor((new Date() - trainingProgress.startTime) / 1000)
      : 0;
    
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    return (
      <div className="mt-4">
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{trainingProgress.message}</span>
          <span className="text-sm font-medium text-gray-700">{formatTime(elapsedTime)}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className={`h-2.5 rounded-full ${getStatusColor(trainingProgress.status)}`} 
            style={{width: `${progressPercentage}%`}}
          ></div>
        </div>
      </div>
    );
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

              {/* Show progress if training is in progress */}
              {isTraining && renderProgressStatus()}

              {/* Show loading indicator when checking status */}
              {splatFileStatus === "loading" && !isTraining && (
                <p className="text-gray-500 mt-2">Loading...</p>
              )}
              
              {/* Show View button if splat file is available */}
              {splatFileStatus === "available" && !isTraining && (
                <button
                  onClick={handleViewRendering}
                  className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors duration-200"
                >
                  View 3D Rendering
                </button>
              )}
              
              {/* Show Train button if needed */}
              {splatFileStatus === "unavailable" && !isTraining && (
                <>
                  {!instanceRunning ? (
                    <p className="mt-4 text-gray-500 text-sm">Start the instance to train your model</p>
                  ) : (
                    <button 
                      onClick={handleTrain}
                      disabled={isTraining}
                      className={`mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded transition-colors duration-200 ${
                        isTraining ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'
                      }`}
                    >
                      {isTraining ? 'Training...' : 'Train 3D Model'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectCard;
