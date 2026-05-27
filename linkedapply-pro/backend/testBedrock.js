require("dotenv").config({ path: "../config/.env" });
const { callBedrock } = require("./src/utils/awsBedrockService");

async function run() {
  try {
    console.log("Testing AWS Bedrock Converse API with Claude 3 Haiku...");
    const messages = [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello! What is 2 + 2? Answer concisely." }
    ];
    const response = await callBedrock(messages, 50);
    console.log("Response:", response);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
