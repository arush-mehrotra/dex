const express = require('express');
const AWS = require('aws-sdk');
const multer = require('multer');
const router = express.Router();

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
});

// Configure multer for file upload handling
const upload = multer();

// Route to upload a file to S3
router.post('/upload', upload.single('file'), async (req, res) => {
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

    try {
        const data = await s3.upload(params).promise();
        res.status(200).json({ message: 'File uploaded successfully', data });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Error uploading file', error });
    }
});

// Route to get all project names for a given user
router.get('/projects/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ message: "Missing userId parameter" });
    }

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Prefix: `${userId}/`, // Filter objects by user ID prefix
        Delimiter: '/' // Ensure only top-level folders (projects) are returned
    };

    try {
        const data = await s3.listObjectsV2(params).promise();

        // Extract unique project names from the CommonPrefixes array
        const projectNames = (data.CommonPrefixes || []).map(prefix =>
            prefix.Prefix.split('/')[1] // Extract the project name (second segment)
        ).filter(Boolean); // Remove any undefined or empty values

        res.status(200).json({ projects: projectNames });
    } catch (error) {
        console.error('Error fetching project names:', error);
        res.status(500).json({ message: 'Error fetching project names', error });
    }
});

// Route to delete a project and all its files
router.delete('/projects/:userId/:projectName', async (req, res) => {
    const { userId, projectName } = req.params;

    if (!userId || !projectName) {
        return res.status(400).json({ message: "Missing userId or projectName" });
    }

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Prefix: `${userId}/${projectName}/` // Filter objects by user ID and project name prefix
    };

    try {
        // List all objects in the project folder
        const listedObjects = await s3.listObjectsV2(params).promise();

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            return res.status(404).json({ message: "Project not found or already empty." });
        }

        // Create delete parameters
        const deleteParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Delete: {
                Objects: listedObjects.Contents.map(({ Key }) => ({ Key }))
            }
        };

        // Delete all objects in the project folder
        await s3.deleteObjects(deleteParams).promise();

        res.status(200).json({ message: `Project "${projectName}" deleted successfully.` });
    } catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ message: 'Error deleting project', error });
    }
});

// Route to get all files in a specific project folder with pre-signed URLs
router.get('/projects/:userId/:projectName/files', async (req, res) => {
    const { userId, projectName } = req.params;

    if (!userId || !projectName) {
        return res.status(400).json({ message: "Missing userId or projectName" });
    }

    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Prefix: `${userId}/${projectName}/` // Filter objects by user ID and project name prefix
    };

    try {
        // List all objects in the project folder
        const data = await s3.listObjectsV2(params).promise();

        if (!data.Contents || data.Contents.length === 0) {
            return res.status(404).json({ message: "No files found in the project folder." });
        }

        // Extract file information and generate pre-signed URLs
        const files = await Promise.all(
            data.Contents.map(async (file) => {
                const signedUrl = await s3.getSignedUrlPromise('getObject', {
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: file.Key,
                    Expires: 60 * 5 // URL expires in 5 minutes
                });

                return {
                    key: file.Key, // Full key (path) of the file
                    fileName: file.Key.split('/').pop(), // Extract the file name from the key
                    size: file.Size, // File size in bytes
                    lastModified: file.LastModified, // Last modified timestamp
                    url: signedUrl // Pre-signed URL for secure access
                };
            })
        );

        res.status(200).json({ files });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ message: 'Error fetching files', error });
    }
});


module.exports = router;