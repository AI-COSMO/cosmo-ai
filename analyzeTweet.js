import axios from "axios";
import OpenAI from "openai";

// Configuration object for OpenAI and prompt template
const CONFIG = {
    OPENAI: {
        API_KEY: 'sk-xxxxx', // Use a secure method for storing API keys
        MODEL: 'gpt-4o',
        TEMPERATURE: 0.7,
        IMAGE_SIZE: '512x512',
    },
    PROMPT_TEMPLATE: (tweet) => `
    You are a meme analysis expert, well-versed in the culture, community psychology, and viral spread logic behind memecoins in the crypto space.

    Please evaluate the following tweet to determine if it has meme potential based on the following criteria:

    1. Is it absurd, exaggerated, or humorous?
    2. Does it have strong image association potential?
    3. Is it shareable, mockable, or likely to inspire derivative content?
    4. Is it related to internet trends, tech, Elon Musk, animals, or anti-intellectual culture?
    5. Does it reference a known meme, trope, or cultural format? If so, explain its backstory.

    The tweet is:
    "${tweet}"

    Return one of the following JSON structures:

    If not a meme:
    {
      "isMeme": false,
      "reason": "Why it's not a meme"
    }

    If a meme:
    {
      "isMeme": true,
      "reason": "Why this tweet has meme potential",
      "name": "Short meme-like token name",
      "symbol": "SYMBOL",
      "logoPrompt": "Creative and exaggerated visual prompt for DALL·E logo",
      "tweet": "Absurd meme-style tweet, not formal or promotional",
      "backstory": "Meme/cultural origin and viral context"
    }
    `
};

/**
 * Extracts JSON content from a mixed response text.
 * @param {string} text - The raw response containing JSON.
 * @returns {string} - Clean JSON string.
 */
function extractPureJson(text) {
    const cleaned = text.replace(/```(?:json)?/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}') + 1;

    if (start === -1 || end === 0) {
        throw new Error("Valid JSON structure not found");
    }

    return cleaned.slice(start, end);
}

/**
 * Analyzes whether a tweet has meme potential using OpenAI API.
 * Optionally includes image context for multimodal evaluation.
 * @param {string} tweetText - The tweet to analyze.
 * @param {string} [imageUrl] - Optional image URL.
 * @returns {Promise<Object>} - Meme evaluation result.
 */
async function analyzeTweet(tweetText, imageUrl) {
    const openai = new OpenAI({
        apiKey: CONFIG.OPENAI.API_KEY,
    });

    try {
        console.log('🔍 Analyzing tweet...');

        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: CONFIG.PROMPT_TEMPLATE(tweetText)
                    },
                    ...(imageUrl ? [{
                        type: 'image_url',
                        image_url: { url: imageUrl, detail: 'auto' }
                    }] : [])
                ]
            }
        ];

        const completion = await openai.chat.completions.create({
            model: CONFIG.OPENAI.MODEL,
            messages,
            temperature: CONFIG.OPENAI.TEMPERATURE,
            response_format: { type: "json_object" }
        });

        const reply = completion.choices?.[0]?.message?.content;
        console.log('🤖 OpenAI response:', reply);

        if (!reply) throw new Error("OpenAI returned empty response");

        const jsonText = extractPureJson(reply);
        const parsed = JSON.parse(jsonText);

        if (!parsed.isMeme) {
            console.log('❌ Not a meme:', parsed.reason);
        }

        // If meme-worthy, generate logo image
        if (parsed.isMeme) {
            const imageResponse = await openai.images.generate({
                prompt: parsed.logoPrompt,
                n: 1,
                size: CONFIG.OPENAI.IMAGE_SIZE,
            });
            parsed.logoUrl = imageResponse.data[0].url;
            console.log(`🖼️ Logo URL: ${parsed.logoUrl}`);
        }

        return parsed;

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('❌ Network error:', {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            });
        } else {
            console.error('❌ Unexpected error:', error?.message || error);
        }
        throw error;
    }
}

// Example usage
const exampleTweet = "Please make a miniature pet wooly mammoth";
const exampleImage = "";

analyzeTweet(exampleTweet, exampleImage)
    .then(result => console.log('✅ Analysis complete:', result))
    .catch(err => console.log('⚠️ Analysis failed:', err.message));
