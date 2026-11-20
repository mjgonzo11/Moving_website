const form = document.querySelector("#quoteForm");
const photoInput = document.querySelector("#photoInput");
const previewFrame = document.querySelector(".preview-frame");
const previewImage = document.querySelector("#previewImage");
const uploadMeta = document.querySelector("#uploadMeta");
const quoteResult = document.querySelector("#quoteResult");
const submitButton = form.querySelector('button[type="submit"]');

const maxPhotos = 5;
const maxPayloadCharacters = 5_500_000;
let selectedPhotos = [];
let isSubmitting = false;
const trackedQuoteIds = new Set();
const quoteIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pendingSubmissionKey = "amicus:pending-quote-submission";
let pendingSubmission = null;

photoInput.addEventListener("change", () => {
  const files = Array.from(photoInput.files || []);
  selectedPhotos = files.slice(0, maxPhotos);

  if (files.length > maxPhotos) {
    uploadMeta.textContent = `Only the first ${maxPhotos} photos will be uploaded`;
  }

  if (!selectedPhotos.length) {
    previewFrame.classList.remove("has-image");
    previewImage.removeAttribute("src");
    uploadMeta.textContent = "Up to 5 JPG, PNG, or HEIC photos";
    return;
  }

  if (files.length <= maxPhotos) {
    const totalBytes = selectedPhotos.reduce((sum, file) => sum + file.size, 0);
    uploadMeta.textContent = `${selectedPhotos.length} photo${selectedPhotos.length === 1 ? "" : "s"} selected (${formatBytes(totalBytes)})`;
  }

  previewImage.src = URL.createObjectURL(selectedPhotos[0]);
  previewFrame.classList.add("has-image");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSubmitting || !form.reportValidity()) return;

  isSubmitting = true;
  const wasDisabled = submitButton?.disabled;
  if (submitButton) submitButton.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form).entries());
    quoteResult.className = "quote-result";
    quoteResult.innerHTML = "<p>Calculating your estimate...</p>";

    const { quote, leadId, submissionId } = await requestQuote(data, selectedPhotos);
    renderQuote(quote, data);
    trackQuoteSubmission(leadId, submissionId);
    clearPendingSubmission();
    form.reset();
    selectedPhotos = [];
    previewFrame.classList.remove("has-image");
    previewImage.removeAttribute("src");
    uploadMeta.textContent = "Up to 5 JPG, PNG, or HEIC photos";
  } catch (error) {
    quoteResult.className = "quote-result";
    quoteResult.innerHTML = `<p class="note">${escapeHtml(error.message || "Something went wrong. Please try again.")}</p>`;
  } finally {
    isSubmitting = false;
    if (submitButton) submitButton.disabled = wasDisabled;
  }
});

async function requestQuote(data, files) {
  const apiUrl = window.QUOTE_API_URL;

  if (!apiUrl || apiUrl.includes("replace-with-your-api")) {
    throw new Error("Missing API URL. Update config.js with your API Gateway endpoint after deploying the AWS backend.");
  }

  const photos = await Promise.all(files.map(fileToCompressedDataUrl));
  const photoPayloadSize = photos.reduce((sum, photo) => sum + photo.length, 0);

  if (photoPayloadSize > maxPayloadCharacters) {
    throw new Error("The selected photos are too large to upload together. Please try fewer photos or smaller screenshots.");
  }

  const payload = {
    name: data.name,
    contact: data.contact,
    service: data.service,
    urgency: data.urgency,
    location: data.location,
    details: data.details,
    photos
  };
  const body = JSON.stringify(payload);
  const submissionId = await getSubmissionId(body);

  let response;

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    });
  } catch {
    throw new Error("The quote request could not reach the server. If you added photos, try fewer or smaller photos and submit again.");
  }

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message || "The quote API could not process this request.");
  }

  const quote = result?.quote;
  if (!quote || !["range", "summary", "timeline", "confidence"].every(
    (field) => typeof quote[field] === "string" && quote[field].trim()
  )) {
    throw new Error("The quote API returned an incomplete estimate. Please try again.");
  }

  return { quote, leadId: result.leadId, submissionId };
}

async function getSubmissionId(body) {
  if (pendingSubmission?.body === body) return pendingSubmission.id;

  let fingerprint;
  let id;
  try {
    // Store only a digest and a random ID so retries can survive a page reload.
    const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
    fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const stored = JSON.parse(window.sessionStorage.getItem(pendingSubmissionKey) || "null");
    if (stored?.fingerprint === fingerprint && typeof stored.id === "string" &&
        (quoteIdPattern.test(stored.id) || /^quote-[a-z0-9]+-[a-z0-9]+$/.test(stored.id))) {
      id = stored.id;
    }
  } catch {
    // Memory still preserves retry identity if hashing or storage is blocked.
  }

  id = id || createSubmissionId();
  pendingSubmission = { body, id };
  if (fingerprint) {
    try {
      window.sessionStorage.setItem(pendingSubmissionKey, JSON.stringify({ fingerprint, id }));
    } catch {
      // No request data is persisted when storage is unavailable.
    }
  }
  return id;
}

function clearPendingSubmission() {
  pendingSubmission = null;
  try {
    window.sessionStorage.removeItem(pendingSubmissionKey);
  } catch {
    // A successful quote does not depend on storage access.
  }
}

function createSubmissionId() {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    // Tracking must not block submission in restricted browser contexts.
  }
  return `quote-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function trackQuoteSubmission(leadId, submissionId) {
  // Queue only a success event; GTM owns the configurable Ads ID and label.
  try {
    const transactionId = typeof leadId === "string" && quoteIdPattern.test(leadId)
      ? leadId.toLowerCase()
      : submissionId;
    const storageKey = `amicus:quote-conversion:${transactionId}`;
    if (trackedQuoteIds.has(transactionId)) return;
    try {
      if (window.sessionStorage.getItem(storageKey) === "queued") return;
    } catch {
      // In-memory deduplication still works when storage is unavailable.
    }

    trackedQuoteIds.add(transactionId);
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "quote_submitted",
        transaction_id: transactionId
      });
    } catch (error) {
      trackedQuoteIds.delete(transactionId);
      throw error;
    }

    try {
      window.sessionStorage.setItem(storageKey, "queued");
    } catch {
      // The event is already queued and protected in memory.
    }
  } catch (error) {
    console.warn("Quote succeeded, but conversion tracking could not be queued.", error);
  }
}

function renderQuote(quote, data) {
  quoteResult.innerHTML = `
    <div>
      <div class="price">${quote.range}</div>
      <p class="note">${quote.summary}</p>
    </div>
    <div class="quote-row">
      <span>Service</span>
      <strong>${escapeHtml(data.service || "Not selected")}</strong>
    </div>
    <div class="quote-row">
      <span>Timeline</span>
      <strong>${quote.timeline}</strong>
    </div>
    <div class="quote-row">
      <span>Confidence</span>
      <strong>${quote.confidence}</strong>
    </div>
    <p class="note">A copy of this quote has been saved and emailed to the customer when the contact field contains an email address.</p>
  `;
}

function fileToCompressedDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please upload an image file."));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 900;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.68));
      };

      image.onerror = () => reject(new Error("The selected image could not be read."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}



