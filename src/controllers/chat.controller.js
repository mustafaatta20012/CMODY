// src/controllers/chat.controller.js
// DeepSeek API is called SERVER-SIDE — API key never exposed to browser
const axios = require("axios");
const { prisma } = require("../config/database");
const { ApiResponse } = require("../utils/ApiResponse");
const { v4: uuidv4 } = require("uuid");

const SYSTEM_PROMPT = `You are a helpful shopping assistant for CMODY, a premium e-commerce coffee and drinks store.

Products available:
COFFEE: Premium Arabica Beans ($16.99), Ethiopian Yirgacheffe ($18.99), Cold Brew Coffee ($4.99), Cold Brew Starter Set ($34.99)
DRINKS: Cappuccino To-Go ($3.99), Mango Smoothie ($5.49), Mango Lassi ($4.49), Tropical Smoothie ($5.99)

Store policies:
- Free shipping on orders over $50
- 30-day return policy
- Secure SSL payment
- Coupon codes: CMODY10 (10% off), SAVE20 (20% off)

Tone & Behavior:
- Be incredibly friendly, warm, and helpful.
- Adaptively match the user's dialect! If the user writes in Egyptian Arabic (e.g. "عايز قهوة", "بكام ده يا باشا"), reply in a warm, witty Egyptian dialect. If they write in Gulf Arabic (e.g. "أبي قهوة", "جم سعرها"), reply in a polite, premium Gulf tone. If they write in English, reply in casual, friendly English.
- Always try to be concise and delightful.`;

