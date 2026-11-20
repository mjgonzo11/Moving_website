const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { webcrypto } = require("node:crypto");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const leadId = "00000000-0000-4000-8000-000000000001";
const secondLeadId = "00000000-0000-4000-8000-000000000002";
let uuidCount = 0;
const quote = {
  range: "$200 - $300",
  summary: "Your moving estimate.",
  timeline: "3-5 business days",
  confidence: "Medium"
};
const fields = {
  name: "Example Customer",
  contact: "customer@example.invalid",
  service: "Moving",
  urgency: "Standard",
  location: "Miami",
  details: "A small apartment move."
};

function response(body = { quote, leadId }, ok = true) {
  return { ok, json: async () => body };
}

function harness(options = {}) {
  const elements = new Map();
  const requests = [];
  const events = [];
  const warnings = [];
  const store = options.store || new Map();
  const state = { valid: true, resets: 0, nextResponse: response(), fields: { ...fields } };
  const generatedIds = [];

  function element(selector) {
    if (!elements.has(selector)) {
      elements.set(selector, {
        handlers: {},
        files: [],
        className: "",
        innerHTML: "",
        textContent: "",
        disabled: false,
        classList: { add() {}, remove() {} },
        addEventListener(event, fn) { this.handlers[event] = fn; },
        removeAttribute() {},
        querySelector: element,
        reportValidity: () => state.valid,
        reset() { state.resets += 1; }
      });
    }
    return elements.get(selector);
  }

  const window = {
    QUOTE_API_URL: "https://api.example.invalid/quote",
    dataLayer: events,
    sessionStorage: {
      getItem(key) {
        if (options.blockStorage) throw new Error("Storage blocked");
        return store.get(key) ?? null;
      },
      setItem(key, value) {
        if (options.blockStorage) throw new Error("Storage blocked");
        store.set(key, value);
      },
      removeItem(key) {
        if (options.blockStorage) throw new Error("Storage blocked");
        store.delete(key);
      }
    },
    crypto: {
      subtle: webcrypto.subtle,
      randomUUID() {
        if (options.blockCrypto) throw new Error("Crypto blocked");
        const id = `11111111-1111-4111-8111-${String(++uuidCount).padStart(12, "0")}`;
        generatedIds.push(id);
        return id;
      }
    }
  };
  if (options.dataLayer) window.dataLayer = options.dataLayer;
  const context = vm.createContext({
    window,
    document: { querySelector: element },
    FormData: class { entries() { return Object.entries(state.fields); } },
    fetch: async (url, init) => {
      requests.push({ url, init });
      if (options.fetch) return options.fetch(url, init);
      return state.nextResponse;
    },
    URL: { createObjectURL: () => "blob:test" },
    TextEncoder,
    console: { warn: (...args) => warnings.push(args) }
  });
  vm.runInContext(appSource, context);
  const submit = () => element("#quoteForm").handlers.submit({ preventDefault() {} });
  return {
    context, window, element, requests, warnings, state, submit, store, generatedIds,
    events: () => JSON.parse(JSON.stringify(events))
  };
}

test("page initialization and hash changes do not emit a conversion", () => {
  const app = harness();
  app.window.location = { hash: "#quote" };
  assert.deepEqual(app.events(), []);
  assert.equal(app.requests.length, 0);
});

test("invalid forms do not submit or emit an event", async () => {
  const app = harness();
  app.state.valid = false;
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.deepEqual(app.events(), []);
  assert.equal(app.element('button[type="submit"]').disabled, false);
});

