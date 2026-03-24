#!/usr/bin/env node

const https = require('https');

const API_URL = 'https://m8ve3mntme.execute-api.us-east-1.amazonaws.com/prod';

async function launchAssessments(orgId, assessments) {
    const data = JSON.stringify({ orgId, assessments });
    
    const options = {
        hostname: new URL(API_URL).hostname,
       path: '/prod/admin/launch',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
        }
    };
    
    const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
            responseData += chunk;
        });
        
        res.on('end', () => {
            console.log('Response:', JSON.parse(responseData));
        });
    });
    
    req.on('error', (error) => {
        console.error('Error:', error);
    });
    
    req.write(data);
    req.end();
}

// Example usage
const assessments = [
    {
        employeeEmail: 'harshcloud3@gmail.com',
        employeeName: 'John Doe',
        managerEmail: 'harshcloud3@gmail.com',
        managerName: 'Jane Smith'
    },
    {
        employeeEmail: 'harshcloud3@gmail.com',
        employeeName: 'Sarah Johnson',
        managerEmail: 'harshcloud3@gmail.com',
        managerName: 'Jane Smith'
    }
];

launchAssessments('org-123', assessments);