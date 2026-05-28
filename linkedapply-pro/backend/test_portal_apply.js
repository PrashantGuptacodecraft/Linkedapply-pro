// ============================================================
//  Test Portal Auto-Apply Optimization
//  File: backend/test_portal_apply.js
//  Tests the improved portal application form filling
// ============================================================

require("dotenv").config({ path: "./config/.env" });
const { autofillPortalForm } = require("./src/linkedin/portalApplyService");

async function testPortalApply() {
  // Mock Playwright page (for demonstration)
  const mockPage = {
    url: () => "https://example.com/apply",
    waitForLoadState: async () => {},
    waitForTimeout: async (ms) => new Promise(resolve => setTimeout(resolve, ms)),
    locator: (selector) => ({
      first: () => ({
        isVisible: async () => false,
        click: async () => {},
        fill: async () => {},
        triple_click: async () => {},
        inputValue: async () => "",
        type: async () => {},
      })
    }),
    evaluate: async (fn) => fn(),
    keyboard: { press: async () => {} },
    content: async () => "",
  };

  const testUserData = {
    name: "John Doe",
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    phone: "555-1234",
    location: "San Francisco, CA",
    company: "Tech Corp",
    workAuth: "US Citizen",
    yearsOfExperience: "5+ years",
    linkedinUrl: "https://linkedin.com/in/johndoe",
  };

  console.log("Testing Portal Auto-Apply Optimization...");
  console.log("=========================================");
  
  try {
    const result = await autofillPortalForm(mockPage, testUserData);
    console.log("✅ Test Result:", result);
  } catch (error) {
    console.error("❌ Test Error:", error.message);
  }
}

testPortalApply().catch(console.error);
