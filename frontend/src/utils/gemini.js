import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];

// Retrieves the Gemini API key from environment variables or local storage
export function getGeminiApiKey() {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && envKey !== "PLACEHOLDER") {
    return envKey;
  }
  return localStorage.getItem("gemini_api_key");
}

// Check if Gemini is configured
export function isGeminiConfigured() {
  const key = getGeminiApiKey();
  return !!(key && key.trim().length > 0);
}

// Helper to initialize Gemini SDK
function getGenAI() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Please set VITE_GEMINI_API_KEY or configure it in Settings.");
  }
  return new GoogleGenerativeAI(apiKey);
}

// Parse retry delay from Google's error message (e.g. "Please retry in 47s")
function parseRetryDelay(errorMessage) {
  const match = errorMessage.match(/retry in (\d+)/i);
  if (match) return parseInt(match[1]) * 1000 + 2000; // Add 2s buffer
  return null;
}

// Status callback for UI updates during retries
let _onStatusUpdate = null;
export function setStatusCallback(fn) {
  _onStatusUpdate = fn;
}
function updateStatus(msg) {
  if (_onStatusUpdate) _onStatusUpdate(msg);
  console.log(`[Gemini] ${msg}`);
}

// Retry wrapper with smart backoff — reads Google's retry delay
async function callGeminiWithRetry(prompt) {
  const genAI = getGenAI();
  let lastError = null;
  const MAX_ATTEMPTS = 5;

  for (const modelName of MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        updateStatus(`Trying ${modelName} (attempt ${attempt}/${MAX_ATTEMPTS})...`);
        const model = genAI.getGenerativeModel(
          {
            model: modelName,
            generationConfig: { responseMimeType: "application/json" }
          },
          { apiVersion: "v1beta" }
        );

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        updateStatus(`✅ Success with ${modelName}`);
        return JSON.parse(responseText);
      } catch (err) {
        lastError = err;
        const isOverloaded = err.message && (err.message.includes("503") || err.message.includes("429") || err.message.includes("high demand") || err.message.includes("RESOURCE_EXHAUSTED") || err.message.includes("quota"));
        
        if (isOverloaded) {
          // Try to parse the exact wait time Google tells us
          const serverDelay = parseRetryDelay(err.message);
          const waitMs = serverDelay || (Math.pow(2, attempt) * 5000 + Math.random() * 3000);
          const waitSec = Math.ceil(waitMs / 1000);

          if (attempt < MAX_ATTEMPTS) {
            updateStatus(`⏳ Rate limited. Waiting ${waitSec}s before retry...`);
            // Countdown timer for user
            for (let s = waitSec; s > 0; s--) {
              updateStatus(`⏳ Rate limited — retrying in ${s}s...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } else {
            // Last attempt for this model, try fallback
            updateStatus(`⚠️ ${modelName} failed after ${MAX_ATTEMPTS} attempts. Trying next model...`);
            break;
          }
        } else {
          // Non-retryable error (e.g. 400, 401) — throw immediately
          throw err;
        }
      }
    }
  }

  // All models and retries exhausted
  throw new Error(`Gemini API quota exceeded after multiple retries. Please wait 1-2 minutes and click "Analyze Codebase" again.`);
}

// ============================================================
// SINGLE COMBINED CALL: Analysis + Questions + Resume in ONE request
// This uses only 1 API call instead of 3, saving quota.
// ============================================================
export async function analyzeProject(projectName, filesData) {
  const filesSummaryText = filesData.map(f => {
    return `--- FILE: ${f.path} ---\n${f.content || "(empty file)"}`;
  }).join("\n\n");

  const prompt = `
You are an expert system architect analyzing the project "${projectName}".
Analyze ALL code files below and return a SINGLE JSON object containing:
1) Project analysis & summaries
2) 9 interview questions (3 beginner, 3 intermediate, 3 advanced)
3) ATS-optimized resume entry

Code files:
${filesSummaryText}

Return this EXACT JSON structure:
{
  "analysis": {
    "beginner_summary": "Simple explanation for non-technical users (2-3 sentences).",
    "technical_summary": "Deep technical overview of architecture and design (3-4 sentences).",
    "recruiter_summary": "Professional summary with tech stack keywords (2 sentences).",
    "linkedin_summary": "Engaging LinkedIn post about the project (2-3 sentences).",
    "explain_fresher": "Explanation for junior engineers (2-3 sentences).",
    "explain_swe": "Design patterns and optimization explanation for mid-level engineers (2-3 sentences).",
    "explain_team_lead": "Architecture and scaling explanation for team leads (2-3 sentences).",
    "explain_interview": "How to pitch this project in an interview (2-3 sentences).",
    "diagrams_mermaid": {
      "architecture": "Valid Mermaid.js graph TD diagram of components."
    },
    "complexity_score": 75,
    "quality_score": 80,
    "ats_score": 70,
    "detected_technologies": ["React", "Node.js"]
  },
  "questions": [
    {
      "difficulty": "beginner",
      "question": "Under 20 words. Direct question only.",
      "ideal_answer": "Under 25 words. One sentence.",
      "interviewer_expectations": "Under 15 words.",
      "common_mistakes": "Under 15 words.",
      "best_practices": "Under 15 words."
    }
  ],
  "resume": {
    "project_name": "${projectName}",
    "description": "2-sentence project overview.",
    "key_features": ["Feature 1", "Feature 2", "Feature 3"],
    "technologies": ["React"],
    "achievements": [
      "Action verb + metric achievement bullet point.",
      "Another achievement with quantified impact.",
      "Third achievement with technology keywords."
    ],
    "ats_optimized_text": "ATS-optimized summary paragraph with industry keywords."
  }
}

RULES:
- Mermaid diagrams must be valid syntax with quoted labels.
- Questions must be UNDER 20 words each. Answers under 25 words.
- Generate exactly 9 questions: 3 beginner, 3 intermediate, 3 advanced.
- Return ONLY raw JSON. No markdown wrapping.
`;

  return await callGeminiWithRetry(prompt);
}

// Mock Interview Chat Evaluator (kept separate since it's called during chat)
export async function evaluateMockResponse(projectName, questions, messageHistory, currentMessage) {
  const prompt = `
You are an AI interviewer for "${projectName}".
Questions: ${JSON.stringify(questions)}
History: ${JSON.stringify(messageHistory)}
Candidate said: "${currentMessage}"

Evaluate and respond as interviewer "Vince". Return JSON:
{
  "interviewer_response": "Your next response as interviewer (2-3 sentences).",
  "evaluation": {
    "score": 85,
    "technical_accuracy": "One sentence feedback.",
    "communication": "One sentence feedback.",
    "completeness": "One sentence feedback.",
    "confidence": "One sentence feedback."
  }
}

Return ONLY raw JSON.
`;

  return await callGeminiWithRetry(prompt);
}

