# Moving_website

This is a working browser prototype for a quote website.

Open `index.html` in a browser. The form accepts a phone camera photo or file upload, collects customer/project details, and generates a mock estimate.

## Recommended AWS Build

- Frontend: AWS Amplify Hosting for the website.
- Uploads: S3 presigned URLs so photos upload directly from the browser to S3.
- API: API Gateway plus Lambda for request creation, quote orchestration, and notifications.
- AI: Amazon Bedrock with a vision-capable model, or another multimodal AI provider.
- Data: DynamoDB for leads, quote status, and audit history.
- Notifications: Amazon SES for email quotes, or Amazon SNS/Pinpoint for SMS.

## Production Flow

1. User fills the form and chooses a photo.
2. Browser asks Lambda for a presigned S3 upload URL.
3. Browser uploads the image directly to S3.
4. Browser submits the form fields plus S3 object key to the quote API.
5. Lambda sends the image and fields to the AI model.
6. Lambda stores the quote and sends it to the customer.

The mock quote logic lives in `app.js` inside `createMockQuote()`. Replace that function with a `fetch()` call to your AWS API when the backend is ready.
