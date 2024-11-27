import React from "react";
import { useLocation } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { useLoader } from "@react-three/fiber";

const OBJModel = ({ objUrl }) => {
  const obj = useLoader(OBJLoader, objUrl);
  return <primitive object={obj} scale={[0.5, 0.5, 0.5]} />;
};

const Rendering = () => {
  const location = useLocation();
  const { objFileUrl } = location.state || {}; // Access objFileUrl passed via state

  console.log("Rendering objFileUrl:", objFileUrl);

  if (!objFileUrl) {
    return <p>Error: No .obj file URL provided</p>;
  }

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <OBJModel objUrl={objFileUrl} />
        <OrbitControls />
      </Canvas>
    </div>
  );
};

export default Rendering;
