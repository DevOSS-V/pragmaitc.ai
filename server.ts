import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { findSemanticReferences } from "./parser.js";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.post("/api/audit", async (req, res) => {
    const { fileName, line, character, files, targetCode } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API Key not configured on server." });
    }

    const usageSnippets = findSemanticReferences(files, fileName, line, character);

    const prompt = `
Analyze the following code symbol and its usage across the project for architectural risks and blast radius.

Target Code Snippet:
${targetCode}

Usage Snippets across project:
${JSON.stringify(usageSnippets, null, 2)}

Return the analysis as a valid JSON object with the following structure:
{
  "riskScore": number,
  "riskLabel": string,
  "architecturalRisks": string[],
  "warnings": string[],
  "migrationStrategy": string,
  "engineStats": {
    "references": number,
    "contextSize": string,
    "brain": string,
    "latency": string
  },
  "affectedDependencyChain": [
    { "filePath": string, "impactType": string, "refs": number }
  ]
}
`;

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: "You are a Senior Principal Software Engineer. Analyze the provided code and dependencies for architectural risks and blast radius. Return the analysis as a valid JSON object.",
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      });

      const result = await model.generateContent(prompt);
      res.json(JSON.parse(result.response.text()));
    } catch (error) {
      console.error("Gemini API error:", error);
      res.status(500).json({ error: "Failed to generate audit report" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
