const express = require("express");
const AWS = require("aws-sdk");
const { NodeSSH } = require("node-ssh");
const axios = require("axios");
const fs = require("fs");

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});
const router = express.Router();

const SSH_KEY_PATH = process.env.SSH_KEY_PATH;
const LAMBDA_LABS_API_KEY = process.env.LAMBDA_LABS_API_KEY;
const INSTANCE_TYPE = process.env.LAMBDA_LABS_INSTANCE_TYPE;
const LAMBDA_LABS_SSH_KEY = process.env.LAMBDA_LABS_SSH_KEY;

async function runCommandviaSSH(instance_ip, commandString) {
  const ssh = new NodeSSH(); // ANSH
  console.log("Running command on Lambda Labs instance...");
  const username = "ubuntu";
  const privateKey = fs.readFileSync(SSH_KEY_PATH, "utf8");

  try {
    // Connect to instance
    await ssh.connect({
      host: instance_ip,
      username: username,
      privateKey: privateKey,
    });
    console.log("Connected to the Lambda Labs instance.");

    const result = await ssh.execCommand(commandString);
    // if anything in std.err, we should fail
    if (result.stderr) {
      return {
        command_status: "fail",
        message: "Command failed. Stderr output",
        result: {
          stdout: result.stdout,
          stderr: result.stderr,
        },
      };
    }

    console.log("Command executed on Lambda Labs instance.");
    return {
      command_status: "success",
      message: "Command executed successfully",
      result: {
        stdout: result.stdout,
        stderr: result.stderr,
      },
    };
  } catch (error) {
    console.error("Error running command on the instance:", error);
    return {
      command_status: "fail",
      message: "Error running command on the instance",
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
        message: error.message,
      },
    };
  } finally {
    ssh.dispose();
  }
}

async function dockerSetup(instance_ip) {
  // use bash via ssh to run docker commands to pull in a docker image and start it
  docker_pull_command =
    "sudo docker pull ghcr.io/nerfstudio-project/nerfstudio:latest";

  // run the docker pull command
  commandOutput = await runCommandviaSSH(instance_ip, docker_pull_command);

  // check status
  if (commandOutput.command_status === "fail") {
    console.log("Error pulling docker image");
  } else {
    console.log("Success pulling docker image");
  }

  return commandOutput;
}

async function awsSetup(instance_ip) {
  aws_cli_download_command = "pip3 install awscli --upgrade --user";

  // Run download command and check status
  commandOutput = await runCommandviaSSH(instance_ip, aws_cli_download_command);
  if (commandOutput.command_status === "fail") {
    console.log("Error downloading aws cli");
  }
  console.log("Success downloading aws cli");

  aws_dir_command = "mkdir .aws; cd .aws; touch config; touch credentials";
  write_config_command = `echo [default] >> config; echo region=${process.env.AWS_REGION} >> config`;
  write_credentials_command = `echo [default] >> credentials; echo aws_access_key_id=${process.env.AWS_ACCESS_KEY_ID} >> credentials; echo aws_secret_access_key=${process.env.AWS_SECRET_ACCESS_KEY} >> credentials`;

  const concatenatedCommand = `${aws_dir_command}; ${write_config_command}; ${write_credentials_command}`;

  commandOutput = await runCommandviaSSH(instance_ip, concatenatedCommand);
  
  if (commandOutput.command_status === "fail") {
    console.log("Error creating environment variables");
  } else {
    console.log("Success creating environment variables");
  }

  return commandOutput;
}

async function downloadFileFromS3(instance_ip, localFilePath, bucketFilePath) {
  downloadFileCommand = `aws s3 cp --recursive ${bucketFilePath} ${localFilePath}`;
  commandOutput = await runCommandviaSSH(instance_ip, downloadFileCommand);
  if (commandOutput.command_status === "fail") {
    console.log("Error downloading files from S3");
    return commandOutput;
  } else {
    console.log("Success downloading files from S3");
    return commandOutput;
  }
}

async function uploadFileToS3(instance_ip, localFilePath, bucketFilePath) {
  const uploadCommand = `aws s3 cp --recursive ${localFilePath} ${bucketFilePath}`;
  commandOutput = await runCommandviaSSH(instance_ip, uploadCommand);
  if (commandOutput.command_status === "fail") {
    console.log("Error uploading files to S3");
    return commandOutput;
  } else {
    console.log("Success uploading files to S3");
    return commandOutput;
  }
}