test("one successful response produces one ID-only event and preserves the POST", async () => {
  const app = harness();
  await app.submit();
  assert.equal(app.requests.length, 1);
  const request = app.requests[0];
  assert.equal(request.url, app.window.QUOTE_API_URL);
  assert.equal(request.init.method, "POST");
  assert.deepEqual({ ...request.init.headers }, { "Content-Type": "application/json" });
  assert.deepEqual(JSON.parse(request.init.body), { ...fields, photos: [] });
  assert.deepEqual(app.events(), [{ event: "quote_submitted", transaction_id: leadId }]);
  assert.match(app.element("#quoteResult").innerHTML, /\$200 - \$300/);
  assert.equal(app.state.resets, 1);
  assert.equal(app.element('button[type="submit"]').disabled, false);
});

test("photo payloads still use the existing compression and API path", async () => {
  const app = harness();
  const encoded = "data:image/jpeg;base64,AQID";
  app.context.testPhoto = { name: "job.jpg" };
  app.context.testEncoded = encoded;
  vm.runInContext("selectedPhotos = [testPhoto]; fileToCompressedDataUrl = async () => testEncoded;", app.context);
  await app.submit();
  assert.deepEqual(JSON.parse(app.requests[0].init.body).photos, [encoded]);
  assert.equal(app.events().length, 1);
});

test("no conversion is emitted until a pending API response succeeds", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const app = harness({ fetch: () => gate });
  const first = app.submit();
  const second = app.submit();
  await second;
  for (let i = 0; i < 50 && !app.requests.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  assert.equal(app.requests.length, 1);
  assert.deepEqual(app.events(), []);
  assert.equal(app.element('button[type="submit"]').disabled, true);
  release(response());
  await first;
  assert.equal(app.events().length, 1);
  assert.equal(app.element('button[type="submit"]').disabled, false);
});

test("the same backend lead ID is queued only once, but another lead can convert", async () => {
  const app = harness();
  await app.submit();
  await app.submit();
  assert.equal(app.events().length, 1);
  app.state.nextResponse = response({ quote, leadId: secondLeadId });
  await app.submit();
  assert.deepEqual(app.events().map((event) => event.transaction_id), [leadId, secondLeadId]);
});

test("session storage suppresses a previously queued lead across page reloads", async () => {
  const store = new Map();
  const firstPage = harness({ store });
  await firstPage.submit();
  const reloaded = harness({ store });
  assert.deepEqual(reloaded.events(), []);
  await reloaded.submit();
  assert.deepEqual(reloaded.events(), []);
  assert.equal(reloaded.state.resets, 1);
});

test("a missing server ID uses a stable ID for each submission", async () => {
  const app = harness();
  app.state.nextResponse = response({ quote });
  await app.submit();
  const first = app.events()[0].transaction_id;
  app.context.retryId = first;
  vm.runInContext("trackQuoteSubmission(undefined, retryId);", app.context);
  assert.equal(app.events().length, 1);
  await app.submit();
  assert.notEqual(app.events()[1].transaction_id, first);
  assert.equal(first, app.generatedIds[0]);
});

test("invalid or email-shaped server IDs are not sent to the tracking event", async () => {
  for (const leadId of ["customer@example.invalid", "ExampleCustomer", "3055550100", "", "a".repeat(65), null, 123]) {
    const app = harness();
    app.state.nextResponse = response({ quote, leadId });
    await app.submit();
    assert.equal(app.events()[0].transaction_id, app.generatedIds[0]);
  }
});

test("missing API configuration prevents both the request and the conversion", async () => {
  const app = harness();
  app.window.QUOTE_API_URL = "";
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.deepEqual(app.events(), []);
  assert.match(app.element("#quoteResult").innerHTML, /Missing API URL/);
  assert.equal(app.element('button[type="submit"]').disabled, false);
});

test("network failures preserve form data and release the submit lock for retry", async () => {
  let fail = true;
  const app = harness({ fetch: () => {
    if (fail) throw new Error("Offline");
    return response();
  } });
  await app.submit();
  assert.deepEqual(app.events(), []);
  assert.equal(app.state.resets, 0);
  assert.equal(app.element('button[type="submit"]').disabled, false);
  fail = false;
  await app.submit();
  assert.equal(app.events().length, 1);
});

