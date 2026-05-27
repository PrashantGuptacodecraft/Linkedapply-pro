require("dotenv").config({ path: "../config/.env" });
const { callGemini } = require("./src/utils/geminiService");

async function run() {
  try {
    console.log("Testing Gemini API with Gemini 1.5 Flash...");
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello! What is 2 + 2? Answer concisely." }
    ];
    const response = await callGemini(messages, 50);
    console.log("Response:", response);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
