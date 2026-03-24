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
    console.log('Get assessment request:', event);
    
    try {
        const token = event.pathParameters.token;
        
        if (!token) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Token is required' })
            };
        }
        
        // Verify token
        const { assessmentId, raterType } = verifyToken(token);
        
        // Check if token exists and is valid
        const tokenRecord = await dynamo.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `TOKEN#${token}`,
                SK: `ASSESSMENT#${assessmentId}`
            }
        }).promise();
        
        if (!tokenRecord.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Invalid or expired token' })
            };
        }
        
        // Get assessment metadata
        const metadata = await dynamo.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: 'METADATA'
            }
        }).promise();
        
        if (!metadata.Item) {
            return {
                statusCode: 404,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: 'Assessment not found' })
            };
        }
        
        // Get existing ratings for this rater
        const ratingsResponse = await dynamo.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: `RATINGS#${raterType}`
            }
        }).promise();
        
        const ratings = ratingsResponse.Item ? ratingsResponse.Item.ratings : {};
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                assessmentId,
                raterType,
                employeeName: metadata.Item.employeeName,
                managerName: metadata.Item.managerName,
                status: metadata.Item.status,
                ratings
            })
        };
        
    } catch (error) {
        console.error('Error getting assessment:', error);
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