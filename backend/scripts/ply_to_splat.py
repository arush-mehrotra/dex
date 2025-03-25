#!/usr/bin/env python3
import os
import sys
from plyfile import PlyData
import numpy as np
from io import BytesIO

def process_ply_to_splat(ply_file_path):
    """
    Convert a PLY file to SPLAT format.
    
    Args:
        ply_file_path: Path to the input PLY file
        
    Returns:
        Binary data in SPLAT format
    """
    plydata = PlyData.read(ply_file_path)
    vert = plydata["vertex"]
    sorted_indices = np.argsort(
        -np.exp(vert["scale_0"] + vert["scale_1"] + vert["scale_2"])
        / (1 + np.exp(-vert["opacity"]))
    )
    buffer = BytesIO()
    for idx in sorted_indices:
        v = plydata["vertex"][idx]
        position = np.array([v["x"], v["y"], v["z"]], dtype=np.float32)
        scales = np.exp(
            np.array(
                [v["scale_0"], v["scale_1"], v["scale_2"]],
                dtype=np.float32,
            )
        )
        rot = np.array(
            [v["rot_0"], v["rot_1"], v["rot_2"], v["rot_3"]],
            dtype=np.float32,
        )
        SH_C0 = 0.28209479177387814
        color = np.array(
            [
                0.5 + SH_C0 * v["f_dc_0"],
                0.5 + SH_C0 * v["f_dc_1"],
                0.5 + SH_C0 * v["f_dc_2"],
                1 / (1 + np.exp(-v["opacity"])),
            ]
        )
        buffer.write(position.tobytes())
        buffer.write(scales.tobytes())
        buffer.write((color * 255).clip(0, 255).astype(np.uint8).tobytes())
        buffer.write(
            ((rot / np.linalg.norm(rot)) * 128 + 128)
            .clip(0, 255)
            .astype(np.uint8)
            .tobytes()
        )

    return buffer.getvalue()

def save_splat_file(splat_data, output_path):
    """
    Save the SPLAT data to a file.
    
    Args:
        splat_data: Binary data in SPLAT format
        output_path: Path to save the output SPLAT file
    """
    with open(output_path, "wb") as f:
        f.write(splat_data)

def main():
    """
    Main function to process command line arguments and convert PLY to SPLAT.
    """
    if len(sys.argv) < 2:
        print("Usage: python ply_to_splat.py <input_ply_file> [output_splat_file]")
        sys.exit(1)
        
    ply_file_path = sys.argv[1]
    
    if len(sys.argv) >= 3:
        output_file_path = sys.argv[2]
    else:
        output_file_path = ply_file_path.replace('.ply', '.splat')
    
    print(f"Processing {ply_file_path}...")
    try:
        splat_data = process_ply_to_splat(ply_file_path)
        save_splat_file(splat_data, output_file_path)
        print(f"Successfully saved {output_file_path}")
    except Exception as e:
        print(f"Error processing PLY file: {str(e)}")
        sys.exit(1)
    
if __name__ == "__main__":
    main() 