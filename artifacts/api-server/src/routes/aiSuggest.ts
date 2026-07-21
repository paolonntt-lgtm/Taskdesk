import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/auth";
import OpenAI from "openai";
import { z } from "zod/v4";

const router: IRouter = Router();

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const bodySchema = z.object({
  description: z.string().min(10).max(3000),
  category: z.string().optional(),
});

router.post("/ai/suggest-title", requireAuth, async (req, res): Promise<void> => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { description, category } = parsed.data;
  const plainText = description
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);

  if (plainText.length < 10) {
    res.status(400).json({ error: "Description too short after stripping HTML" });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You generate concise support ticket titles. " +
            "Given a description, return ONLY a short title (max 70 characters). " +
            "No quotes, no trailing punctuation, no explanation. " +
            "Match the language of the description.",
        },
        {
          role: "user",
          content: category
            ? `Category: ${category}\nDescription: ${plainText}`
            : `Description: ${plainText}`,
        },
      ],
      max_tokens: 60,
      temperature: 0.3,
    });

    const title = (completion.choices[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    if (!title) {
      res.status(500).json({ error: "Empty suggestion" });
      return;
    }

    res.json({ title });
  } catch {
    res.status(500).json({ error: "AI error" });
  }
});

export default router;