// ── Dialect-Matching Local Fallback Engine ────────
function localFallbackChat(message) {
  const msg = message.toLowerCase().trim();
  
  // Detect language and dialect
  let dialect = "en";
  if (/[\u0600-\u06FF]/.test(msg)) {
    // Arabic detected
    if (msg.includes("يا باشا") || msg.includes("عايز") || msg.includes("فين") || msg.includes("بكام") || msg.includes("ايه") || msg.includes("معايا") || msg.includes("شحن") || msg.includes("حبيبي") || msg.includes("ازيك") || msg.includes("يا عم") || msg.includes("يا غالي")) {
      dialect = "eg"; // Egyptian
    } else if (msg.includes("بي") || msg.includes("ابي") || msg.includes("وش") || msg.includes("بكم") || msg.includes("وين") || msg.includes("يعطيك") || msg.includes("شلونك") || msg.includes("يا خوي")) {
      dialect = "gulf"; // Gulf
    } else {
      dialect = "ar"; // Standard/Generic Arabic
    }
  }

  // Define responses
  const responses = {
    eg: {
      greeting: "أهلاً بيك يا فنان في CMODY! نورتنا والله. تؤمرني بإيه النهاردة؟ حابب تجرب قهوتنا الفاخرة ولا مشروب منعش؟ ☕🥤",
      coffee: "يا سلام على المزاج! عندنا بن أرابيكا مميز جداً بـ 16.99$، وبن إثيوبي يورجاشيف يظبط الدماغ بـ 18.99$. لو بتحب البارد، عندنا كولد برو جاهز بـ 4.99$ ومجموعة تحضير الكولد برو بـ 34.99$. تطلب إيه؟ 😍",
      drinks: "عايز تروق؟ عندنا أحلى سموذي مانجو بـ 5.49$، ومانجو لاسي بـ 4.49$، وسموذي استوائي بـ 5.99$. وكمان كابوتشينو للروقان بـ 3.99$. جرب وادعيلي! 🥤✨",
      shipping: "بص يا سيدي، لو طلباتك عدت الـ 50$، الشحن بيبقى مجاني تماماً لحد باب بيتك! غير كده بيبقى فيه رسوم شحن بسيطة. 🚚💨",
      coupon: "منورنا يا باشا! خد الكوبون ده CMODY10 هيديك خصم 10% فوراً، وفي كمان SAVE20 بيديك خصم 20% على المنتجات المميزة. دلع نفسك! 😉🎁",
      return_policy: "ولا تشيل هم خالص! لو فيه أي حاجة مش عاجباك، تقدر ترجعها خلال 30 يوم بكل سهولة، أهم حاجة تكون بحالتها الأصلية. رضاك يهمنا! 🤝",
      about: "إحنا CMODY، بنعشق القهوة وبنقدم أحلى حبوب بن محمصة بعناية ومشروبات تروق المزاج، عشان يومك يبدأ صح! ☕✨",
      default: "حبيبي تسلم! أنا معاك عشان أساعدك في أي حاجة بخصوص القهوة أو المشروبات أو طلبك في CMODY. اسألني عن أسعار المشروبات أو الكوبونات أو الشحن وعينيا ليك! ☕🌟"
    },
    gulf: {
      greeting: "يا هلا والله ومرحبا بك في CMODY! نورتنا يا غالي. وش حابب تطلب اليوم؟ تبي قهوة مميزة تعدل المزاج ولا عصير يسرسح؟ ☕🥤",
      coffee: "أبشر يا طويل العمر! عندنا قهوة أرابيكا فاخرة بـ 16.99$، وقهوة إثيوبية يورجاشيف خيال بـ 18.99$. وإذا تبي بارد، كولد برو بـ 4.99$ وبوكس تحضير الكولد برو بـ 34.99$. وش ودك تجرب؟ 😍",
      drinks: "يسرسح على قلبك! عندنا سموذي مانجو بارد بـ 5.49$، ومانجو لاسي بـ 4.49$، وسموذي استوائي منعش بـ 5.99$. ولا تنسى الكابوتشينو الجاهز بـ 3.99$. جربها وبتدعي لي! 🥤✨",
      shipping: "تامر أمر! التوصيل مجاني تماماً لكل الطلبات اللي قيمتها فوق 50$. اطلب وتدلل ونوصلها لحد عندك 🚚💨",
      coupon: "تستاهل يا بعد راسي! استخدم كود الخصم CMODY10 وبيعطيك خصم 10% فوراً، أو كود SAVE20 لخصم 20% على طلبك. بالعافية عليك! 😉🎁",
      return_policy: "حقك علينا يا غالي! إذا واجهتك أي مشكلة، تقدر ترجع المنتج بكل سهولة خلال 30 يوم من الشراء، بشرط يكون بغلافه الأصلي. 🤝",
      about: "CMODY هو مكانك المثالي لأجود أنواع البن والمشروبات الباردة والساخنة المحضرة بكل حب لتناسب ذوقك الرفيع. ☕✨",
      default: "تسلم يا غالي! أنا هنا بخدمتك في CMODY لطلب القهوة أو المشروبات أو الاستفسار عن الشحن والأكواد. وش تبغى تسأل عنه وأنا حاضر؟ ☕🌟"
    },
    ar: {
      greeting: "مرحباً بك في CMODY! نحن سعداء جداً بخدمتك. هل ترغب في تجربة قهوتنا الفاخرة أم مشروباتنا المنعشة اليوم؟ ☕🥤",
      coffee: "تحت أمرك! يتوفر لدينا حبوب بن أرابيكا الفاخرة بسعر 16.99$، وبن إثيوبي يورجاشيف بسعر 18.99$. كما يوجد كولد برو بسعر 4.99$ ومجموعة تحضير الكولد برو الكاملة بسعر 34.99$. ☕✨",
      drinks: "مشروباتنا ستنعش يومك! جرب سموذي المانجو الرائع بسعر 5.49$، أو مانجو لاسي بسعر 4.49$، أو السموذي الاستوائي بسعر 5.99$. ويتوفر أيضاً كابوتشينو للطلب الخارجي بسعر 3.99$. 🥤🔥",
      shipping: "شحننا سريع ومميز! التوصيل مجاني بالكامل لأي طلب تزيد قيمته عن 50$. 🚚💨",
      coupon: "أهلاً بك! يمكنك استخدام كود الخصم CMODY10 للحصول على خصم 10%، أو SAVE20 للحصول على خصم 20% على مشترياتك. تسوقاً ممتعاً! 😉🎁",
      return_policy: "نحن نضمن رضاك تماماً! يمكنك إرجاع أو استبدال أي منتج في حالته الأصلية خلال 30 يوماً من الشراء بكل سهولة. 🤝",
      about: "متجر CMODY هو وجهتك الأولى للحصول على قهوة مختصة فاخرة، مشروبات منعشة، بأعلى جودة وتصميم راقٍ يناسبك. ☕✨",
      default: "أهلاً بك! أنا مساعدك الذكي في CMODY. يمكنك سؤالي عن المنتجات، الأسعار، الشحن المجاني، أو كوبونات الخصم وسأجيبك فوراً! ☕🌟"
    },
    en: {
      greeting: "Welcome to CMODY! ☕ How can I help elevate your everyday today? Looking for some premium coffee or a refreshing drink? 🥤",
      coffee: "Excellent choice! We have Premium Arabica Beans for $16.99, Ethiopian Yirgacheffe for $18.99, Cold Brew Coffee for $4.99, and a Cold Brew Starter Set for $34.99. What would you like to try? 😍",
      drinks: "Cool down with our Mango Smoothie ($5.49), Mango Lassi ($4.49), or Tropical Smoothie ($5.99). We also have Cappuccino To-Go for $3.99. Delicious! 🥤✨",
      shipping: "Great news! We offer free shipping on all orders over $50. Otherwise, a standard shipping fee applies. 🚚💨",
      coupon: "Here's a special treat! Use coupon CMODY10 for 10% off, or SAVE20 for a fantastic 20% discount on select premium products! Enjoy! 😉🎁",
      return_policy: "No worries at all! We have a hassle-free 30-day return policy. Items must be in their original packaging. Your satisfaction is our priority! 🤝",
      about: "CMODY is your destination for carefully selected coffee beans, delicious takeaway drinks, and accessories designed for an elevated lifestyle. ☕✨",
      default: "Thank you! I am your CMODY shopping assistant. Ask me about our coffee bean types, drinks, free shipping policy, or discount coupons, and I'll be happy to guide you! ☕🌟"
    }
  };

  // Route queries
  const currentResponses = responses[dialect] || responses["en"];
  
  if (msg.includes("سلام") || msg.includes("مرحبا") || msg.includes("اهل") || msg.includes("ازيك") || msg.includes("شلون") || msg.includes("hi") || msg.includes("hello") || msg.includes("hey") || msg.includes("صباح") || msg.includes("مساء")) {
    return currentResponses.greeting;
  }
  if (msg.includes("قهو") || msg.includes("بن") || msg.includes("كولد") || msg.includes("ارابيكا") || msg.includes("يورجا") || msg.includes("coffee") || msg.includes("bean") || msg.includes("brew") || msg.includes("arabica")) {
    return currentResponses.coffee;
  }
  if (msg.includes("مشروب") || msg.includes("عصير") || msg.includes("سموذي") || msg.includes("مانجو") || msg.includes("كابوتشينو") || msg.includes("لاسي") || msg.includes("drink") || msg.includes("smoothie") || msg.includes("mango") || msg.includes("cappuccino") || msg.includes("lassi")) {
    return currentResponses.drinks;
  }
  if (msg.includes("شحن") || msg.includes("توصيل") || msg.includes("شراء") || msg.includes("ارسل") || msg.includes("shipping") || msg.includes("delivery") || msg.includes("ship")) {
    return currentResponses.shipping;
  }
  if (msg.includes("كوبون") || msg.includes("خصم") || msg.includes("كود") || msg.includes("تخفيض") || msg.includes("coupon") || msg.includes("discount") || msg.includes("code") || msg.includes("save")) {
    return currentResponses.coupon;
  }
  if (msg.includes("استرجاع") || msg.includes("ترجيع") || msg.includes("ارجاع") || msg.includes("رجع") || msg.includes("بدل") || msg.includes("return") || msg.includes("refund")) {
    return currentResponses.return_policy;
  }
  if (msg.includes("مين") || msg.includes("انت") || msg.includes("عن") || msg.includes("المتجر") || msg.includes("cmody") || msg.includes("about") || msg.includes("who")) {
    return currentResponses.about;
  }
  
  return currentResponses.default;
}

