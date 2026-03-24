#!/bin/bash

echo "🚀 Starting deployment of LDC Assessment Platform..."

# Check prerequisites
command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI is required but not installed. Aborting." >&2; exit 1; }
command -v sam >/dev/null 2>&1 || { echo "❌ AWS SAM CLI is required but not installed. Aborting." >&2; exit 1; }

# Create frontend build
echo "📦 Building frontend..."
cd frontend
# Update API base URL in index.html
API_URL=$(aws cloudformation describe-stacks --stack-name ldc-assessment --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
if [ -z "$API_URL" ]; then
    echo "⚠️  API URL not found, using placeholder"
    API_URL="https://your-api-gateway-url.com/prod"
fi
sed -i.bak "s|https://your-api-gateway-url.com/prod|${API_URL}|g" index.html
rm index.html.bak
cd ..

# Deploy backend with SAM
echo "🔧 Deploying backend infrastructure..."
sam deploy \
    --template-file template.yaml \
    --stack-name ldc-assessment \
    --capabilities CAPABILITY_IAM \
    --parameter-overrides \
        TokenSecret=$(openssl rand -base64 32) \
        FromEmail="noreply@yourdomain.com" \
        AppUrl="https://your-domain.com" \
    --region us-east-1 \
    --confirm-changeset

# Get outputs
API_URL=$(aws cloudformation describe-stacks --stack-name ldc-assessment --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text)
BUCKET_NAME=$(aws cloudformation describe-stacks --stack-name ldc-assessment --query "Stacks[0].Outputs[?OutputKey=='S3BucketName'].OutputValue" --output text)
CLOUDFRONT_URL=$(aws cloudformation describe-stacks --stack-name ldc-assessment --query "Stacks[0].Outputs[?OutputKey=='FrontendURL'].OutputValue" --output text)

# Upload frontend to S3
echo "📤 Uploading frontend to S3..."
aws s3 sync frontend/ s3://$BUCKET_NAME/ --exclude "*.bak"

# Update API URL in frontend with correct value
echo "🔄 Updating API endpoint in frontend..."
aws s3 cp s3://$BUCKET_NAME/index.html s3://$BUCKET_NAME/index.html.tmp
sed -i.bak "s|https://your-api-gateway-url.com/prod|${API_URL}|g" index.html
aws s3 cp index.html s3://$BUCKET_NAME/index.html --acl public-read
rm index.html.bak

echo ""
echo "✅ Deployment Complete!"
echo "================================================"
echo "Frontend URL: $CLOUDFRONT_URL"
echo "API Endpoint: $API_URL"
echo "S3 Bucket: s3://$BUCKET_NAME"
echo "================================================"
echo ""
echo "Next Steps:"
echo "1. Verify SES email domain in AWS Console"
echo "2. Update FROM_EMAIL in Parameter Store"
echo "3. Test by launching an assessment via API:"
echo "   curl -X POST $API_URL/admin/launch \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"orgId\":\"test\",\"assessments\":[{\"employeeEmail\":\"emp@example.com\",\"employeeName\":\"John\",\"managerEmail\":\"mgr@example.com\",\"managerName\":\"Jane\"}]}'"
echo ""