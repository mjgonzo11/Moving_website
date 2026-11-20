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

### Verified Production Configuration

The production site and public GTM container were audited on November 20, 2026
against repository commit `66700b76443142942d05150020c7fca47c2d1801`.
The downloaded production `app.js` exactly matched the regression-tested source.

| Setting | Production value |
| --- | --- |
| Website | `https://www.amicusgroup.net/` |
| Installed container | `GTM-WQLTHH3R`, one loader in `index.html` |
| Published container version | 2 |
| Google Ads destination | `AW-18579403098` |
| Conversion action | AI Moving Quote - Submitted |
| Conversion label | `9Hf1CMnKrrwdENrirJtF` |
| Custom Event trigger | `quote_submitted` |
| GTM data layer variable | `transaction_id`, Data Layer Version 2 |
| Conversion Transaction ID field | `DLV - Quote Transaction ID` |
| Automatic user-provided data collection | Disabled |
| Enhanced conversions for this conversion tag | Disabled |
| Legacy `/#quote` URL conversion rule | Absent from published Version 2 |

The IDs, label, trigger, transaction variable, privacy switches, and removed
URL rule were independently checked in the published container. The conversion
action's display name and the account settings below were supplied by the
account owner; they cannot be verified from public website code alone.

### Google Ads Account Settings

Owner-confirmed production settings:

- AI Moving Quote - Submitted is the only Primary conversion action.
- Other conversion actions are Secondary; the legacy URL-based action was removed.
- Category and campaign goal: Request quotes.
- Count: One. Attribution: Data-driven.
- Campaign type: Performance Max. Bidding: Maximize conversions.
- Campaign budget: $10/day.

GTM owns the configurable Conversion ID and Conversion Label. Do not add
another GTM loader, standalone Google Ads script, or GA4 integration for this
action. No GA4 measurement ID was found in the inspected website installation
or published container. `config.js` remains dedicated to the quote API URL and
is regenerated by Amplify.

### Application Success Flow

1. The browser validates the form and blocks overlapping submissions.
2. `app.js` compresses photos and posts the existing JSON payload to the quote API.
3. A successful HTTP response must contain nonempty `range`, `summary`,
   `timeline`, and `confidence` strings.
4. After rendering that quote, the app queues one event:

```js
{
  event: "quote_submitted",
  transaction_id: "<opaque quote UUID>"
}
```

5. The GTM Custom Event trigger fires the single Google Ads Conversion Tracking
   tag. Its Transaction ID field reads `transaction_id`. Google requests carry
   that value in the `oid` parameter.

Opening or revisiting `/#quote`, page loads, invalid forms, API errors, network
failures, and button clicks alone are not quote conversions.

The deployed Lambda inspected for this implementation creates a random
`leadId` UUID and returns it with the quote after storage and email API calls
succeed. The Lambda handler is managed separately and is not included in this
repository. Browser tracking trusts the successful response; it does not prove
delivery to a recipient's inbox.

### Transaction Identity and Duplicate Protection

The transaction ID is the backend UUID, normalized to lowercase. It contains
no name, email, phone, address, project details, or quote price.

The app suppresses previously queued UUIDs in memory and session storage.
Replaying the same backend UUID, including after a page refresh in that tab,
does not queue another quote event. A different successful quote UUID can
produce a new conversion. Count: One is an additional Ads setting, not a
replacement for transaction-level duplicate protection.

If the API does not supply a valid UUID, the app uses a random pending
submission ID. Retrying an unchanged payload reuses that ID. Where Web Crypto
and session storage are available, a SHA-256 payload digest and random ID
preserve retry identity across page reloads. Raw payloads and photos are not
written to that storage. Edited payloads get a new ID; success clears pending
state. If hashing or storage is unavailable, retry matching works in memory.

This protects conversion events, not backend POST idempotency. A different
server record is a different quote. Browser storage being cleared, changing
tabs, blocked scripts, consent settings, or network failures can affect
tracking; queuing an event is not a delivery guarantee. Tracking errors do not
turn a successful quote into an application error.

### Privacy and Ordinary Google Telemetry

Published Version 2 disables automatic user-provided data collection and the
conversion tag's enhanced-conversion option. The application's success event
contains only its event name and transaction ID. GTM can append internal
metadata such as `gtm.uniqueEventId`.

During the isolated browser audit, 37 attempted Google collection requests
were inspected. None contained the synthetic customer's contact/address
markers, tested normalized contact hashes, or the `em`, `emd`, or
`ec_mode` parameters.

Ordinary Google browser, page, advertising-cookie and engagement telemetry
remains active. Generic `form_start` and `form_submit` requests can occur even
when a quote fails; they did not carry the quote action's label and did not
fire its conversion tag. Disabling enhanced conversions does not disable all
Google data collection.

For each successful test quote, Google generated two transport requests with
the same action label and `oid`: a conversion GET and a CCM conversion POST.
These represented one application event/tag firing, not two quote submissions.
No extra request for this action appeared when the same UUID was replayed.

### Regression and Production Audit Results

Run the dependency-free regression tests from the repository root:

```bash
node --test tests/quote-conversions.test.cjs
```

All 27 tests passed in the November 20 audit. They cover successful submissions,
error responses, malformed quotes, transaction IDs, duplicate UUIDs, overlapping
clicks, unchanged retry identity, session persistence, blocked storage/tracking,
privacy of event fields, and preservation of the existing API/photo payload.

Ten browser scenarios also passed using the real production HTML, application,
GTM container and Google scripts. Quote API responses were mocked, and Google
collection requests were intercepted before transmission. No live lead,
photo upload, AI request, notification email, or test Ads conversion was sent.
The audit verified behavior of the deployed client and tag configuration; it
did not re-test the AWS backend or Google Ads reporting/attribution.

### Repeating the Tests with Tag Assistant

1. Open the existing container in GTM Preview and connect to
   `https://www.amicusgroup.net/`.
2. Confirm container Version 2 and one installation. Do not install another tag.
3. Open the form and navigate to `/#quote`: no quote conversion should fire.
4. Submit an invalid form or mock an API/network error: no quote conversion.
5. Complete a successful test response: inspect `quote_submitted`, confirm
   exactly one conversion-tag firing, and verify `DLV - Quote Transaction ID`
   is populated with the quote UUID.
6. In DevTools Network, filter by destination `18579403098` and conversion label
   `9Hf1CMnKrrwdENrirJtF`. Check `oid` matches the event's transaction ID.
   Inspect query strings and POST bodies for unintended contact fields/hashes,
   including `em`, `emd`, and `ec_mode`.
7. Repeated clicks while pending must cause one POST. In a mocked response,
   replay the same UUID: no second event/request for the quote action. A new
   UUID should produce one new event. Refreshing must not create a conversion.

For a read-only audit, use an isolated browser with mocked quote responses and
block Google collection endpoints before testing. Do not infer quote
conversions from every request whose URL contains "conversion": generic Google
telemetry can use those endpoints without this action's label. Actual backend
tests can create leads and send emails; actual tracking requests can affect
Ads reports.

Google Ads/GTM configuration is external to this repository. README edits do
not change it. Amplify automatically deploys pushes to `main`; keep audit-only
documentation changes on a separate branch when production must remain untouched.

Official references:

- [Google Ads conversions in GTM](https://support.google.com/tagmanager/answer/6105160?hl=en)
- [Transaction IDs and duplicate conversions](https://support.google.com/google-ads/answer/6386790?hl=en)
- [Preview and debug with Tag Assistant](https://support.google.com/tagmanager/answer/6107056?hl=en)
