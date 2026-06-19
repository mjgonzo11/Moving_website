# Moving_website

This is an AWS-ready quote website.

The frontend is still hosted by AWS Amplify. The pricing rules, optional AI description, email reply, and lead storage run in AWS Lambda behind API Gateway.

## What changed

- `app.js` now calls your AWS API instead of generating a mock quote in the browser.
- `config.js` holds the public API URL. It does not contain secrets.
- `aws-backend/` contains a SAM/CloudFormation backend:
  - API Gateway HTTP API
  - Lambda quote function
  - DynamoDB table for leads
  - Manual pricing rules for the estimate range, timeline, and confidence
  - Optional Amazon Bedrock summary text only
  - Amazon SES emails to the business and customer

## AWS setup

1. Verify your sender email in Amazon SES.
2. If your SES account is still in sandbox mode, also verify any test customer email addresses.
3. Enable access to the selected Amazon Bedrock text model if `EnableAiDescription` is `true`.
4. Deploy the backend from `aws-backend/`:

```bash
sam build
sam deploy --guided
```

Use these guided deploy values:

- `AllowedOrigin`: your Amplify site URL, for example `https://main.example.amplifyapp.com`
- `FromEmail`: the verified SES sender
- `OwnerEmail`: the inbox that should receive new leads
- `BedrockModelId`: leave the default lower-cost Haiku model unless you prefer another enabled model
- `EnableAiDescription`: use `true` for short AI-written summaries, or `false` to skip Bedrock completely

After deploy, copy the `QuoteApiUrl` output.

## Low-cost quote flow

1. Lambda validates the lead.
2. Lambda calculates the price range with manual service and urgency rules.
3. If `EnableAiDescription` is `true`, Lambda asks Bedrock for only a short customer-friendly summary.
4. Lambda saves the lead and quote to DynamoDB.
5. Lambda sends the customer reply and owner notification through SES.

The AI call does not receive the uploaded image and does not set the price. This keeps token usage much lower and makes pricing easier to control.

## Amplify setup

1. In Amplify Hosting, add an environment variable named `QUOTE_API_URL`.
2. Set it to the `QuoteApiUrl` from the backend deploy.
3. Redeploy the Amplify app.

`amplify.yml` writes the deployed API URL into `config.js` during the Amplify build.

## Local testing

You can open `index.html` locally, but the quote feature works only after `config.js` points to a deployed API Gateway URL. Until then the form will show a missing API URL message.