async function lambdaTrainRoutine(instance_ip, projectName, userId) {
  console.log("Running training loop on Lambda Labs instance...");
  const ssh = new NodeSSH(); 
  const username = "ubuntu";
  const privateKey = fs.readFileSync(SSH_KEY_PATH, "utf8");
  const processedDataOutputDir = projectName + "-output";
  const meshOutputDir = projectName + "-mesh";
  try {
    // Connect to instance
    await ssh.connect({
      host: instance_ip,
      username: username,
      privateKey: privateKey,
    });

    // cd into correct workspace
    var commandString = "cd " + userId + "/" + projectName;
    var result = await ssh.execCommand(commandString);
    console.log("[Docker setup]", result.stdout);
    if (result.stderr) {
      throw new Error("cd failed", result.stderr);
    }

    // start docker image with correct options as per nerf studio
    commandString =
      'sudo docker run \
            --gpus all \
            -u "$(id -u)" \
            -v "$(pwd)":/workspace \
            -v /home/ubuntu/.cache:/home/user/.cache \
            -p 7007:7007 \
            --rm \
            -d \
            --shm-size=40gb \
            -e XDG_DATA_HOME=/workspace/.local/share \
            -e XDG_CACHE_HOME=/workspace/.cache \
            -e MPLCONFIGDIR=/workspace/.config/matplotlib \
            ghcr.io/nerfstudio-project/nerfstudio:latest tail -f /dev/null';
    result = await ssh.execCommand(commandString);
    console.log("[Docker setup]", result.stdout);
    if (result.stderr) {
      throw new Error("docker run fail:", result.stderr);
    }
    const containerId = result.stdout;

    // Execute the training commands without trying to stop the container from within
    commandString = `sudo docker exec ${containerId} bash -c 'cd /workspace/${userId}/${projectName} && 
    ns-process-data video --data ./*.MP4 --output-dir ${processedDataOutputDir} --num-downscales=0 --gpu &&
    export USER=myuser &&
    export LOGNAME=myuser &&
    ns-train splatfacto-big --data "${processedDataOutputDir}" --viewer.quit-on-train-completion True --pipeline.model.cull_alpha_thresh=0.005 --pipeline.model.use_scale_regularization=True &&
    ns-export gaussian-splat --load-config outputs/*/*/*/config.yml --output-dir "${meshOutputDir}" --obb_center 0.0000000000 0.0000000000 0.0000000000 --obb_rotation 0.0000000000 0.0000000000 0.0000000000 --obb_scale 1.0000000000 1.0000000000 1.0000000000'`;

    result = await ssh.execCommand(commandString);
    console.log("[Training]", result.stdout);
    if (result.stderr && result.stderr.includes("Error")) {
      throw new Error("Training loop failed", result.stderr);
    }

    // Stop the Docker container from outside
    console.log("Stopping Docker container:", containerId);
    const stopCommand = `sudo docker stop ${containerId}`;
    const stopResult = await ssh.execCommand(stopCommand);
    console.log("[Container Stop]", stopResult.stdout);
    if (stopResult.stderr) {
      console.error("Warning: Issue stopping container:", stopResult.stderr);
      // Continue execution even if container stop had issues
    }

    return {
      command_status: "success",
      message: "Command executed successfully",
      result: {
        stdout: result.stdout,
        stderr: result.stderr,
      },
    };
  } catch (error) {
    console.error("Error running command on the instance:", error);
    return {
      command_status: "fail",
      message: "Error running command on the instance",
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
        message: error.message,
      },
    };
  } finally {
    ssh.dispose();
  }
}

