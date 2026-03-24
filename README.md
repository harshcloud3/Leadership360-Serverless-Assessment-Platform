# AWS Serverless Leadership Assessment Platform

## 🚀 Overview
A serverless web application to conduct leadership assessments using AWS services.

## 🛠️ Tech Stack
- AWS Lambda
- API Gateway
- DynamoDB
- S3 + CloudFront
- SES
- Node.js

## ⚙️ Features
- Token-based secure assessment links
- Employee & Manager evaluation
- Automated report generation
- Bulk assessment via CSV
- Export reports as HTML

## 🌐 Live Demo
Frontend: https://d2plkbo2yzut7u.cloudfront.net

## 📊 Architecture
Frontend → S3 + CloudFront  
Backend → Lambda + API Gateway  
Database → DynamoDB  
Email → SES

## 🧪 How to Run
```bash
node admin-launch.js