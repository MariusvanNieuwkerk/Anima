import Replicate from "replicate";

export async function generateImage(prompt: string) {
  console.log("🎨 [Clean Engine] Generating:", prompt);

  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("❌ No Token found");
    throw new Error("Server configuration error: Missing API Token");
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  try {
    // De simpele, robuuste Flux Schnell aanroep
    const output = await replicate.run(
      "black-forest-labs/flux-schnell",
      {
        input: {
          prompt: prompt,
          aspect_ratio: "1:1",
          output_format: "jpg",
          disable_safety_checker: true
        }
      }
    );

    // Flux geeft een array van URL's terug. Pak de eerste.
    const imageUrl = Array.isArray(output) ? output[0] : String(output);
    console.log("✅ [Clean Engine] Success:", imageUrl);
    
    return { url: imageUrl, alt: prompt };

  } catch (error: any) {
    console.error("❌ [Clean Engine] Error:", error.message);
    // Gooi een simpele error die de frontend snapt
    throw new Error("Visual generation failed");
  }
}
