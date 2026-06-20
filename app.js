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
  quoteResult.innerHTML = "<p>Calculating your estimate...</p>";

  try {
    const quote = await requestQuote(data, selectedPhoto);
    renderQuote(quote, data);
    form.reset();
    selectedPhoto = null;
    previewFrame.classList.remove("has-image");
    previewImage.removeAttribute("src");
    uploadMeta.textContent = "JPG, PNG, or HEIC from a phone camera";
  } catch (error) {
    quoteResult.className = "quote-result";
    quoteResult.innerHTML = `<p class="note">${escapeHtml(error.message || "Something went wrong. Please try again.")}</p>`;
  }
});

async function requestQuote(data, file) {
  const apiUrl = window.QUOTE_API_URL;

  if (!apiUrl || apiUrl.includes("replace-with-your-api")) {
    throw new Error("Missing API URL. Update config.js with your API Gateway endpoint after deploying the AWS backend.");
  }

  const payload = {
    name: data.name,
    contact: data.contact,
    service: data.service,
    urgency: data.urgency,
    location: data.location,
    details: data.details,
    photo: file ? await fileToCompressedDataUrl(file) : null
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "The quote API could not process this request.");
  }

  return result.quote;
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
        const maxSize = 1280;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
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

