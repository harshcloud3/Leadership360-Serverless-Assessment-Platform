const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

// Calculate dimension averages
function calculateDimensionAverages(selfRatings, managerRatings) {
    const dimensions = {
        'Role Understanding': [1, 2],
        'Goal Setting': [3, 4],
        'Feedback & Coaching': [5, 6, 7, 8],
        'Delegation & Planning': [9, 10, 11, 12],
        'Trust & Motivation': [13, 14, 15],
        'Communication': [16, 17, 18],
        'Adaptive Leadership': [19, 20],
        'Ownership': [21, 22]
    };
    
    const results = [];
    
    for (const [dimension, itemIds] of Object.entries(dimensions)) {
        const selfScores = [];
        const managerScores = [];
        
        itemIds.forEach(id => {
            if (selfRatings && selfRatings[id]) selfScores.push(selfRatings[id]);
            if (managerRatings && managerRatings[id]) managerScores.push(managerRatings[id]);
        });
        
        const selfAvg = selfScores.length ? selfScores.reduce((a, b) => a + b, 0) / selfScores.length : 0;
        const managerAvg = managerScores.length ? managerScores.reduce((a, b) => a + b, 0) / managerScores.length : 0;
        const gap = managerAvg - selfAvg;
        
        let band = 'Priority';
        if (managerAvg >= 4.2) band = 'Role Model';
        else if (managerAvg >= 3.6) band = 'Effective';
        else if (managerAvg >= 3.0) band = 'Emerging';
        
        results.push({
            dimension,
            selfAvg: selfAvg.toFixed(2),
            managerAvg: managerAvg.toFixed(2),
            gap: gap.toFixed(2),
            band
        });
    }
    
    return results;
}

