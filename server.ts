import express from 'express';
import path from 'path';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

// Configure body parsing with generous limits for file handling
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Set up Multer memory storage for uploads (up to 20MB)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB limit
});

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to parse PDF documents cleanly
const parsePdf = async (buffer: Buffer): Promise<string> => {
  let parser: PDFParse | null = null;
  try {
    parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    return textResult.text || '';
  } catch (error: any) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF document: ${error.message || error}`);
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (destroyErr) {
        console.error('Error destroying PDFParse instance:', destroyErr);
      }
    }
  }
};

// Helper to parse Word DOCX
const parseDocx = async (buffer: Buffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('Error parsing DOCX:', error);
    throw new Error('Failed to parse Word Document.');
  }
};

// Robust helper to query Gemini models with exponential backoff and model fallbacks (handles transient 503/UNAVAILABLE errors)
const callGeminiWithRetry = async (
  prompt: string,
  config: any,
  initialModel: string = 'gemini-3.5-flash',
  retries: number = 3,
  delayMs: number = 2000
): Promise<any> => {
  const modelsToTry = [initialModel, 'gemini-2.5-flash', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const model = modelsToTry[attempt % modelsToTry.length];
    try {
      console.log(`Sending prompt to ${model} (Attempt ${attempt + 1}/${retries})...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config,
      });
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`Attempt ${attempt + 1} with ${model} failed:`, err.message || err);
      
      const isTransient = !err.status || err.status === 503 || err.status === 429 || err.status === 500 || err.message?.includes('demand') || err.message?.includes('limit');
      
      if (!isTransient && attempt === 0) {
        console.log('Non-transient error, attempting model fallback anyway...');
      }

      if (attempt < retries - 1) {
        const sleepTime = delayMs * Math.pow(2, attempt);
        console.log(`Waiting ${sleepTime}ms before next retry...`);
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      }
    }
  }
  throw lastError;
};

// Mock library of popular books for instant analysis/demos
const SAMPLE_BOOKS: Record<string, string> = {
  'atomic-habits': 'Atomic Habits by James Clear. Focuses on building small, incremental 1% daily improvements to build remarkable systems of habits. Topics include the 4 laws of behavior change: make it obvious, make it attractive, make it easy, and make it satisfying. It covers habit stacking, identity-based habits, and the difference between goals vs systems.',
  'thinking-fast-and-slow': 'Thinking, Fast and Slow by Daniel Kahneman. Introduces System 1 (fast, automatic, emotional, subconscious) and System 2 (slow, effortful, logical, calculating) thinking. It covers cognitive biases, prospect theory, heuristics, loss aversion, anchoring, and how human decision-making deviates from strict rationality.',
  'the-7-habits': 'The 7 Habits of Highly Effective People by Stephen Covey. Principles-centered leadership framework. Habits 1-3 focus on self-mastery (Be Proactive, Begin with the End in Mind, Put First Things First). Habits 4-6 focus on interpersonal relations (Think Win-Win, Seek First to Understand, Synergize). Habit 7 is self-renewal (Sharpen the Saw).',
  'deep-work': 'Deep Work by Cal Newport. Rules for focused success in a distracted world. Defines deep work as professional activities performed in a state of distraction-free concentration that push cognitive capabilities. Discusses deep work practices, minimizing shallow work, embracing boredom, quitting social media, and protecting focus blocks.'
};

// In-memory cache memory store for registered users' usage history
interface UserCache {
  email: string;
  provider: 'google' | 'email';
  name: string;
  avatarUrl?: string;
  history: any[];
}

const cacheMemoryStore = new Map<string, UserCache>();