// ── Send Message ─────────────────────────────────
async function sendMessage(req, res) {
  const { message, sessionKey: clientSessionKey } = req.body;

  if (!message || message.trim().length === 0) {
    return ApiResponse.badRequest(res, "Message is required");
  }

  if (message.length > 1000) {
    return ApiResponse.badRequest(res, "Message too long (max 1000 characters)");
  }

  // Resolve or create session
  const sessionKey = clientSessionKey || uuidv4();

  let session = await prisma.chatSession.findUnique({ where: { sessionKey } });

  if (!session) {
    session = await prisma.chatSession.create({
      data: {
        sessionKey,
        userId: req.user?.id || null,
        messages: [],
      },
    });
  }

  const history = session.messages || [];

  // Append user message
  history.push({
    role: "user",
    content: message.trim(),
    timestamp: new Date().toISOString(),
  });

  // Keep last 20 messages to avoid token limit
  const recentHistory = history.slice(-20);
  const apiMessages = recentHistory.map(({ role, content }) => ({ role, content }));

  const apiKey = process.env.DEEPSEEK_API_KEY;
  let reply = "";

  // Check if API key is valid / exists
  const isDummyOrMissing = !apiKey || apiKey.trim() === "" || apiKey.startsWith("sk-dummy") || apiKey.includes("dummy-key-for-now");

  if (isDummyOrMissing) {
    // Gracefully use dialect-matching local fallback engine
    reply = localFallbackChat(message);
  } else {
    try {
      const response = await axios.post("https://api.deepseek.com/chat/completions", {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...apiMessages
        ],
        max_tokens: 500,
        temperature: 0.7
      }, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        timeout: 10000 // 10s timeout
      });

      reply = response.data?.choices?.[0]?.message?.content || "";
      
      if (!reply) {
        throw new Error("Empty reply from DeepSeek API");
      }
    } catch (err) {
      console.error("DeepSeek API error, falling back to local engine:", err.message);
      // Fallback gracefully on API errors (e.g. rate limit, bad auth) to prevent 500 response
      reply = localFallbackChat(message);
    }
  }

  try {
    // Append assistant reply
    history.push({
      role: "assistant",
      content: reply,
      timestamp: new Date().toISOString(),
    });

    // Save updated session
    await prisma.chatSession.update({
      where: { sessionKey },
      data: {
        messages: history.slice(-50), // keep last 50 in DB
        userId: req.user?.id || session.userId,
      },
    });

    return ApiResponse.success(res, {
      reply,
      sessionKey,
    });
  } catch (err) {
    console.error("Error saving chat history to DB:", err);
    return ApiResponse.success(res, {
      reply,
      sessionKey,
    });
  }
}

// ── Get Session ───────────────────────────────────
async function getSession(req, res) {
  const { sessionKey } = req.params;
  const session = await prisma.chatSession.findUnique({ where: { sessionKey } });

  if (!session) return ApiResponse.notFound(res, "Chat session");

  return ApiResponse.success(res, {
    sessionKey: session.sessionKey,
    messages: session.messages,
  });
}

// ── Clear Session ─────────────────────────────────
async function clearSession(req, res) {
  const { sessionKey } = req.params;
  await prisma.chatSession.updateMany({
    where: { sessionKey },
    data: { messages: [] },
  });
  return ApiResponse.success(res, null, "Session cleared");
}

module.exports = { sendMessage, getSession, clearSession };
