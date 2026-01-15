import Replicate from "replicate";

export async function generateImage(prompt: string) {
  console.log("🎨 [START] Flux Generation requested for:", prompt);

  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("Missing REPLICATE_API_TOKEN");
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  try {
    // Ultra-simpele aanroep om parameter-fouten te voorkomen
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          // We laten alle geavanceerde settings weg voor veiligheid
          aspect_ratio: "1:1",
          output_format: "jpg",
          disable_safety_checker: true
        }
      }
    );

    console.log("✅ Replicate Success:", output);

    // Flux geeft een array van strings terug
    const url = Array.isArray(output) ? output[0] : String(output);
    return { url, alt: prompt };

  } catch (error: any) {
    // Log de ECHTE fout van Replicate (bijv. 'Billing not set up')
    console.error("❌ REPLICATE ERROR:", error.message);
    throw new Error(`Visual failed: ${error.message}`);
  }
}
