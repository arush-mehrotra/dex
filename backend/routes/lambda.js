const express = require('express');
const AWS = require('aws-sdk');
const { NodeSSH } = require('node-ssh');
const axios = require('axios');
const fs = require('fs');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});
const router = express.Router();
const ssh = new NodeSSH();

const SSH_KEY_PATH = process.env.SSH_KEY_PATH;
const LAMBDA_LABS_API_KEY = process.env.LAMBDA_LABS_API_KEY;
const INSTANCE_TYPE = process.env.LAMBDA_LABS_INSTANCE_TYPE;
const LAMBDA_LABS_SSH_KEY = process.env.LAMBDA_LABS_SSH_KEY;


async function runCommandviaSSH(instance_ip, commandString) {
    console.log('Running command on Lambda Labs instance...');
    const username = 'ubuntu';
    const privateKey = fs.readFileSync(SSH_KEY_PATH, 'utf8');

    try {
        // Connect to instance 
        await ssh.connect({
            host: instance_ip,
            username: username,
            privateKey: privateKey,
        });
        console.log('Connected to the Lambda Labs instance.');

        const result = await ssh.execCommand(commandString);
        console.log('STDOUT:', result.stdout);
        console.error('STDERR:', result.stderr);

        // if anything in std.err, we should fail
        if (result.stderr) {
            return {
                command_status: "fail",
                message: 'Command failed. Stderr output',
                result: {
                    stdout: result.stdout,
                    stderr: result.stderr
                }
            };
        }
        
        return {
            command_status: "success",
            message: 'Command executed successfully',
            result: {
                stdout: result.stdout,
                stderr: result.stderr
            }
        };
    } catch (error) {
        console.error('Error running command on the instance:', error);
        return { 
            command_status: "fail",
            message: 'Error running command on the instance',
            error: {
                status: error.response?.status,
                statusText: error.response?.statusText,
                details: error.response?.data,
                message: error.message
            }
        };
    } finally {
        ssh.dispose();
    }
}

async function dockerSetup(instance_ip) {
    // use bash via ssh to run docker commands to pull in a docker image and start it
    docker_pull_command = "sudo docker pull ghcr.io/nerfstudio-project/nerfstudio:latest"

    // run the docker pull command
    commandOutput = await runCommandviaSSH(instance_ip, docker_pull_command);
    // check status
    if (commandOutput.command_status === "fail") {
        console.log("Error pulling docker image");
        return commandOutput;
    } else {
        console.log('Success pulling docker image')
    }
}
    
async function awsSetup(instance_ip) {
    aws_cli_download_command = 'pip3 install awscli --upgrade --user';

    // Run download command and check status
    commandOutput = await runCommandviaSSH(instance_ip, aws_cli_download_command);
    if (commandOutput.command_status === "fail") {
        console.log("Error downloading aws cli");
        return commandOutput;
    } else {
        console.log('Success downloading aws cli');
    }

    // aws_access_key_command = `export AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID}`
    // aws_secret_access_key_command = `export AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY}`
    // aws_region_command = `export AWS_REGION=${process.env.AWS_REGION}`

    aws_access_key_command = `echo AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID} ~/.bashrc`
    aws_secret_access_key_command = `echo AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY} ~/.bashrc`
    aws_region_command = `echo AWS_REGION=${process.env.AWS_REGION} ~/.bashrc`

    const concatenatedCommand = `${aws_access_key_command}; ${aws_secret_access_key_command}; ${aws_region_command}`;

    commandOutput = await runCommandviaSSH(instance_ip, concatenatedCommand);
    if (commandOutput.command_status === "fail") {
        console.log("Error creating environment variables");
        return commandOutput;
    } else {
        console.log('Success creating environment variables')
    }
}

