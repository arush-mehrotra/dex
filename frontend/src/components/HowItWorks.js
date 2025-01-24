import React from "react";
import { Camera, FolderLock, Upload, Brain, Box } from "lucide-react";

const steps = [
  {
    icon: <Camera className="w-8 h-8" />,
    title: "Capture",
    description: "Take multiple photos or a video of the scene you want to reconstruct from different angles"
  },
  {
    icon: <FolderLock className="w-8 h-8" />,
    title: "Prepare",   
    description: "Create a .zip file containing your images or video footage from the previous step"
  },
  {
    icon: <Upload className="w-8 h-8" />,
    title: "Upload",
    description: "Create a new project using the dex.ai application and upload your .zip file"
  },
  {
    icon: <Brain className="w-8 h-8" />,
    title: "Train",
    description: "Let our fine-tuned computer vision models create a 3D model"
  },
  {
    icon: <Box className="w-8 h-8" />,
    title: "View",
    description: "Explore your 3D model in our custom interactive viewer built with three.js"
  }
];

const HowItWorks = () => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8 text-teal-600">How It Works</h2>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {steps.map((step, index) => (
          <div key={index} className="flex flex-col items-center text-center">
            <div className="bg-teal-50 p-4 rounded-full mb-4 text-teal-600">
              {step.icon}
            </div>
            <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
            <p className="text-gray-600 text-sm">{step.description}</p>
            {index < steps.length - 1 && (
              <div className="hidden md:block absolute transform translate-x-[200%] translate-y-8">
                <div className="w-8 h-0.5 bg-teal-200"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HowItWorks; 