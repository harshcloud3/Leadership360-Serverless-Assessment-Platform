# Leadership360 – Serverless Assessment Platform

## 🚀 Overview

Leadership360 is a serverless web application designed to conduct 360-degree leadership assessments. It enables organizations to collect feedback from employees and managers, analyze performance gaps, and generate automated reports.

---

## 🛠️ Tech Stack

* **Frontend:** HTML, JavaScript (Hosted on S3 + CloudFront)
* **Backend:** AWS Lambda (Node.js)
* **API:** Amazon API Gateway
* **Database:** DynamoDB
* **Email Service:** Amazon SES

---

## ⚙️ Features

* 🔐 Secure token-based assessment links
* 👤 Employee & Manager evaluation system
* 📊 Automated report generation (Self vs Manager comparison)
* 📂 Bulk assessment creation via CSV
* 📥 Export reports as downloadable HTML files
* ☁️ Fully serverless and scalable architecture

---

## 🌐 Live Demo

👉 https://d2plkbo2yzut7u.cloudfront.net

---

## 📊 Architecture

Frontend → S3 + CloudFront
Backend → Lambda + API Gateway
Database → DynamoDB
Email → SES

---

## 🔄 Workflow

1. Admin launches assessment
2. Emails sent to employee & manager
3. Users submit ratings
4. Data stored in DynamoDB
5. Report generated dynamically

---

## 🧪 Run Locally

```bash
node admin-launch.js
```

---

## 👨‍💻 Author

**Harsh Tiwari**
