# Amicus Group — Moving & Service Estimate Website

A responsive website for **Amicus Group**, a service business offering moving, delivery, cleaning, and junk removal. The site introduces the services, explains the estimate process, and provides a photo-based request form for customers.

The project combines a lightweight HTML, CSS, and JavaScript frontend with an AWS-oriented serverless quote API design.

## Website Features

- **Responsive landing page:** Sections for services, the estimate process, and customer requests.
- **Service selection:** Moving, delivery, cleaning, junk removal, and custom projects.
- **Photo-based requests:** Customers can select up to five images, preview the first image, and provide details about the job.
- **Client-side image processing:** Images are resized and compressed before being sent to the API, with a payload-size check.
- **Estimate form:** Collects service type, urgency, location, project details, and contact information.
- **Quote results:** Displays the estimated price range, summary, timeline, and confidence returned by the API.
- **Submission feedback:** Shows loading states and useful error messages if a request fails.
- **Analytics event:** Sends a `quote_submitted` event to the Google Tag Manager data layer after a successful request.

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Frontend hosting | AWS Amplify Hosting |
| API design | Amazon API Gateway and AWS Lambda |
| Lead storage design | Amazon DynamoDB |
| Email notification design | Amazon Simple Email Service (SES) |
| Optional AI summary design | Amazon Bedrock |
| Infrastructure definition | AWS SAM / CloudFormation |

The frontend does not calculate prices in the browser. It submits the customer's details to an API and displays the returned estimate. The AWS infrastructure template describes a backend that uses predefined pricing rules, with Bedrock optionally generating customer-friendly summary text rather than determining the price.

## Project Structure

```text
Moving_website/
├── index.html       # Website content and estimate form
├── styles.css       # Responsive layout and visual styling
├── app.js           # Form handling, image processing, and API requests
├── config.js        # Public quote API endpoint configuration
├── amplify.yml      # AWS Amplify build configuration
├── index.js         # AWS SAM/CloudFormation template (YAML content)
├── assets/          # Website images and other assets
└── README.md
```

## Running the Frontend

1. Clone the repository:

   ```bash
   git clone https://github.com/mjgonzo11/Moving_website.git
   cd Moving_website
   ```

2. Start a local static web server:

   ```bash
   python -m http.server 8000
   ```

3. Open `http://localhost:8000` in a browser.

The website can be viewed locally without AWS. To submit a quote request, `window.QUOTE_API_URL` in `config.js` must point to a working quote API endpoint.

## AWS Integration

The frontend is configured for AWS Amplify Hosting. During an Amplify build, `amplify.yml` reads the `QUOTE_API_URL` environment variable and writes it to `config.js`.

The included AWS SAM/CloudFormation template (stored in `index.js`) defines an HTTP API, Lambda function, DynamoDB table, and permissions for SES and optional Bedrock calls. **This repository does not currently include the Lambda handler directory referenced by that template**, so the backend cannot be deployed from the repository as-is. A separately implemented and deployed quote API is required for end-to-end submissions.

## Request Flow

1. A customer selects a service and enters project and contact details.
2. The browser prepares any selected photos and sends the request to the configured API.
3. The backend processes the request and returns the estimate information.
4. The website displays the returned price range and supporting details.

Lead storage, customer emails, business notifications, and optional AI-generated descriptions depend on the deployed backend implementation.

## Project Purpose

This project demonstrates responsive frontend development, form validation and image processing, integration with REST APIs, and the design of an AWS serverless workflow for customer estimates and lead management.