async function downloadFileFromS3(instance_ip, localFilePath, bucketFilePath) {
    downloadFileCommand = `aws s3 cp --recursive ${bucketFilePath} ${localFilePath}`
    commandOutput = await runCommandviaSSH(instance_ip, downloadFileCommand);
    if (commandOutput.command_status === "fail") {
        console.log("Error downloading files from S3");
        return commandOutput;
    } else {
        console.log('Success downloading files from S3')
        return commandOutput;
    }
}


// route for training a model
router.post('/train', async (req, res) => {
    const { userId, projectName } = req.body;
    console.log(userId, projectName);
    try {
        const existingInstancesResponse = await axios.get('https://cloud.lambdalabs.com/api/v1/instances', {
            headers: { 'Authorization': `Bearer ${LAMBDA_LABS_API_KEY}` }
        });
        // Look for any running instances of the desired type
        const runningInstance = existingInstancesResponse.data.data.find(instance => 
            instance.instance_type.name === INSTANCE_TYPE && 
            instance.status === 'active'
        );
        
        if (!runningInstance) {
            console.log('No existing instance found. Sending error response...');
            throw new Error('No existing instance found');
        }
        console.log(`Found existing running instance: ${runningInstance.id}`);


        // Download files from s3 onto lambda labs instance using commands
        
        console.log("Downloading files from S3 to Lambda Labs instance...");

        // S3 Bucket and file details
        const bucketName = process.env.S3_BUCKET_NAME; // Add your S3 bucket name here

        const localFilePath = `/home/ubuntu/${userId}/${projectName}`; // Destination path on the Lambda Labs instance
        const bucketFilePath = `s3://${bucketName}/${userId}/${projectName}`;
        // Run the download command on the instance
        const s3DownloadOutput = await downloadFileFromS3(runningInstance.ip, localFilePath, bucketFilePath);
        if (s3DownloadOutput.command_status === "fail") {
            throw new Error(`Failed to download file from S3: ${s3DownloadOutput.error.message}`);
        }
        console.log("File downloaded successfully to the instance:", localFilePath);
        
        // TODO: run the docker run command
        // docker_run_command = "docker run ..."
        // commandOutput = await runCommandviaSSH(instance_ip, docker_run_command);
        // // check status
        // if (commandOutput.command_status === "fail") {
        //     console.log("Error running docker image");
        //     return commandOutput;
        // }

        // TODO: run nerf pre-processings steps / nerf commands on the file


    } catch (error) {   
        // Detailed error logging
        console.error('Full error response:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        res.status(error.response?.status || 500).json({ 
            message: 'Error training model', 
            error: {
                status: error.response?.status,
                statusText: error.response?.statusText,
                details: error.response?.data,
                message: error.message
            }
        });
    }
});


