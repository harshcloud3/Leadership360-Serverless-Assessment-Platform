const fs = require('fs');

const csv = fs.readFileSync('employees.csv', 'utf8');
const lines = csv.split('\n');
const headers = lines[0].split(',');

const assessments = [];

for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(',');
    const assessment = {
        employeeEmail: values[0].trim(),
        employeeName: values[1].trim(),
        managerEmail: values[2].trim(),
        managerName: values[3].trim()
    };

    assessments.push(assessment);
}

const payload = {
    orgId: 'bulk-company',
    assessments: assessments
};

fs.writeFileSync('launch-payload.json', JSON.stringify(payload, null, 2));
console.log('Created launch-payload.json with', assessments.length, 'assessments');