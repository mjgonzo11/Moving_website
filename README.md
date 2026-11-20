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
- **Analytics event:** Sends a deduplicated `quote_submitted` event with a transaction ID after a successful API response containing a complete quote.

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

## Google Ads Quote Conversion Tracking

### Existing Installation

The site already loads one Google Tag Manager container, `GTM-WQLTHH3R`, in
`index.html`. Reuse it: do not add another GTM loader, a separate Google Ads
tracking script, or GA4 just to count quotes.

The published container inspected on November 20, 2026 included Google Ads
destination `AW-18579403098` and a URL-based conversion rule referencing
`/#quote`. It did not listen for the application's `quote_submitted` event.
The Google Ads/GTM settings are managed separately from this repository;
changing this JavaScript does not remove that existing rule.

### Success and Duplicate Handling

`app.js` waits for a successful HTTP response with nonempty `range`, `summary`,
`timeline`, and `confidence` fields, displays the quote, then queues:

```js
{ event: "quote_submitted", transaction_id: submissionId }
```

The transaction ID uses the API's `leadId` only when it is a UUID, normalized
to lowercase. Otherwise it uses a random ID created once for the pending
submission. No contact details, photos,
address, project description, or quoted price are included in this event.

Only one request is allowed in flight at a time. A memory guard and, where
available, session storage prevent requeuing a transaction ID in the same tab.
Google Ads receives that same ID for its own conversion deduplication.
Unavailable browser storage or a failed tracking queue never prevents the
customer from receiving a successful quote.

The fallback ID is reused after a failed request when the API payload is
unchanged. When Web Crypto and session storage are available, a SHA-256 digest
of that payload and the random ID preserve retry identity across page reloads
in the same tab. The raw payload is never written to browser storage or the
conversion event. Without those browser features, retries are matched in memory.
Changing the payload creates a new pending ID; success retires the pending ID.

This is conversion deduplication, not backend request idempotency. A new POST
that creates a new lead is a new submission. Without a stable backend lead ID,
the browser cannot recognize a retry in a different tab or after browser
storage is cleared as the same server record.
Queuing an event also does not guarantee Google receives it: blockers, consent,
or network failures can prevent delivery.

The Lambda handler is not included in this repository. The deployed handler
inspected for this change returns its UUID and quote after storage and email
calls succeed. Tracking trusts that response; it does not independently verify
delivery to the recipient's inbox.
No backend, AI, email, photo-processing, or styling changes are needed.

### Configurable Google Ads Values

Configure the destination entirely in the existing GTM container:

If the conversion tag and `DLV - Quote Transaction ID` are already configured
and preview-tested, keep them. This app change supplies the previously missing
`transaction_id` field; it does not require another tracking script or tag.

1. In Google Ads, find or create a manual website conversion action for a
   successful quote request. Select **Use Google Tag Manager** and obtain the
   actual **Conversion ID** and **Conversion Label**. The observed Ads
   destination above does not establish the right label for this new action.
2. In GTM, create two **Constant** variables named
   `Google Ads - Conversion ID` and `Google Ads - Quote Conversion Label`.
   Set them to those actual values. Leave the conversion tag unconfigured or
   paused until both values are available; do not publish invented placeholders.
3. Create a **Data Layer Variable**, version 2, named
   `DLV - Quote Transaction ID`, with data layer variable name `transaction_id`.
4. Create a **Custom Event** trigger with event name exactly
   `quote_submitted` (regex matching off).
5. Create one **Google Ads Conversion Tracking** tag. Use the two Constant
   variables for its ID and label, `DLV - Quote Transaction ID` for its
   Transaction ID, and the custom event trigger from step 4. Do not use a click,
   form-submit, page-view, history-change, or `/#quote` URL trigger.
6. Reuse the container's existing Google Ads destination and check that it
   matches the conversion account. Keep its normal initialization tag.
7. When activation is approved, remove or disable the old URL-based conversion
   rule and any other tag counting the same quote action. Do not count the
   same event through both direct Ads tracking and an imported GA4 conversion.
8. For a lead conversion, set **Count** to **One** in Google Ads. Still use
   the transaction ID; this counting setting alone does not deduplicate events.

No new IDs or labels are hardcoded in the app. Do not put these settings only
in `config.js`: Amplify currently regenerates that file with the API URL.
This patch does not change or publish anything in the Google accounts.

### Testing Before Deployment

Run the dependency-free tests from the repository root:

```bash
node --test tests/quote-conversions.test.cjs
```

The 27 tests mock the API and browser; they do not create leads, invoke AI, upload
photos, or send emails. They cover success, failures, malformed responses,
duplicate IDs, repeated clicks, blocked storage/tracking, and request payloads.

For browser testing, serve this code on localhost or an approved staging origin
and use **GTM > Preview** to connect Tag Assistant to that URL. A local API URL
must be configured and allowed by backend CORS, or use a mocked API.
GTM Preview exposes draft tag changes but does not stage website code.

1. Load the page and navigate to `/#quote`: the quote conversion must not fire.
2. Submit an invalid form or simulate a rejected/network-failed request:
   no quote conversion should fire.
3. Complete a successful estimate: inspect `quote_submitted` in Tag Assistant,
   verify exactly one Ads conversion tag fired, and check its Transaction ID.
4. Double-click Submit while the request is pending: there should be one POST.
   In a mocked test, return the same `leadId` again: no second success event
   should be queued. A different `leadId` should produce a new event.
5. Reload or revisit `/#quote`: no quote conversion should fire.

Use the approved release workflow for deployment. Pushing to Amplify's
connected branch automatically deploys this site; do not push just to run
mocked tests. GTM Preview tests draft Google settings without publishing them.

Official references:

- [Google Ads conversions in GTM](https://support.google.com/tagmanager/answer/6105160?hl=en)
- [Transaction IDs and duplicate conversions](https://support.google.com/google-ads/answer/6386790?hl=en)
- [Preview and debug with Tag Assistant](https://support.google.com/tagmanager/answer/6107056?hl=en)

