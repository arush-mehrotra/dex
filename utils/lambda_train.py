import paramiko

def run_nerf_training(instance_ip, ssh_key_path, training_script_path):
    """
    Connects to the Lambda Labs instance via SSH and runs a NeRF Studio training command.
    
    :param instance_ip: The public IP address of the Lambda Labs instance.
    :param ssh_key_path: The path to the private SSH key for authentication.
    :param training_script_path: The path to the training script on the remote machine.
    """
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Connect to the Lambda Labs instance
        ssh.connect(instance_ip, username='ubuntu', key_filename=ssh_key_path)
        print("Connected to Lambda Labs instance.")
        ``
        # Run the training script
        command = f"bash {training_script_path}"
        stdin, stdout, stderr = ssh.exec_command(command)
        
        # Print output and errors
        print("Training output:")
        print(stdout.read().decode())
        print("Training errors:")
        print(stderr.read().decode())
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        ssh.close()
        print("SSH connection closed.")

# Example usage
if __name__ == "__main__":
    INSTANCE_IP = "your.lambda.instance.ip"
    SSH_KEY_PATH = "~/.ssh/lambda-key.pem"  # Update with your actual key path
    TRAINING_SCRIPT_PATH = "~/nerf_train.sh"  # Update with the actual script path on the instance
    
    run_nerf_training(INSTANCE_IP, SSH_KEY_PATH, TRAINING_SCRIPT_PATH)
