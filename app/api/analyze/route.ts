// app/api/analyze/route.ts
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Teacher analytics AI chat (docs/AI.md).
 *
 * ⚠️ The identity and the quota are SERVER-OWNED and must stay that way:
 *   - `uid` comes from the verified ID token, never from the body. Otherwise a
 *     caller could spend someone else's quota (or a made-up user's).
 *   - the daily cap is read from env here, never from the body. It used to be
 *     passed in by the client (Remote Config), which meant the caller chose
 *     their own limit — the check was decorative.
 *   - `ai_usage` is written with the Admin SDK, so its rules stay `if false`.
 */
const DAILY_LIMIT = Number(process.env.AI_ANALYZE_DAILY_LIMIT) || 15;

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const match = authHeader.match(/^Bearer (.+)$/);
  if (!match) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let userId: string;
  try {
    userId = (await adminAuth.verifyIdToken(match[1])).uid;
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, promptData, lang, analysisMode, message, history } = body;

    // Daily limit check — doc id is per user per UTC day.
    const today = new Date().toISOString().split('T')[0];
    const usageRef = adminDb.doc(`ai_usage/${userId}_${today}`);
    const usageSnap = await usageRef.get();
    const currentUsage = usageSnap.exists ? (usageSnap.data()?.count ?? 0) : 0;

    if (currentUsage >= DAILY_LIMIT) {
      return NextResponse.json({ error: 'DAILY_LIMIT_REACHED' }, { status: 429 });
    }

    // 🟢 2. AI GENERATION LOGIC
    const languageInstruction =
      lang === 'uz' ? "Respond entirely in Uzbek." :
      lang === 'ru' ? "Respond entirely in Russian." : "Respond entirely in English.";

    const systemInstruction = `You are a warm, observant mentor to a Math Teacher and you are giving advices and infos to teacher. Give actionable advice under 150 words. Use emojis. No markdown headers. ${languageInstruction} DATA CONTEXT: ${JSON.stringify(promptData)}`;

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction });
    let aiResponseText = "";
    let initialPromptSent = "";

    if (action === "initial") {
       initialPromptSent = analysisMode === "student"
         ? "Provide a 3-bullet summary: 1. 📈 Math Momentum 2. 🌟 Bright Spots 3. 🎯 The Next Play."
         : "Provide a 3-bullet summary: 1. 📊 Classroom Pulse 2. 👑 Math Champions 3. 🚨 Radar & Action.";
       const result = await model.generateContent(initialPromptSent);
       aiResponseText = result.response.text();
    } else if (action === "chat") {
       const chat = model.startChat({ history: history || [] });
       const result = await chat.sendMessage(message);
       aiResponseText = result.response.text();
    }

    // 🟢 3. RECORD THE USAGE
    await usageRef.set(
      { count: FieldValue.increment(1), userId, date: today },
      { merge: true },
    );

    return NextResponse.json({ text: aiResponseText, initialPromptSent });

  } catch (error: any) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: "SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
