const https = require('https');
const fs = require('fs');

const API_URL = 'https://m8ve3mntme.execute-api.us-east-1.amazonaws.com/prod';

const assessmentIds = [
    '4f0e2c55-7b5c-4c1e-8194-d5f740f9ff5a',
  '297b94c9-5f02-4460-bacf-54fdb98430fe'
];

async function downloadReport(assessmentId) {
    return new Promise((resolve, reject) => {
        https.get(`${API_URL}/report/${assessmentId}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                fs.writeFileSync(`${assessmentId}.html`, data);
                console.log(`Downloaded ${assessmentId}.html`);
                resolve();
            });
        }).on('error', reject);
    });
}

(async () => {
    for (const id of assessmentIds) {
        await downloadReport(id);
    }
    console.log('All reports downloaded!');
})();