async function convertPlyToSplat(instance_ip, userId, projectName) {
  console.log("Converting PLY to SPLAT format...");
  const ssh = new NodeSSH();
  const username = "ubuntu";
  const privateKey = fs.readFileSync(SSH_KEY_PATH, "utf8");
  const meshOutputDir = projectName + "-mesh";
  const plyFilePath = `/home/ubuntu/${userId}/${projectName}/${meshOutputDir}/splat.ply`;
  
  try {
    // Connect to instance
    await ssh.connect({
      host: instance_ip,
      username: username,
      privateKey: privateKey,
    });

    // Create a Python script for PLY to SPLAT conversion
    const pythonScript = `
import os
from plyfile import PlyData
import numpy as np
from io import BytesIO

def process_ply_to_splat(ply_file_path):
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
    with open(output_path, "wb") as f:
        f.write(splat_data)

# Input and output file paths
ply_file_path = "${plyFilePath}"
output_file_path = "${plyFilePath.replace('.ply', '.splat')}"

# Convert PLY to SPLAT
print(f"Processing {ply_file_path}...")
splat_data = process_ply_to_splat(ply_file_path)
save_splat_file(splat_data, output_file_path)
print(f"Saved {output_file_path}")
`;

    // Save the Python script to a temporary file on the instance
    const scriptPath = `/home/ubuntu/${userId}/${projectName}/convert_ply_to_splat.py`;
    await ssh.execCommand(`echo '${pythonScript}' > ${scriptPath}`);
    
    // Install required Python packages
    console.log("Installing required Python packages...");
    const installPackagesCmd = "pip install plyfile numpy";
    const installResult = await ssh.execCommand(installPackagesCmd);
    if (installResult.stderr) {
      console.error("Error installing Python packages:", installResult.stderr);
    }
    
    // Run the conversion script
    console.log("Running PLY to SPLAT conversion...");
    const convertCmd = `python ${scriptPath}`;
    const convertResult = await ssh.execCommand(convertCmd);
    
    if (convertResult.stderr) {
      console.error("Error during PLY to SPLAT conversion:", convertResult.stderr);
      throw new Error(`PLY to SPLAT conversion failed: ${convertResult.stderr}`);
    }
    
    console.log("Conversion output:", convertResult.stdout);
    
    // Upload the SPLAT file to S3
    const splatFilePath = plyFilePath.replace('.ply', '.splat');
    const bucketName = process.env.S3_BUCKET_NAME;
    const s3SplatPath = `s3://${bucketName}/${userId}/${projectName}/point_cloud.splat`;
    
    console.log(`Uploading SPLAT file to S3: ${s3SplatPath}`);
    const uploadCmd = `aws s3 cp ${splatFilePath} ${s3SplatPath}`;
    const uploadResult = await ssh.execCommand(uploadCmd);
    
    if (uploadResult.stderr) {
      console.error("Error uploading SPLAT file to S3:", uploadResult.stderr);
      throw new Error(`Failed to upload SPLAT file to S3: ${uploadResult.stderr}`);
    }
    
    console.log("SPLAT file uploaded successfully to S3");
    
    return {
      command_status: "success",
      message: "PLY to SPLAT conversion and upload completed successfully",
      splatPath: `${userId}/${projectName}/${meshOutputDir}/point_cloud.splat`,
    };
    
  } catch (error) {
    console.error("Error in PLY to SPLAT conversion:", error);
    return {
      command_status: "fail",
      message: "Error in PLY to SPLAT conversion",
      error: {
        message: error.message,
      },
    };
  } finally {
    ssh.dispose();
  }
}

