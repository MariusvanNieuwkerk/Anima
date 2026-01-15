import Replicate from "replicate";

export async function generateImage(prompt: string) {
  console.log("🎨 [Clean Engine] Generating:", prompt);

  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("Server configuration error: Missing API Token");
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  try {
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

    console.log("📦 Raw Output Type:", typeof output);
    
    // FIX: Unwrap Replicate Output (Handle Stream vs String)
    let imageItem = Array.isArray(output) ? output[0] : output;
    let imageUrl = "";

    if (typeof imageItem === "string") {
      imageUrl = imageItem;
    } else if (imageItem && typeof imageItem === "object" && "url" in imageItem) {
      // Handle file output objects
      imageUrl = String((imageItem as any).url());
    } else if (imageItem && typeof imageItem.toString === "function") {
      imageUrl = imageItem.toString();
    } else {
      console.error("❌ Unknown output format:", imageItem);
      throw new Error("Kon geen URL uit de output halen");
    }

    console.log("✅ Final URL:", imageUrl);
    
    return { url: imageUrl, alt: prompt };

  } catch (error: any) {
    console.error("❌ [Clean Engine] Error:", error.message);
    throw new Error("Visual generation failed");
  }
}