// routes for starting Lambda Labs instance
router.post('/start_instance', async (req, res) => {
    console.log('Starting Lambda Labs instance...');
    const region = 'us-east-1';

    try {
      
        // CODE TO CHECK INSTANCE AVAILABILITY - might not need
        // // Get instance types and their availability
        // const availabilityResponse = await axios.get('https://cloud.lambdalabs.com/api/v1/instance-types', {
        //     headers: { 'Authorization': `Bearer ${LAMBDA_LABS_API_KEY}` }
        // });
        
        // Find the first region with available capacity
        // const availableRegions = availabilityResponse.data.data[instanceType]?.regions_with_capacity_available || [];
        // console.log('Regions with capacity:', availableRegions);
        
        // const selectedRegion = preferredRegions.find(region => availableRegions.includes(region));
        
        // if (!selectedRegion) {
        //     const availabilityMessage = `No capacity available for ${instanceType} in any preferred region. Available regions: ${availableRegions.join(', ')}`;
        //     console.log(availabilityMessage);
        //     return res.status(503).json({ 
        //         message: 'No capacity available',
        //         availableRegions,
        //         suggestion: 'Try again later or choose a different instance type'
        //     });
        // }
        // console.log(`Launching instance in region: ${selectedRegion}`);
 
        const existingInstancesResponse = await axios.get('https://cloud.lambdalabs.com/api/v1/instances', {
            headers: { 'Authorization': `Bearer ${LAMBDA_LABS_API_KEY}` }
        });
        
        // Look for any running instances of the desired type
        const runningInstance = existingInstancesResponse.data.data.find(instance => 
            instance.instance_type.name === INSTANCE_TYPE && 
            instance.status === 'active'
        );
        
        if (runningInstance) {
            console.log(`Found existing running instance: ${runningInstance.id}`);
            return res.json({
                instanceId: runningInstance.id,
                instanceIP: runningInstance.ip,
                region: runningInstance.region_name,
                instance_status: 'existing'
            });
        }
        
        // If no running instance found, proceed with new instance launch
        console.log('No existing instance found. Checking for launch availability...');
        const launchResponse = await axios.post('https://cloud.lambdalabs.com/api/v1/instance-operations/launch', {
            region_name: region,
            instance_type_name: INSTANCE_TYPE,
            ssh_key_names: [LAMBDA_LABS_SSH_KEY],
            quantity: 1,
            name: 'test'
        }, {
            headers: { 
                'Authorization': `Bearer ${LAMBDA_LABS_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        const instanceId = launchResponse.data.data.instance_ids[0];
        console.log('Instance launching, ID:', instanceId);
        
        // Wait for instance to be active and retrieve its IP
        let instanceDetails;
        do {
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds before checking
            instanceDetails = await axios.get(`https://cloud.lambdalabs.com/api/v1/instances/${instanceId}`, {
                headers: { 'Authorization': `Bearer ${LAMBDA_LABS_API_KEY}` }
            });
        } while (!(instanceDetails.data.data.status === 'active'));
        const instanceIP = instanceDetails.data.data.ip;
        console.log('Instance IP:', instanceIP);

        // docker and aws setup
        await dockerSetup(instanceIP);
        console.log("Docker setup completed");
        await awsSetup(instanceIP);
        console.log("AWS setup completed");

        res.status(200).json({ instanceId, instanceIP, instance_status: 'launched' });
        return { instanceId, instanceIP };
    } catch (error) {
        // Detailed error logging
        console.error('Full error response:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        res.status(error.response?.status || 500).json({ 
            message: 'Error launching instance or retrieving IP',
            error: {
                status: error.response?.status,
                statusText: error.response?.statusText,
                details: error.response?.data,
                message: error.message
            },
            instance_status: 'fail'
        });
    }
});

router.post('/stop_instance', async (req, res) => {
    var instanceId;
    try {
        const runningInstanceResponse = await axios.get('https://cloud.lambdalabs.com/api/v1/instances', {
            headers: { 'Authorization': `Bearer ${LAMBDA_LABS_API_KEY}` }
        });

        const running_instances = runningInstanceResponse.data.data; 
        if (running_instances.length > 0) {
            console.log('Found running instances:', running_instances[0].id);
            instanceId = running_instances[0].id;
        } else {
            throw new Error('No running instances found');
        }

        const terminateResponse = await axios.post('https://cloud.lambdalabs.com/api/v1/instance-operations/terminate', {
            instance_ids: [instanceId]
        }, {
            headers: { 'Authorization': `Bearer ${LAMBDA_LABS_API_KEY}` }
        });

        const terminated_instance = terminateResponse.data.data.terminated_instances[0];
        console.log('Instance terminated, ID:', instanceId);
        res.status(200).json({ instanceId, terminated_instance });
    } catch (error) {
        // Detailed error logging
        console.error('Full error response:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            message: error.message
        });

        res.status(error.response?.status || 500).json({ 
            message: 'Error terminating instance',
            error: {
                status: error.response?.status,
                statusText: error.response?.statusText,
                details: error.response?.data,
                message: error.message
            }
        });
    }

});

module.exports = router;