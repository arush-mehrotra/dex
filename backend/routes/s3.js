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

module.exports = router;