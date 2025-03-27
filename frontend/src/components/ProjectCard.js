import React, { useState, useEffect, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import { io } from "socket.io-client";
import { 
  Trash2, 
  Info, 
  X, 
  ExternalLink, 
  PlayCircle, 
  Calendar, 
  Check, 
  AlertCircle, 
  Loader2, 
  Eye, 
  Film
} from "lucide-react";

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
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [trainingViewerUrl, setTrainingViewerUrl] = useState(null);
  const socketRef = useRef(null);
  const modalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  // Create a formatted date for display
  const formattedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Handle click outside to close modal
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsModalOpen(false);
      }
    }
    
    if (isModalOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isModalOpen]);

  // Initialize socket connection when component mounts
  useEffect(() => {
    // Only create the socket if the user is logged in
    if (user) {
      // Clear any existing intervals
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      // Socket.IO configuration with reconnection options
      const socket = io("http://localhost:8000", {
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        transports: ['websocket', 'polling']
      });
      
      socketRef.current = socket;

      // Set up event listeners for the socket
      socket.on("connect", () => {
        console.log("Socket connected:", socket.id);
        reconnectAttemptRef.current = 0;
        
        // If modal is open, re-subscribe to the room
        if (isModalOpen && user) {
          const userId = user.sub.split('|')[1];
          socket.emit('subscribe', {
            userId: userId,
            projectId: project
          });
        }
        
        // Setup heartbeat interval to keep connection alive
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        heartbeatIntervalRef.current = setInterval(() => {
          if (socket.connected) {
            socket.emit('ping', (response) => {
              console.log("Heartbeat response:", response);
            });
          }
        }, 30000); // Send heartbeat every 30 seconds
      });
      
      socket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
      });
      
      socket.on("reconnect_attempt", (attemptNumber) => {
        reconnectAttemptRef.current = attemptNumber;
        console.log(`Socket reconnection attempt ${attemptNumber}`);
      });
      
      socket.on("reconnect", (attemptNumber) => {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
        
        // If modal is open, re-subscribe to the room
        if (isModalOpen && user) {
          const userId = user.sub.split('|')[1];
          socket.emit('subscribe', {
            userId: userId,
            projectId: project
          });
        }
      });
      
      socket.on("reconnect_error", (error) => {
        console.error("Socket reconnection error:", error);
      });
      
      socket.on("reconnect_failed", () => {
        console.error("Socket reconnection failed");
        
        if (isTraining) {
          setTrainingProgress(prev => ({
            ...prev,
            status: 'warning',
            message: 'Connection lost. Training may still be in progress in the background.'
          }));
        }
      });
      
      socket.on("disconnect", (reason) => {
        console.log(`Socket disconnected. Reason: ${reason}`);
        
        // If the server initiated the disconnect, attempt to reconnect
        if (reason === 'io server disconnect') {
          socket.connect();
        }
      });

      socket.on("subscribeAck", (data) => {
        console.log("Subscription acknowledged:", data);
      });

      socket.on("trainingStatus", (data) => {
        console.log("Training status update:", data);
        
        // Update the training progress state
        setTrainingProgress(prev => ({
          ...prev,
          step: data.step,
          status: data.status,
          message: data.message
        }));

        // If we receive a viewerUrl, store it
        if (data.viewerUrl) {
          setTrainingViewerUrl(data.viewerUrl);
          console.log("Viewer URL set:", data.viewerUrl);
        }

        // Add detailed logging to debug step transitions
        if (data.step === 'process' && data.status === 'completed') {
          console.log("Process step completed, training should begin soon");
        }
        
        if (data.step === 'train' && data.status === 'running') {
          console.log("Train step started, updating UI");
        }
        
        // Reset the viewer URL when training completes or errors
        if (data.status === 'completed' || data.status === 'error') {
          setTrainingViewerUrl(null);
        }

        // If final step is completed, update the UI accordingly
        if (data.step === 'final' && data.status === 'completed') {
          setIsTraining(false);
          
          // Stop the elapsed time counter
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          
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
          
          // Stop the elapsed time counter
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
        }
      });

      // Clean up the socket when component unmounts
      return () => {
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }
        
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        
        if (socketRef.current) {
          socketRef.current.disconnect();
          socketRef.current = null;
        }
      };
    }
  }, [user, isModalOpen, project, isTraining]);

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
    const startTime = new Date();
    setTrainingProgress({
      step: 'starting',
      status: 'running',
      message: 'Initializing training process...',
      startTime: startTime
    });
    
    // Start the elapsed time counter
    setElapsedSeconds(0);
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    
    try {
      // Ensure we're connected to socket.io before starting
      if (socketRef.current && !socketRef.current.connected) {
        console.log("Socket disconnected, attempting to reconnect...");
        socketRef.current.connect();
      }

      const userId = user.sub.split('|')[1];
      
      // Re-subscribe to the room to ensure we receive updates
      if (socketRef.current) {
        socketRef.current.emit('subscribe', {
          userId: userId,
          projectId: project
        });
      }
      
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
      
      // Stop the timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      
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
    
    const getStepLabel = (step) => {
      switch(step) {
        case 'starting': return 'Starting';
        case 'download': return 'Downloading files';
        case 'unzip': return 'Unzipping files';
        case 'setup': return 'Setting up';
        case 'process': return 'Processing video';
        case 'train': return 'Training 3D model';
        case 'export': return 'Exporting model';
        case 'convert': return 'Converting format';
        case 'upload': return 'Uploading model';
        case 'cleanup': return 'Cleaning up';
        case 'final': return 'Finalizing';
        default: return 'Processing';
      }
    };
    
    const totalSteps = 11; // Total number of possible steps
    const currentStep = getStepNumber(trainingProgress.step);
    const progressPercentage = Math.max(5, Math.min(100, (currentStep / totalSteps) * 100));
    
    // Display current step prominently
    const currentStepLabel = getStepLabel(trainingProgress.step);
    
    const getStatusColor = (status) => {
      switch (status) {
        case 'error': return 'bg-red-500';
        case 'warning': return 'bg-yellow-500';
        case 'completed': return 'bg-green-500';
        case 'running':
        default: return 'bg-blue-500';
      }
    };
    
    const formatTime = (seconds) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    
    // Show a reconnecting indicator if we're trying to reconnect
    const isReconnecting = reconnectAttemptRef.current > 0;
    
    return (
      <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
        {isReconnecting && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm flex items-center">
            <Loader2 className="w-3 h-3 mr-2 animate-spin" />
            <span>Reconnecting to server... (Attempt {reconnectAttemptRef.current})</span>
          </div>
        )}
        
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">
            <strong>Step {currentStep}/{totalSteps}:</strong> {currentStepLabel}
          </span>
          <span className="text-sm font-medium bg-gray-200 rounded-full px-2 py-0.5 text-gray-700">{formatTime(elapsedSeconds)}</span>
        </div>
        <div className="text-xs text-gray-600 mb-3">{trainingProgress.message}</div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className={`h-3 rounded-full ${getStatusColor(trainingProgress.status)} transition-all duration-500 ease-in-out`} 
            style={{width: `${progressPercentage}%`}}
          ></div>
        </div>
        
        {/* Add the training viewer link when available */}
        {trainingProgress.step === 'train' && (trainingProgress.status === 'running' || trainingProgress.status === "heartbeat") && trainingViewerUrl && (
          <div className="mt-4">
            <a 
              href={trainingViewerUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-sm"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              <span>View Training Progress</span>
            </a>
            <p className="text-xs text-gray-500 mt-2 italic">
              Opens the nerfstudio training visualization in a new tab
            </p>
          </div>
        )}
      </div>
    );
  };
  
  // Show state badge based on file status
  const renderStatusBadge = () => {
    if (isTraining) {
      return (
        <div className="absolute top-4 right-4 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center">
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          Training
        </div>
      );
    } else if (splatFileStatus === "available") {
      return (
        <div className="absolute top-4 right-4 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center">
          <Check className="w-3 h-3 mr-1" />
          Ready
        </div>
      );
    } else if (splatFileStatus === "unavailable") {
      return (
        <div className="absolute top-4 right-4 bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full flex items-center">
          <AlertCircle className="w-3 h-3 mr-1" />
          Untrained
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <div className="bg-white shadow-lg rounded-xl p-6 hover:shadow-xl transition-all duration-300 relative border border-gray-100">
        {renderStatusBadge()}
        
        <div className="flex items-center mb-4">
          <Film className="text-teal-500 w-5 h-5 mr-2" />
          <h2 className="text-xl font-bold text-gray-800">{project}</h2>
        </div>
        
        <div className="flex items-center text-sm text-gray-500 mb-5">
          <Calendar className="w-4 h-4 mr-1" />
          <span>{formattedDate}</span>
        </div>
        
        <div className="flex space-x-3 mt-4">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors duration-200 shadow-sm flex items-center justify-center"
          >
            <Info className="w-4 h-4 mr-2" />
            View Details
          </button>
          <button
            onClick={handleDelete}
            className="p-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
            title="Delete Project"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Enhanced Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div 
            ref={modalRef}
            className="bg-white rounded-xl p-6 max-w-lg w-full mx-auto shadow-2xl transform transition-all duration-300 ease-out"
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <Film className="text-teal-500 w-6 h-6 mr-2" />
                {project}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors duration-200"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-5">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                <span className="text-gray-700"><strong>Created:</strong> {formattedDate}</span>
              </div>
              
              <div className="mt-2 flex items-center">
                <Info className="w-4 h-4 text-gray-500 mr-2" />
                <span className="text-gray-700">
                  <strong>Status:</strong> {
                    isTraining ? 'Training in progress' :
                    splatFileStatus === "available" ? 'Model ready to view' :
                    splatFileStatus === "unavailable" ? 'Needs training' : 'Checking status...'
                  }
                </span>
              </div>
            </div>

            {/* Show progress if training is in progress */}
            {isTraining && renderProgressStatus()}

            {/* Show loading indicator when checking status */}
            {splatFileStatus === "loading" && !isTraining && (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
                <span className="ml-3 text-gray-600">Loading project status...</span>
              </div>
            )}
            
            {/* Show View button if splat file is available */}
            {splatFileStatus === "available" && !isTraining && (
              <div className="mt-6">
                <button
                  onClick={handleViewRendering}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 shadow-md flex items-center justify-center"
                >
                  <Eye className="w-5 h-5 mr-2" />
                  View 3D Rendering
                </button>
                <p className="text-xs text-center text-gray-500 mt-2">
                  Opens the 3D viewer in a new browser tab
                </p>
              </div>
            )}
            
            {/* Show Train button if needed */}
            {splatFileStatus === "unavailable" && !isTraining && (
              <div className="mt-6">
                {!instanceRunning ? (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
                    <p>You need to start the instance before training your model.</p>
                  </div>
                ) : (
                  <button 
                    onClick={handleTrain}
                    disabled={isTraining}
                    className={`w-full py-3 rounded-lg transition-colors duration-200 shadow-md flex items-center justify-center ${
                      isTraining 
                        ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                        : 'bg-teal-600 text-white hover:bg-teal-700'
                    }`}
                  >
                    <PlayCircle className="w-5 h-5 mr-2" />
                    {isTraining ? 'Training in progress...' : 'Train 3D Model'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ProjectCard;
