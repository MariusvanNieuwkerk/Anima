import Replicate from "replicate";

type GenerateImageResult = { url: string; alt: string };

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

async function streamToDataUrl(stream: ReadableStream, mimeType: string) {
  const arrayBuffer = await new Response(stream).arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType: string) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

function uint8ArrayToDataUrl(buffer: Uint8Array, mimeType: string) {
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${mimeType};base64,${base64}`;
}

async function normalizeReplicateOutputToUrl(output: unknown): Promise<string> {
  // Common case: Replicate returns a URL string (or an array of URL strings).
  if (typeof output === "string") return output;

  if (Array.isArray(output)) {
    const firstString = output.find((x) => typeof x === "string") as string | undefined;
    if (firstString) return firstString;
  }

  // Some SDKs/models may return { url: "..." }
  if (output && typeof output === "object" && "url" in output) {
    const maybeUrl = (output as any).url;
    if (typeof maybeUrl === "string") return maybeUrl;
  }

  // As requested in the blueprint: handle a ReadableStream output by converting to a data URL.
  if (output instanceof ReadableStream) {
    return await streamToDataUrl(output, "image/jpeg");
  }

  // Fallbacks for binary-like outputs
  if (output instanceof ArrayBuffer) {
    return arrayBufferToDataUrl(output, "image/jpeg");
  }

  if (output instanceof Uint8Array) {
    return uint8ArrayToDataUrl(output, "image/jpeg");
  }

  // Node.js Buffer is also a Uint8Array, but keep explicit for clarity
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(output)) {
    return uint8ArrayToDataUrl(output, "image/jpeg");
  }

  throw new Error(`Unsupported Replicate output type: ${Object.prototype.toString.call(output)}`);
}

export async function generateImage(prompt: string): Promise<GenerateImageResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error("Missing REPLICATE_API_TOKEN environment variable");
  }

  const normalizedPrompt = (prompt || "").trim().replace(/\s+/g, " ");
  if (!normalizedPrompt) {
    throw new Error("Prompt is required");
  }

  const replicate = new Replicate({ auth: token });

  const output = await replicate.run("black-forest-labs/flux-schnell", {
    input: {
      prompt: normalizedPrompt,
      aspect_ratio: "1:1",
      output_format: "jpg",
      safety_tolerance: 2,
    },
  });

  const url = await normalizeReplicateOutputToUrl(output);
  const finalUrl = isHttpUrl(url) || url.startsWith("data:") ? url : url;

  // VISIBILITY (DEBUG): show the final “URL” returned (often a Replicate-hosted URL)
  console.log("[VISUAL] Replicate output URL:", isHttpUrl(finalUrl) ? finalUrl : "[data-url]");

  return { url: finalUrl, alt: normalizedPrompt };
}


