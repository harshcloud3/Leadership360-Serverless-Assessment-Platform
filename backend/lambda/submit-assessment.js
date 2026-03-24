const AWS = require('aws-sdk');
const crypto = require('crypto');

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'your-secret-key-change-this';

// Verify token
function verifyToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64url').toString();
        const parts = decoded.split(':');
        
        if (parts.length < 3) {
            throw new Error('Invalid token format');
        }
        
        const assessmentId = parts[0];
        const raterType = parts[1];
        const timestamp = parts[2];
        const signature = parts[3];
        
        const payload = `${assessmentId}:${raterType}:${timestamp}`;
        const expectedSignature = crypto
            .createHmac('sha256', TOKEN_SECRET)
            .update(payload)
            .digest('hex')
            .substring(0, 16);
        
        if (signature !== expectedSignature) {
            throw new Error('Invalid token signature');
        }
        
        return { assessmentId, raterType };
    } catch (error) {
        console.error('Token verification failed:', error);
        throw new Error('Invalid or expired token');
    }
}

exports.handler = async (event) => {
    console.log('Submit assessment request:', event);
    
    try {
        const token = event.pathParameters.token;
        const body = JSON.parse(event.body);
        const { ratings } = body;
        
        if (!token || !ratings) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Token and ratings are required' })
            };
        }
        
        // Verify token
        const { assessmentId, raterType } = verifyToken(token);
        
        // Store ratings
        await dynamo.put({
            TableName: TABLE_NAME,
            Item: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: `RATINGS#${raterType}`,
                ratings,
                submittedAt: new Date().toISOString(),
                raterType
            }
        }).promise();
        
        // Check if both self and manager ratings are submitted
        const selfRatings = await dynamo.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: 'RATINGS#self'
            }
        }).promise();
        
        const managerRatings = await dynamo.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: 'RATINGS#manager'
            }
        }).promise();
        
        // Update assessment status if both are complete
        let newStatus = 'partial';
        if (selfRatings.Item && managerRatings.Item) {
            newStatus = 'complete';
        }
        
        await dynamo.update({
            TableName: TABLE_NAME,
            Key: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: 'METADATA'
            },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': newStatus,
                ':updatedAt': new Date().toISOString()
            }
        }).promise();
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                message: 'Assessment submitted successfully',
                assessmentId,
                status: newStatus
            })
        };
        
    } catch (error) {
        console.error('Error submitting assessment:', error);
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