exports.handler = async (event) => {
    console.log('Generate report request:', event);
    
    try {
        const assessmentId = event.pathParameters.assessmentId;
        
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
        
        // Get self and manager ratings
        const selfRatingsResp = await dynamo.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: 'RATINGS#self'
            }
        }).promise();
        
        const managerRatingsResp = await dynamo.get({
            TableName: TABLE_NAME,
            Key: {
                PK: `ASSESSMENT#${assessmentId}`,
                SK: 'RATINGS#manager'
            }
        }).promise();
        
        const selfRatings = selfRatingsResp.Item ? selfRatingsResp.Item.ratings : {};
        const managerRatings = managerRatingsResp.Item ? managerRatingsResp.Item.ratings : {};
        
        // Calculate dimension averages
        const dimensionResults = calculateDimensionAverages(selfRatings, managerRatings);
        
        // Generate HTML report
        const htmlReport = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Leadership Assessment Report - ${metadata.Item.employeeName}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Arial, sans-serif;
                        margin: 0;
                        padding: 40px;
                        background: #f5f5f5;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background: white;
                        border-radius: 20px;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.1);
                        overflow: hidden;
                    }
                    .header {
                        background: linear-gradient(135deg, #350046, #4a0e5e);
                        color: white;
                        padding: 40px;
                        text-align: center;
                    }
                    .content {
                        padding: 40px;
                    }
                    h1, h2, h3 {
                        color: #350046;
                    }
                    .info-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 20px;
                        margin: 20px 0;
                        padding: 20px;
                        background: #f9f9f9;
                        border-radius: 10px;
                    }
                    .info-item {
                        padding: 10px;
                    }
                    .info-label {
                        font-weight: bold;
                        color: #666;
                        font-size: 0.85rem;
                        text-transform: uppercase;
                    }
                    .info-value {
                        font-size: 1.1rem;
                        margin-top: 5px;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                    }
                    th, td {
                        padding: 12px;
                        text-align: left;
                        border-bottom: 1px solid #e0e0e0;
                    }
                    th {
                        background: #f5f5f5;
                        color: #350046;
                        font-weight: bold;
                    }
                    .band-badge {
                        display: inline-block;
                        padding: 4px 12px;
                        border-radius: 20px;
                        font-size: 0.85rem;
                        font-weight: bold;
                    }
                    .band-role-model { background: #d4edda; color: #155724; }
                    .band-effective { background: #d1ecf1; color: #0c5460; }
                    .band-emerging { background: #fff3cd; color: #856404; }
                    .band-priority { background: #f8d7da; color: #721c24; }
                    .chart-bar {
                        background: #e0e0e0;
                        height: 30px;
                        border-radius: 5px;
                        overflow: hidden;
                        margin: 5px 0;
                    }
                    .chart-fill {
                        height: 100%;
                        background: linear-gradient(90deg, #350046, #a8e52f);
                        transition: width 0.3s;
                        display: flex;
                        align-items: center;
                        justify-content: flex-end;
                        padding-right: 10px;
                        color: white;
                        font-size: 0.85rem;
                        font-weight: bold;
                    }
                    .footer {
                        text-align: center;
                        padding: 20px;
                        background: #f5f5f5;
                        color: #666;
                        font-size: 0.85rem;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>LDC 180 Degree Leadership Assessment Report</h1>
                        <p>Comprehensive leadership capability evaluation</p>
                    </div>
                    <div class="content">
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Participant</div>
                                <div class="info-value">${metadata.Item.employeeName}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Manager</div>
                                <div class="info-value">${metadata.Item.managerName}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Assessment Date</div>
                                <div class="info-value">${new Date(metadata.Item.createdAt).toLocaleDateString()}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Status</div>
                                <div class="info-value">${metadata.Item.status.toUpperCase()}</div>
                            </div>
                        </div>
                        
                        <h2>Dimension Score Profile</h2>
                        ${dimensionResults.map(d => `
                            <div>
                                <strong>${d.dimension}</strong>
                                <div class="chart-bar">
                                    <div class="chart-fill" style="width: ${(parseFloat(d.managerAvg)/5)*100}%">
                                        ${d.managerAvg}
                                    </div>
                                </div>
                                <small>Self: ${d.selfAvg} | Manager: ${d.managerAvg} | Gap: ${d.gap >= 0 ? '+' : ''}${d.gap}</small>
                            </div>
                        `).join('')}
                        
                        <h2>Dimension Summary</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Dimension</th>
                                    <th>Self Avg</th>
                                    <th>Manager Avg</th>
                                    <th>Gap</th>
                                    <th>Band</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${dimensionResults.map(d => `
                                    <tr>
                                        <td>${d.dimension}</td>
                                        <td>${d.selfAvg}</td>
                                        <td>${d.managerAvg}</td>
                                        <td>${d.gap >= 0 ? '+' : ''}${d.gap}</td>
                                        <td><span class="band-badge band-${d.band.toLowerCase().replace(' ', '-')}">${d.band}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        
                        <h2>Key Insights</h2>
                        <div class="info-grid">
                            <div class="info-item">
                                <h3>Top Strengths</h3>
                                ${dimensionResults
                                    .sort((a, b) => parseFloat(b.managerAvg) - parseFloat(a.managerAvg))
                                    .slice(0, 3)
                                    .map(d => `<p>✓ ${d.dimension}: ${d.managerAvg}/5.0</p>`)
                                    .join('')}
                            </div>
                            <div class="info-item">
                                <h3>Development Priorities</h3>
                                ${dimensionResults
                                    .sort((a, b) => parseFloat(a.managerAvg) - parseFloat(b.managerAvg))
                                    .slice(0, 3)
                                    .map(d => `<p>⚠ ${d.dimension}: ${d.managerAvg}/5.0 (Gap: ${d.gap >= 0 ? '+' : ''}${d.gap})</p>`)
                                    .join('')}
                            </div>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This report is generated based on the LDC 180 Degree Leadership Assessment framework.</p>
                        <p>© InspireOne - Leadership Development Centre</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*'
            },
            body: htmlReport
        };
        
    } catch (error) {
        console.error('Error generating report:', error);
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