// Authentication endpoint supporting Gmail/Google and Email ID login
app.post('/api/auth/login', (req, res) => {
  const { email, provider, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email/Gmail ID is required for logging in.' });
  }

  // Validate if it is a Gmail ID when using Google provider
  if (provider === 'google' && !email.toLowerCase().endsWith('@gmail.com') && !email.toLowerCase().endsWith('@googlemail.com')) {
    return res.status(400).json({ error: 'Please log in with a valid Gmail ID.' });
  }
  
  const userKey = email.toLowerCase();
  
  // Retrieve from in-memory cache or create a new entry
  let cachedUser = cacheMemoryStore.get(userKey);
  if (!cachedUser) {
    cachedUser = {
      email,
      provider: provider || 'email',
      name: name || email.split('@')[0],
      avatarUrl: provider === 'google' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80' : undefined,
      history: []
    };
    cacheMemoryStore.set(userKey, cachedUser);
  }

  return res.json({
    message: 'Login successful. Usage history synchronized with server cache memory.',
    user: {
      email: cachedUser.email,
      provider: cachedUser.provider,
      name: cachedUser.name,
      avatarUrl: cachedUser.avatarUrl,
    },
    history: cachedUser.history
  });
});

// Sync usage history to server cache memory
app.post('/api/user/history', (req, res) => {
  const { email, history } = req.body;
  const userKey = (email || '').toLowerCase();
  if (!userKey) {
    return res.status(400).json({ error: 'User identifier required for cache storage.' });
  }

  let cachedUser = cacheMemoryStore.get(userKey);
  if (!cachedUser) {
    // If not found, create a placeholder in cache
    cachedUser = {
      email: email,
      provider: email.toLowerCase().endsWith('@gmail.com') ? 'google' : 'email',
      name: email.split('@')[0],
      history: []
    };
  }

  // Update in-memory cache
  cachedUser.history = history || [];
  cacheMemoryStore.set(userKey, cachedUser);

  return res.json({
    message: 'Usage history synchronized successfully with server-side cache memory.',
    historyCount: cachedUser.history.length
  });
});

// Get user history from cache memory
app.get('/api/user/history', (req, res) => {
  const { email } = req.query;
  const userKey = String(email || '').toLowerCase();
  if (!userKey) {
    return res.status(400).json({ error: 'User identifier required.' });
  }

  const cachedUser = cacheMemoryStore.get(userKey);
  if (!cachedUser) {
    return res.json({
      history: []
    });
  }

  return res.json({
    history: cachedUser.history
  });
});

// Robust helper to parse and extract JSON from model responses (handles potential markdown wrapping or conversational prefixes)
const parseStructuredResponse = (text: string): any => {
  const trimmed = text.trim();
  
  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch (directError) {
    console.warn('Direct JSON parse failed, trying alternative extractions...', directError);
  }

  // Try extraction of ```json ... ``` or ``` ... ``` markdown code block
  try {
    const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
    const match = trimmed.match(jsonBlockRegex);
    if (match && match[1]) {
      return JSON.parse(match[1].trim());
    }
  } catch (blockError) {
    console.warn('Markdown code block extraction failed...', blockError);
  }

  // Try extracting everything from the first curly brace '{' to the last curly brace '}'
  try {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      return JSON.parse(candidate.trim());
    }
  } catch (braceError) {
    console.warn('Curly brace extraction failed...', braceError);
  }

  // If everything failed, throw a descriptive parsing error
  throw new Error(`Failed to parse structured response as JSON. Raw output: ${trimmed.substring(0, 150)}...`);
};