// route for training a model
router.post("/train", async (req, res) => {
  const { userId, projectName } = req.body;
  console.log(userId, projectName);
  try {
    // Look for any running instances of the desired type
    const existingInstancesResponse = await axios.get(
      "https://cloud.lambdalabs.com/api/v1/instances",
      {
        headers: { Authorization: `Bearer ${LAMBDA_LABS_API_KEY}` },
      }
    );
    const runningInstance = existingInstancesResponse.data.data.find(
      (instance) =>
        instance.instance_type.name === INSTANCE_TYPE &&
        instance.status === "active"
    );
    if (!runningInstance) {
      console.log("No existing instance found. Sending error response...");
      throw new Error("No existing instance found");
    }
    console.log(`Found existing running instance: ${runningInstance.id}`);

    // Download files from s3 onto lambda labs instance using commands
    console.log("Downloading files from S3 to Lambda Labs instance...");
    const bucketName = process.env.S3_BUCKET_NAME; // Add your S3 bucket name here
    const localFilePath = `/home/ubuntu/${userId}/${projectName}`; // Destination path on the Lambda Labs instance
    const bucketFilePath = `s3://${bucketName}/${userId}/${projectName}`;
    const s3DownloadOutput = await downloadFileFromS3(
      runningInstance.ip,
      localFilePath,
      bucketFilePath
    );
    if (s3DownloadOutput.command_status === "fail") {
      throw new Error(
        `Failed to download file from S3: ${s3DownloadOutput.error.message}`
      );
    }
    console.log("File downloaded successfully to the instance:", localFilePath);

    // Unzipping the .zip file that we download from s3
    const unzipCommand = `unzip -o ${localFilePath}/${projectName}.zip -d ${localFilePath}`;
    const unzipResult = await runCommandviaSSH(
      runningInstance.ip,
      unzipCommand
    );
    if (unzipResult.command_status === "fail") {
      throw new Error(`Failed to unzip file: ${unzipResult.error.message}`);
    }
    console.log("File unzipped successfully");

    // Run training routine
    const trainResult = await lambdaTrainRoutine(
      runningInstance.ip,
      projectName,
      userId
    );
    if (trainResult.command_status === "fail") {
      console.log("Error running training loop");
      throw new Error(
        `Failed to run training loop: ${trainResult.error.message}`
      );
    }
    console.log("Success running training loop");

    // Write mesh to s3
    const meshOutputDir = projectName + "-mesh";
    const meshFilePath = `/home/ubuntu/${userId}/${projectName}/${meshOutputDir}`;
    const meshBucketFilePath = `s3://${bucketName}/${userId}/${projectName}/${meshOutputDir}`;
    const s3UploadOutput = await uploadFileToS3(
      runningInstance.ip,
      meshFilePath,
      meshBucketFilePath
    );
    if (s3UploadOutput.command_status === "fail") {
      throw new Error(
        `Failed to upload mesh to S3: ${s3UploadOutput.error.message}`
      );
    }
    console.log("Mesh uploaded successfully to S3");

    // Convert .ply to .splat and upload to S3
    const plyToSplatResult = await convertPlyToSplat(
      runningInstance.ip,
      userId,
      projectName
    );
    if (plyToSplatResult.command_status === "fail") {
      throw new Error(
        `Failed to convert PLY to SPLAT: ${plyToSplatResult.error.message}`
      );
    }
    console.log("PLY converted to SPLAT and uploaded to S3");

    res.status(200).json({
      status: "success",
      message: "Training completed, mesh and splat files uploaded",
      trainResult,
      meshPath: `${userId}/${projectName}/${meshOutputDir}`,
      splatPath: plyToSplatResult.splatPath,
    });
    return;
  } catch (error) {
    // Detailed error logging
    console.error("Full error response:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    res.status(error.response?.status || 500).json({
      message: "Error training model",
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
        message: error.message,
      },
    });
  }
});

// routes for starting Lambda Labs instance
router.post("/start_instance", async (req, res) => {
  console.log("Starting Lambda Labs instance...");

  // Predefined priority list of instance types
  const preferredInstanceTypes = [INSTANCE_TYPE];

  try {
    // STEP 1: Check if there's already a running instance
    const existingInstancesResponse = await axios.get(
      "https://cloud.lambdalabs.com/api/v1/instances",
      {
        headers: { Authorization: `Bearer ${LAMBDA_LABS_API_KEY}` },
      }
    );

    const runningInstance = existingInstancesResponse.data.data.find(
      (instance) =>
        preferredInstanceTypes.includes(instance.instance_type.name) &&
        instance.status === "active"
    );

    if (runningInstance) {
      console.log(`Found existing running instance: ${runningInstance.id}`);
      return res.json({
        instanceId: runningInstance.id,
        instanceIP: runningInstance.ip,
        region: runningInstance.region_name,
        instance_status: "existing",
      });
    }

    // STEP 2: Get available instance types & region info
    const instanceTypesResponse = await axios.get(
      "https://cloud.lambdalabs.com/api/v1/instance-types",
      {
        headers: { Authorization: `Bearer ${LAMBDA_LABS_API_KEY}` },
      }
    );

    const availableData = instanceTypesResponse.data.data;

    let selectedType = null;
    let selectedRegion = null;

    // STEP 3: Loop through preferred types and check for capacity
    for (const type of preferredInstanceTypes) {
      const instanceInfo = availableData[type];
      if (
        instanceInfo &&
        instanceInfo.regions_with_capacity_available.length > 0
      ) {
        selectedType = type;
        selectedRegion = instanceInfo.regions_with_capacity_available[0].name; // Pick first region with capacity
        console.log(
          `Selected instance type: ${selectedType} in ${selectedRegion}`
        );
        break;
      }
    }

    if (!selectedType || !selectedRegion) {
      throw new Error("No capacity available for preferred instance types.");
    }

    // STEP 4: Launch instance
    console.log(`Launching ${selectedType} in ${selectedRegion}...`);
    const launchResponse = await axios.post(
      "https://cloud.lambdalabs.com/api/v1/instance-operations/launch",
      {
        region_name: selectedRegion,
        instance_type_name: selectedType,
        ssh_key_names: [LAMBDA_LABS_SSH_KEY],
        quantity: 1,
        name: "test",
      },
      {
        headers: {
          Authorization: `Bearer ${LAMBDA_LABS_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const instanceId = launchResponse.data.data.instance_ids[0];
    console.log(`Instance launching, ID: ${instanceId}`);

    // STEP 5: Poll until instance is active
    let instanceDetails;
    do {
      await new Promise((resolve) => setTimeout(resolve, 30000)); // 30 sec wait
      instanceDetails = await axios.get(
        `https://cloud.lambdalabs.com/api/v1/instances/${instanceId}`,
        {
          headers: { Authorization: `Bearer ${LAMBDA_LABS_API_KEY}` },
        }
      );
    } while (instanceDetails.data.data.status !== "active");

    const instanceIP = instanceDetails.data.data.ip;
    console.log(`Instance active, IP: ${instanceIP}`);

    // STEP 6: Docker + AWS setup
    var result = await dockerSetup(instanceIP);
    if (result.command_status === "fail") {
      throw new Error("Error setting up docker", result.error);
    }
    console.log("Docker setup completed");

    result = await awsSetup(instanceIP);
    if (result.command_status === "fail") {
      throw new Error("Error setting up aws", result.error);
    }
    console.log("AWS setup completed");

    res.status(200).json({
      instanceId,
      instanceIP,
      instanceType: selectedType,
      region: selectedRegion,
      instance_status: "launched",
    });
  } catch (error) {
    console.error("Full error response:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    res.status(error.response?.status || 500).json({
      message: "Error launching instance or retrieving IP",
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
        message: error.message,
      },
      instance_status: "fail",
    });
  }
});

