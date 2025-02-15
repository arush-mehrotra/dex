const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const { NodeSSH } = require('node-ssh');
const axios = require('axios');
const ssh = new NodeSSH();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

async function connectAndRunCommand() {
    const instanceIP = 'YOUR_INSTANCE_IP'; // Replace with your Lambda Labs instance IP
    const username = 'ubuntu'; // Default user for AWS-based instances
    const privateKeyPath = '/path/to/your/private/key.pem'; // Replace with your key path

    try {
        await ssh.connect({
            host: instanceIP,
            username: username,
            privateKey: privateKeyPath,
        });

        console.log('Connected to the Lambda Labs instance.');

        const command = 'nvidia-smi'; // TODO: Replace with your nerf command
        const result = await ssh.execCommand(command);
        
        console.log('STDOUT:', result.stdout);
        console.error('STDERR:', result.stderr);
    } catch (error) {
        console.error('Error connecting to the instance:', error);
    } finally {
        ssh.dispose();
    }
}

// route for training a model
router.post('/train', async (req, res) => {
    const file = req.file;
    const { userId, projectName } = req.body;

    if (!userId || !projectName) {
        return res.status(400).json({ message: "Missing userId or projectName" });
    }

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: `${userId}/${projectName}/${file.originalname}`,
        Body: file.buffer,
        ContentType: file.mimetype
    };

    // TODO: connect to Lambda Labs API via SSH
    


});


// routes for starting Lambda Labs instance
router.post('/start_instance', async (req, res) => {
    console.log('Starting Lambda Labs instance...');
    const apiKey = process.env.LAMBDA_LABS_API_KEY;
    const sshKey = "ll-test";
    const instanceType = 'gpu_1x_a100_sxm4'; 
    const region = 'us-east-1';
    try {
        //  // First, verify the SSH key exists
        //  const sshKeysResponse = await axios.get('https://cloud.lambdalabs.com/api/v1/ssh-keys', {
        //     headers: { 'Authorization': `Bearer ${apiKey}` }
        // });
        
        // const sshKeyExists = sshKeysResponse.data.data.some(key => key.name === sshKey);
        // if (!sshKeyExists) {
        //     throw new Error(`SSH key "${sshKey}" not found in your Lambda Labs account`);
        // }

        // // Get instance types and their availability
        // const availabilityResponse = await axios.get('https://cloud.lambdalabs.com/api/v1/instance-types', {
        //     headers: { 'Authorization': `Bearer ${apiKey}` }
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
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        // Look for any running instances of the desired type
        const runningInstance = existingInstancesResponse.data.data.find(instance => 
            instance.instance_type.name === instanceType && 
            instance.status === 'active'
        );
        
        if (runningInstance) {
            console.log(`Found existing running instance: ${runningInstance.id}`);
            return res.json({
                instanceId: runningInstance.id,
                instanceIP: runningInstance.ip,
                region: runningInstance.region_name,
                status: 'existing'
            });
        }
        
        // If no running instance found, proceed with launch checks
        console.log('No existing instance found. Checking for launch availability...');
        // HERE: Launch a new instance
        const launchResponse = await axios.post('https://cloud.lambdalabs.com/api/v1/instance-operations/launch', {
            region_name: region,
            instance_type_name: instanceType,
            ssh_key_names: [sshKey],
            quantity: 1,
            name: 'test'
        }, {
            headers: { 
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const instanceId = launchResponse.data.data.instance_ids[0];
        console.log('Instance launching, ID:', instanceId);
        
        // Wait for instance to be up and retrieve its IP
        let instanceDetails;
        do {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before checking
            instanceDetails = await axios.get(`https://cloud.lambdalabs.com/api/v1/instances/${instanceId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
        } while (!instanceDetails.data.data.ip);
        
        const instanceIP = instanceDetails.data.data.ip;
        console.log('Instance IP:', instanceIP);
        res.status(200).json({ instanceId, instanceIP });
        
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
            }
        });
    }
});

router.post('/stop_instance', async (req, res) => {
    const apiKey = process.env.LAMBDA_LABS_API_KEY;
    var instanceId;

    // Get running instance
    try {
        const runningInstanceResponse = await axios.get('https://cloud.lambdalabs.com/api/v1/instances', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const running_instances = runningInstanceResponse.data.data; 
        if (running_instances.length > 0) {
            console.log('Found running instances:', running_instances);
            instanceId = running_instances[0].id;
        } else {
            throw new Error('No running instances found');
        }

        const terminateResponse = await axios.post('https://cloud.lambdalabs.com/api/v1/instance-operations/terminate', {
            instance_ids: [instanceId]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
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
            message: 'Error launching instance or retrieving IP',
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