test("HTTP errors never convert, even if the response contains a complete quote", async () => {
  const app = harness();
  app.state.nextResponse = response({ quote, leadId, message: "Email rejected" }, false);
  await app.submit();
  assert.deepEqual(app.events(), []);
  assert.equal(app.state.resets, 0);
  assert.match(app.element("#quoteResult").innerHTML, /Email rejected/);
  assert.equal(app.element('button[type="submit"]').disabled, false);
});

test("successful HTTP responses with missing or malformed quotes never convert", async () => {
  const bodies = [null, {}, { quote: null }, { quote: {} }, { quote: "text" }];
  for (const field of ["range", "summary", "timeline", "confidence"]) {
    bodies.push({ quote: { ...quote, [field]: "" } });
    bodies.push({ quote: { ...quote, [field]: "   " } });
    bodies.push({ quote: { ...quote, [field]: 123 } });
  }
  for (const body of bodies) {
    const app = harness();
    app.state.nextResponse = response(body);
    await app.submit();
    assert.deepEqual(app.events(), []);
    assert.equal(app.state.resets, 0);
    assert.match(app.element("#quoteResult").innerHTML, /incomplete estimate/);
    assert.equal(app.element('button[type="submit"]').disabled, false);
  }
});

test("invalid JSON never converts", async () => {
  const app = harness();
  app.state.nextResponse = { ok: true, json: async () => { throw new Error("Invalid JSON"); } };
  await app.submit();
  assert.deepEqual(app.events(), []);
  assert.equal(app.state.resets, 0);
});

test("blocked session storage falls back to in-memory duplicate protection", async () => {
  const app = harness({ blockStorage: true });
  await app.submit();
  await app.submit();
  assert.equal(app.events().length, 1);
  assert.equal(app.state.resets, 2);
});

test("an existing data layer is preserved", async () => {
  const events = [{ event: "existing_event" }];
  const app = harness({ dataLayer: events });
  await app.submit();
  assert.equal(app.window.dataLayer, events);
  assert.equal(events[0].event, "existing_event");
  assert.equal(events[1].event, "quote_submitted");
});

test("a missing data layer is created without loading another Google script", async () => {
  const app = harness();
  delete app.window.dataLayer;
  await app.submit();
  assert.equal(app.window.dataLayer[0].event, "quote_submitted");
  assert.equal(app.state.resets, 1);
});

test("tracking errors never turn a saved quote into a submission error", async () => {
  const dataLayer = { push() { throw new Error("Tracking blocked"); } };
  const app = harness({ dataLayer });
  await app.submit();
  assert.match(app.element("#quoteResult").innerHTML, /\$200 - \$300/);
  assert.equal(app.state.resets, 1);
  assert.equal(app.warnings.length, 1);
  assert.equal(app.store.size, 0);
  assert.equal(app.element('button[type="submit"]').disabled, false);
  dataLayer.push = () => {};
  await app.submit();
  assert.equal(app.store.size, 1);
});

test("a crypto error does not block a successful quote or its fallback ID", async () => {
  const app = harness({ blockCrypto: true });
  app.state.nextResponse = response({ quote });
  await app.submit();
  assert.match(app.events()[0].transaction_id, /^quote-[a-z0-9]+-[a-z0-9]+$/);
  assert.equal(app.state.resets, 1);
});

test("a fallback ID is stable across failed retries of the same submission", async () => {
  let fail = true;
  const app = harness({ fetch: () => {
    if (fail) throw new Error("Offline");
    return response({ quote });
  } });
  await app.submit();
  const pending = JSON.parse(app.store.get("amicus:pending-quote-submission"));
  await app.submit();
  assert.equal(app.generatedIds.length, 1);
  assert.equal(JSON.parse(app.store.get("amicus:pending-quote-submission")).id, pending.id);
  assert.deepEqual(app.events(), []);
  fail = false;
  await app.submit();
  assert.equal(app.events()[0].transaction_id, pending.id);
  assert.equal(app.store.has("amicus:pending-quote-submission"), false);
});

