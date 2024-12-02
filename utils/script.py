import sys
import argparse
import subprocess
from pathlib import Path

# Configure logging
# logging.basicConfig(
#     level=logging.INFO, 
#     format='%(asctime)s - %(levelname)s - %(message)s',
#     handlers=[
#         logging.FileHandler('nerf_training.log'),
#         logging.StreamHandler(sys.stdout)
#     ]
# )
# logger = logging.getLogger(__name__)


def create_project_directories(base_dir, scene_name):
    """
    Create necessary project directories.
    
    Args:
        base_dir (str): Base directory for NeRF projects
        scene_name (str): Name of the scene/project
    
    Returns:
        dict: Paths to created directories
    """
    try:
        nerfstudio_data_dir = Path(base_dir) / 'data' / 'nerfstudio' / scene_name
        raw_data_dir = nerfstudio_data_dir / 'raw_data'
        processed_dir = nerfstudio_data_dir / 'processed'
        
        # Create directories with parents to ensure all intermediate directories exist
        raw_data_dir.mkdir(parents=True, exist_ok=True)
        processed_dir.mkdir(parents=True, exist_ok=True)
        
        return {
            'base': nerfstudio_data_dir,
            'raw_data': raw_data_dir,
            'processed': processed_dir
        }
    except Exception as e:
        print(f"Failed to create directories: {e}")
        raise

def run_command(command, error_message=None):
    """
    Execute a shell command with logging and error handling.
    
    Args:
        command (list): Command to execute
        error_message (str, optional): Custom error message
    
    Returns:
        bool: True if command succeeded, False otherwise
    """
    try:
        print(f"Executing command: {' '.join(command)}")
        
        # Run command and capture output
        result = subprocess.run(
            command, 
            check=True,  # Raises CalledProcessError if command fails
            capture_output=True, 
            text=True
        )
        
        print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        error_msg = error_message or f"Command failed with error: {e.stderr}"
        print(error_msg)
        return False

def process_data(input_path, output_dir, data_type):
    """
    Process input data for NeRF training.
    
    Args:
        input_path (str): Path to input data
        output_dir (str): Output directory for processed data
        data_type (str): Type of data (images or video)
    
    Returns:
        bool: True if processing succeeded, False otherwise
    """
    process_command = [
        'ns-process-data', 
        data_type, 
        '--data', input_path, 
        '--output-dir', output_dir
    ]
    
    return run_command(
        process_command, 
        f"Failed to process {data_type} data"
    )

def train_model(data_dir, downscale_factor=4):
    """
    Train NeRF Nerfacto model.
    
    Args:
        data_dir (str): Directory containing processed data
        downscale_factor (int, optional): Downscale factor for training
    
    Returns:
        bool: True if training succeeded, False otherwise
    """
    train_command = [
        'ns-train', 
        'nerfacto', 
        'nerfstudio-data', 
        '--data', data_dir, 
        '--downscale-factor', str(downscale_factor)
    ]
    
    return run_command(
        train_command, 
        "NeRF Nerfacto model training failed"
    )

def main():
    """
    Main function to orchestrate NeRF training pipeline.
    """
    # command-line args
    parser = argparse.ArgumentParser(description='NeRF Studio Training Script')
    parser.add_argument('-p', '--path', required=True, help='Path to input data')
    parser.add_argument('-t', '--type', required=True, choices=['images', 'video'], help='Type of input data')
    parser.add_argument('-s', '--scene', required=True, help='Scene/project name')
    parser.add_argument('-b', '--base-dir', default='/home/ec2-user/nerf_projects', help='Base directory for NeRF projects')
    parser.add_argument('-d', '--downscale', type=int, default=4, help='Downscale factor for training')
    
    args = parser.parse_args()

    try:
        # Create project directories
        dirs = create_project_directories(args.base_dir, args.scene)

        # Process data
        if not process_data(args.path, str(dirs['processed']), args.type):
            print("Failed to process data - exiting")
            sys.exit(1)

        # Train model
        if not train_model(str(dirs['base']), args.downscale):
            print("Failed to train NeRF model - exiting")
            sys.exit(1)

        print(f"Successfully completed NeRF training for {args.scene}")
        sys.exit(0)

    except Exception as e:
        print(f"Training pipeline failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()