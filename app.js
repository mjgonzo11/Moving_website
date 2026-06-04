const form = document.querySelector("#quoteForm");
const photoInput = document.querySelector("#photoInput");
const previewFrame = document.querySelector(".preview-frame");
const previewImage = document.querySelector("#previewImage");
const uploadMeta = document.querySelector("#uploadMeta");
const quoteResult = document.querySelector("#quoteResult");

let selectedPhoto = null;

photoInput.addEventListener("change", () => {
  const [file] = photoInput.files;
  selectedPhoto = file || null;

  if (!file) {
    previewFrame.classList.remove("has-image");
    previewImage.removeAttribute("src");
    uploadMeta.textContent = "JPG, PNG, or HEIC from a phone camera";
    return;
  }

  uploadMeta.textContent = `${file.name} (${formatBytes(file.size)})`;
  previewImage.src = URL.createObjectURL(file);
  previewFrame.classList.add("has-image");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(form).entries());
  quoteResult.className = "quote-result";
  quoteResult.innerHTML = "<p>Analyzing the photo and project details...</p>";

  const quote = await createMockQuote(data, selectedPhoto);
  renderQuote(quote, data);
});

async function createMockQuote(data, file) {
  // Replace this function with a real API call to your AWS backend.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const serviceBase = {
    Repair: 185,
    Installation: 420,
    Cleaning: 145,
    Removal: 260,
    "Custom project": 350
  };

  const urgencyMultiplier = {
    Standard: 1,
    Rush: 1.22,
    Emergency: 1.55
  };

  const detailLength = data.details ? data.details.length : 0;
  const photoComplexity = file ? Math.min(file.size / 900000, 2.2) : 0.8;
  const base = serviceBase[data.service] || 300;
  const low = Math.round((base + detailLength * 0.55 + photoComplexity * 55) * urgencyMultiplier[data.urgency]);
  const high = Math.round(low * 1.35 + 75);

  return {
    range: `$${low.toLocaleString()} - $${high.toLocaleString()}`,
    confidence: file ? "Medium, pending human review" : "Low until a photo is provided",
    timeline: data.urgency === "Emergency" ? "Same day if schedule allows" : data.urgency === "Rush" ? "1-2 business days" : "3-5 business days",
    summary: buildSummary(data, Boolean(file))
  };
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
    <p class="note">This prototype uses a local estimate formula. In production, submit the image and fields to an AWS API, run a vision-capable AI model, save the lead, and email or text the quote.</p>
  `;
}

function buildSummary(data, hasPhoto) {
  const service = data.service ? data.service.toLowerCase() : "project";
  const location = data.location ? ` near ${data.location}` : "";
  const photoText = hasPhoto ? "The photo is included for AI review" : "No photo was attached";
  return `${photoText}. The request looks like a ${service}${location}, marked ${data.urgency.toLowerCase()} priority.`;
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