test("a matching pending submission keeps its fallback ID after a page reload", async () => {
  const store = new Map();
  const failed = harness({ store, fetch: () => { throw new Error("Offline"); } });
  await failed.submit();
  const pending = JSON.parse(store.get("amicus:pending-quote-submission"));
  const reloaded = harness({ store });
  reloaded.state.nextResponse = response({ quote });
  await reloaded.submit();
  assert.equal(reloaded.events()[0].transaction_id, pending.id);
  assert.equal(reloaded.generatedIds.length, 0);
});

test("edited project details create a new pending submission identity", async () => {
  const app = harness({ fetch: () => { throw new Error("Offline"); } });
  await app.submit();
  const first = JSON.parse(app.store.get("amicus:pending-quote-submission"));
  app.state.fields.details = "A different project.";
  await app.submit();
  const second = JSON.parse(app.store.get("amicus:pending-quote-submission"));
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.fingerprint, second.fingerprint);
  assert.equal(app.generatedIds.length, 2);
});

test("completed submissions retire the pending ID even for identical subsequent details", async () => {
  const app = harness();
  app.state.nextResponse = response({ quote });
  await app.submit();
  await app.submit();
  assert.equal(app.events().length, 2);
  assert.notEqual(app.events()[0].transaction_id, app.events()[1].transaction_id);
  assert.equal(app.store.has("amicus:pending-quote-submission"), false);
});

test("stored retry state and the event contain no raw customer fields or photos", async () => {
  const app = harness({ fetch: () => { throw new Error("Offline"); } });
  await app.submit();
  const raw = app.store.get("amicus:pending-quote-submission");
  const pending = JSON.parse(raw);
  assert.deepEqual(Object.keys(pending).sort(), ["fingerprint", "id"]);
  assert.match(pending.fingerprint, /^[a-f0-9]{64}$/);
  for (const field of Object.values(fields)) assert.equal(raw.includes(field), false);
  app.context.testBody = JSON.stringify({ ...fields, photos: [] });
  app.context.identity = pending.id;
  vm.runInContext("trackQuoteSubmission(undefined, identity);", app.context);
  assert.deepEqual(Object.keys(app.events()[0]).sort(), ["event", "transaction_id"]);
});

test("blocked hashing and storage still keep a retry ID stable in memory", async () => {
  let fail = true;
  const app = harness({ blockStorage: true, blockCrypto: true, fetch: () => {
    if (fail) throw new Error("Offline");
    return response({ quote });
  } });
  app.window.crypto.subtle = undefined;
  await app.submit();
  const first = vm.runInContext("pendingSubmission.id", app.context);
  await app.submit();
  assert.equal(vm.runInContext("pendingSubmission.id", app.context), first);
  fail = false;
  await app.submit();
  assert.equal(app.events()[0].transaction_id, first);
  assert.equal(app.state.resets, 1);
});

test("corrupt stored retry state cannot block a quote or inject a transaction ID", async () => {
  const store = new Map([["amicus:pending-quote-submission", "{invalid json"]]);
  const app = harness({ store });
  app.state.nextResponse = response({ quote });
  await app.submit();
  assert.equal(app.events()[0].transaction_id, app.generatedIds[0]);
  assert.equal(app.state.resets, 1);
});

test("server UUID case differences do not create another conversion", async () => {
  const app = harness();
  const lower = "abcdefab-abcd-4abc-8abc-abcdefabcdef";
  app.state.nextResponse = response({ quote, leadId: lower.toUpperCase() });
  await app.submit();
  app.state.nextResponse = response({ quote, leadId: lower });
  await app.submit();
  assert.deepEqual(app.events(), [{ event: "quote_submitted", transaction_id: lower }]);
});
