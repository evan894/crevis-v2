import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is missing. Search fallback will be used.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key_to_prevent_crash");

export const geminiModel = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
});

export async function searchProductsWithGemini(
  query: string,
  productsJson: string
): Promise<string[]> {
  try {
    const prompt = `Given this list of products: ${productsJson}
Find the top 3 most relevant matches for this search query:
'${query}'
Return ONLY a JSON array of product IDs. No explanation.
Example: ["uuid1", "uuid2", "uuid3"]`;

    // Timeout logic using AbortSignal if available, but SDK doesn't natively support signal easily in run.
    // We wrap it in a Promise.race for the 3s timeout.
    
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini timeout (>3s)")), 3000)
    );

    const callPromise = geminiModel.generateContent(prompt).then(res => res.response.text());

    const result = await Promise.race([callPromise, timeoutPromise]);

    // parse JSON
    const parsed = JSON.parse(result.replace(/```json/g, '').replace(/```/g, '').trim());
    
    if (Array.isArray(parsed)) {
       return parsed as string[];
    }
    
    return [];
  } catch (error) {
    console.error("Gemini Search Error:", error);
    throw error;
  }
}
