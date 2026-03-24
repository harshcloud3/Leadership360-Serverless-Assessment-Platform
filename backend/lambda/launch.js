const AWS = require('aws-sdk');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const dynamo = new AWS.DynamoDB.DocumentClient();
const ses = new AWS.SES();

const TABLE_NAME = process.env.TABLE_NAME;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'your-secret-key-change-this';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@yourdomain.com';
const APP_URL = process.env.APP_URL || 'https://your-app-url.com';

// Helper: Create secure token
function createToken(assessmentId, raterType) {
    const payload = `${assessmentId}:${raterType}:${Date.now()}`;
    const signature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(payload)
        .digest('hex')
        .substring(0, 16);
    const token = Buffer.from(`${payload}:${signature}`).toString('base64url');
    return token;
}

// Helper: Send email
async function sendEmail(to, subject, body) {
    const params = {
        Source: FROM_EMAIL,
        Destination: {
            ToAddresses: [to]
        },
        Message: {
            Subject: { Data: subject },
            Body: {
                Html: { Data: body },
                Text: { Data: body.replace(/<[^>]*>/g, '') }
            }
        }
    };
    
    try {
        await ses.sendEmail(params).promise();
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error(`Failed to send email to ${to}:`, error);
        throw error;
    }
}

exports.handler = async (event) => {
    console.log('Launch assessment request:', event);
    
    try {
        // Parse request body
        const body = JSON.parse(event.body);
        const { orgId, assessments } = body;
        
        if (!orgId || !assessments || !Array.isArray(assessments)) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Invalid request: orgId and assessments array required' })
            };
        }
        
        const results = [];
        
        // Process each assessment
        for (const assessment of assessments) {
            const { employeeEmail, employeeName, managerEmail, managerName } = assessment;
            
            if (!employeeEmail || !managerEmail) {
                results.push({
                    employeeEmail,
                    status: 'skipped',
                    error: 'Missing email addresses'
                });
                continue;
            }
            
            const assessmentId = uuidv4();
            const createdAt = new Date().toISOString();
            
            // Create tokens for both raters
            const employeeToken = createToken(assessmentId, 'self');
            const managerToken = createToken(assessmentId, 'manager');
            
            // Store assessment metadata in DynamoDB
            await dynamo.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `ASSESSMENT#${assessmentId}`,
                    SK: 'METADATA',
                    orgId,
                    employeeEmail,
                    employeeName: employeeName || 'Employee',
                    managerEmail,
                    managerName: managerName || 'Manager',
                    status: 'pending',
                    createdAt,
                    updatedAt: createdAt
                }
            }).promise();
            
            // Store token mapping
            await dynamo.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `TOKEN#${employeeToken}`,
                    SK: `ASSESSMENT#${assessmentId}`,
                    raterType: 'self',
                    assessmentId,
                    email: employeeEmail,
                    expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
                }
            }).promise();
            
            await dynamo.put({
                TableName: TABLE_NAME,
                Item: {
                    PK: `TOKEN#${managerToken}`,
                    SK: `ASSESSMENT#${assessmentId}`,
                    raterType: 'manager',
                    assessmentId,
                    email: managerEmail,
                    expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
                }
            }).promise();
            
            // Send emails
            const employeeLink = `${APP_URL}?token=${employeeToken}`;
            const managerLink = `${APP_URL}?token=${managerToken}`;
            
            // Employee email
            const employeeEmailBody = `
                <h2>Leadership Assessment Invitation</h2>
                <p>Dear ${employeeName || 'Employee'},</p>
                <p>You have been invited to complete a self-assessment for the LDC 180 Degree Leadership Assessment.</p>
                <p>Please click the link below to begin:</p>
                <p><a href="${employeeLink}">${employeeLink}</a></p>
                <p>This assessment should take approximately 15-20 minutes to complete.</p>
                <p>Thank you for your participation.</p>
            `;
            
            await sendEmail(employeeEmail, 'Leadership Self-Assessment Invitation', employeeEmailBody);
            
            // Manager email
            const managerEmailBody = `
                <h2>Leadership Assessment - Feedback Request</h2>
                <p>Dear ${managerName || 'Manager'},</p>
                <p>You have been asked to provide feedback for ${employeeName || 'an employee'} as part of the LDC 180 Degree Leadership Assessment.</p>
                <p>Please click the link below to provide your feedback:</p>
                <p><a href="${managerLink}">${managerLink}</a></p>
                <p>Your honest and constructive feedback is valuable for their development.</p>
                <p>Thank you for your participation.</p>
            `;
            
            await sendEmail(managerEmail, 'Leadership Assessment - Manager Feedback', managerEmailBody);
            
            results.push({
                assessmentId,
                employeeEmail,
                managerEmail,
                status: 'launched',
                employeeToken,
                managerToken
            });
            
            console.log(`Assessment launched: ${assessmentId}`);
        }
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: `Successfully launched ${results.filter(r => r.status === 'launched').length} assessments`,
                results
            })
        };
        
    } catch (error) {
        console.error('Error launching assessments:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};