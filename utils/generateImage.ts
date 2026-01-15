import Replicate from "replicate";

export async function generateImage(prompt: string) {
  console.log("🎨 [START] Flux Generation requested for:", prompt);

  // 1. Check of de sleutel er is
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error("❌ CRITICAL: REPLICATE_API_TOKEN is not found in environment variables.");
    throw new Error("Server Error: Missing API Key");
  }

  // 2. Check of de sleutel er 'gezond' uitziet (begint met r8_)
  if (!process.env.REPLICATE_API_TOKEN.startsWith("r8_")) {
    console.warn("⚠️ WARNING: Token does not start with 'r8_'. Usually Replicate tokens start with r8_.");
  }

  const replicate = new Replicate({
    auth: process.env.REPLICATE_API_TOKEN,
  });

  try {
    // 3. De 'Safe Mode' aanroep (Minimale parameters)
    // We gebruiken black-forest-labs/flux-schnell
    console.log("🚀 Sending request to Replicate...");
    
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

    console.log("✅ Replicate Raw Output:", output);

    // 4. Output verwerking (Flux geeft een Array van streams/urls terug)
    let imageUrl = "";
    if (Array.isArray(output) && output.length > 0) {
      imageUrl = String(output[0]);
    } else if (typeof output === "string") {
      imageUrl = output;
    } else {
      console.error("❌ Unexpected output format:", output);
      throw new Error("Invalid output from AI model");
    }

    console.log("🖼️ Final Image URL:", imageUrl);

    return { 
      url: imageUrl, 
      alt: prompt 
    };

  } catch (error: any) {
    // 5. DE FATALE FOUT LOGGEN
    console.error("❌ REPLICATE CRASHED:");
    console.error("   --> Message:", error.message);
    console.error("   --> Name:", error.name);
    
    // Als Replicate meer info geeft, log die ook
    if (error.response) {
      try {
         const errorBody = await error.response.text(); // of json()
         console.error("   --> API Response Body:", errorBody);
      } catch (e) {
         console.error("   --> Could not read error body");
      }
    }

    throw new Error(`Visual Generation Failed: ${error.message}`);
  }
}