router.post("/stop_instance", async (req, res) => {
  var instanceId;
  try {
    const runningInstanceResponse = await axios.get(
      "https://cloud.lambdalabs.com/api/v1/instances",
      {
        headers: { Authorization: `Bearer ${LAMBDA_LABS_API_KEY}` },
      }
    );

    const running_instances = runningInstanceResponse.data.data;
    if (running_instances.length > 0) {
      console.log("Found running instances:", running_instances[0].id);
      instanceId = running_instances[0].id;
    } else {
      throw new Error("No running instances found");
    }

    const terminateResponse = await axios.post(
      "https://cloud.lambdalabs.com/api/v1/instance-operations/terminate",
      {
        instance_ids: [instanceId],
      },
      {
        headers: { Authorization: `Bearer ${LAMBDA_LABS_API_KEY}` },
      }
    );

    const terminated_instance =
      terminateResponse.data.data.terminated_instances[0];
    console.log("Instance terminated, ID:", instanceId);
    res.status(200).json({ instanceId, terminated_instance });
  } catch (error) {
    // Detailed error logging
    console.error("Full error response:", {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
    });

    res.status(error.response?.status || 500).json({
      message: "Error terminating instance",
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
        message: error.message,
      },
    });
  }
});

// Add a new route for checking instance status
router.get("/check_instance", async (req, res) => {
  try {
    const existingInstancesResponse = await axios.get(
      "https://cloud.lambdalabs.com/api/v1/instances",
      {
        headers: { Authorization: `Bearer ${LAMBDA_LABS_API_KEY}` },
      }
    );
    
    const runningInstance = existingInstancesResponse.data.data.find(
      (instance) =>
        instance.instance_type.name === INSTANCE_TYPE &&
        instance.status === "active"
    );

    const bootingInstance = existingInstancesResponse.data.data.find(
      (instance) =>
        instance.instance_type.name === INSTANCE_TYPE &&
        instance.status === "booting"
    );
    
    if (runningInstance) {
      res.status(200).json({
        instance: runningInstance,
        status: "running"
      });
    } else if (bootingInstance) {
      res.status(200).json({
        instance: bootingInstance,
        status: "booting"
      });
    } else {
      res.status(200).json({
        instance: null,
        status: "not_found"
      });
    }
  } catch (error) {
    console.error("Error checking instance status:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to check instance status",
      error: {
        status: error.response?.status,
        statusText: error.response?.statusText,
        details: error.response?.data,
        message: error.message,
      }
    });
  }
});

module.exports = router;