// Main Analysis API Route
app.post('/api/analyze-book', upload.single('file'), async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({
        error: 'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Secrets.'
      });
    }

    let textContent = '';
    let fileName = '';
    let isSample = false;

    // Check if analyzing a sample book instead
    const sampleId = req.body.sampleId;
    if (sampleId && SAMPLE_BOOKS[sampleId]) {
      textContent = SAMPLE_BOOKS[sampleId];
      fileName = `${sampleId.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} (Sample Summary)`;
      isSample = true;
    } else {
      // Handle file upload
      if (!req.file) {
        return res.status(400).json({ error: 'Please upload a PDF, DOCX, or TXT file, or choose a sample book.' });
      }

      fileName = req.file.originalname;
      const mimeType = req.file.mimetype;
      const buffer = req.file.buffer;

      if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
        textContent = await parsePdf(buffer);
      } else if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileName.endsWith('.docx')
      ) {
        textContent = await parseDocx(buffer);
      } else if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
        textContent = buffer.toString('utf-8');
      } else {
        return res.status(400).json({ error: 'Unsupported file format. Please upload a .pdf, .docx, or .txt file.' });
      }
    }

    // Clean up text and truncate to a safe limit to avoid model overload and maintain latency
    textContent = textContent.trim();
    if (!textContent) {
      return res.status(400).json({ error: 'The uploaded file is empty or no extractable text was found.' });
    }

    const maxChars = 500000; // ~100,000 words limit for analysis
    let wasTruncated = false;
    if (textContent.length > maxChars) {
      textContent = textContent.substring(0, maxChars);
      wasTruncated = true;
    }

    // Call Gemini using structured output schema to meet strict user requests
    const model = 'gemini-3.5-flash';

    const prompt = `
      You are an expert, world-class book analyst and avid reader. 
      Analyze the following text extracted from a book (or book excerpt) titled "${fileName}".

      ${isSample ? "Note: This is a descriptive excerpt of a famous book. Please expand your deep expertise on this entire famous book to provide highly comprehensive results." : ""}

      Please fulfill these requirements:
      1. Categorize the book into one of the specified categories: "problem-solving", "decision making", "time management", or determine an appropriate highly-relevant alternative category if it does not fit those three.
      2. Provide a beautiful, comprehensive, and structured summary in markdown format of the book's core thesis, arguments, and content.
      3. Extract 5 to 7 powerful, timeless, and actionable insights that help build work and life skills.
      4. Advise on practical applications: how to realistically translate these insights into daily habits, rituals, systems, and principles.
      5. Evaluate if this book ranks among the Top 5 books in its category. Provide a robust, comparative, and highly objective justification citing other seminal books in the same space.

      Here is the book's content:
      --- START BOOK CONTENT ---
      ${textContent}
      --- END BOOK CONTENT ---
    `;

    const response = await callGeminiWithRetry(prompt, {
      systemInstruction: "You are an analytical, deeply thoughtful book mentor. You extract deep wisdom and practical principles, avoiding generic business buzzwords.",
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "The definitive title of the book." },
          author: { type: Type.STRING, description: "The author(s) of the book." },
          category: { 
            type: Type.STRING, 
            description: "Must be 'problem-solving', 'decision making', 'time management', or a highly relevant alternative category." 
          },
          summary: { 
            type: Type.STRING, 
            description: "A comprehensive summary of the book's core thesis and chapter insights in markdown format." 
          },
          timelessInsights: {
            type: Type.ARRAY,
            description: "5 to 7 deep, powerful, and timeless insights for work and life.",
            items: {
              type: Type.OBJECT,
              properties: {
                insight: { type: Type.STRING, description: "A punchy, memorable insight statement." },
                description: { type: Type.STRING, description: "Deep explanation of the insight's wisdom." },
                actionableTakeaway: { type: Type.STRING, description: "An actionable takeaway or concrete advice for implementing this." }
              },
              required: ["insight", "description", "actionableTakeaway"]
            }
          },
          practicalApplication: {
            type: Type.OBJECT,
            description: "Advice on how to realistically apply the insights.",
            properties: {
              habits: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Daily/weekly habits to form." },
              rituals: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Morning, evening, or workplace rituals to establish." },
              systems: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Structured systems, templates, trackers, or processes to maintain." },
              principles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Core guiding rules for decision making and mindset." }
            },
            required: ["habits", "rituals", "systems", "principles"]
          },
          top5Evaluation: {
            type: Type.OBJECT,
            properties: {
              isTop5: { type: Type.BOOLEAN, description: "True if this book ranks in the top 5 in its category." },
              rankingJustification: { type: Type.STRING, description: "A detailed comparison with other seminal works in the category, detailing why it deserves or does not deserve a top 5 spot." }
            },
            required: ["isTop5", "rankingJustification"]
          }
        },
        required: ["title", "author", "category", "summary", "timelessInsights", "practicalApplication", "top5Evaluation"]
      }
    }, model);

    const responseText = response.text;
    if (!responseText) {
      throw new Error('Received empty response from the analysis model.');
    }

    const parsedData = parseStructuredResponse(responseText);
    
    return res.json({
      ...parsedData,
      wasTruncated,
      fileAnalyzed: fileName,
      charCount: textContent.length
    });

  } catch (error: any) {
    console.error('Error analyzing book:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred during book analysis.'
    });
  }
});

// Configure Vite or Static Files
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer();
