import React from "react";
import { useLocation } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { useLoader } from "@react-three/fiber";
import Navbar from "../components/Navbar";

const OBJModel = ({ objUrl }) => {
  const obj = useLoader(OBJLoader, objUrl);
  return <primitive object={obj} scale={[0.5, 0.5, 0.5]} />;
};

const Rendering = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const objFileUrl = params.get("objFileUrl");

  if (!objFileUrl) {
    return <p className="text-center mt-10">No object file URL provided.</p>;
  }

  return (
    <div>
        <Navbar />
        <div className="flex items-center justify-center h-screen overflow-hidden">
            <div className="w-4/5 h-4/5 border-4 border-teal-500 rounded-lg bg-black shadow-lg relative">
                <Canvas>
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <OBJModel objUrl={objFileUrl} />
                <OrbitControls />
                </Canvas>
            </div>
        </div>
    </div>

  );
};

export default Rendering;
