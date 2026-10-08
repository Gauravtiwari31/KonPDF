# Give NW a language model

Out of the box, NW uses its **core tier**: a fast, built-in engine that understands file requests (with typos, follow-ups and seven languages) but isn't a real language model.

Connect a language model and NW understands almost anything people type, writes natural replies and keeps track of the conversation. The model is reached from the **engine** (on Render), so:

- the API key lives only in Render's settings, never in the app or the repository;
- the model sees the conversation and the **names, types and sizes** of attached files, never their contents;
- every plan it suggests is checked against KonPDF's tool list and must fit the attached files. Anything wrong, slow (over 12 s) or failing falls back to the core tier, so NW keeps working even if the service is down or out of free quota.

NW works with any **OpenAI-compatible** chat API. Three settings choose it:

| Setting | What it is |
|---|---|
| `NW_LLM_URL` | The service's base URL |
| `NW_LLM_MODEL` | The model's ID at that service |
| `NW_LLM_KEY` | Your API key for the service |
| `NW_LLM_TIMEOUT` | Optional: seconds to wait before falling back (default 12) |

## Recommended: Groq (free, fast, no credit card)

1. Sign up at <https://console.groq.com> and open **API Keys → Create API Key**. Copy the key.
2. Open **Models** in the console and pick a current chat model. `openai/gpt-oss-20b` is a good, fast choice; copy the exact ID shown there (models are retired from time to time).
3. In Render: **konpdf-engine → Environment → Add Environment Variable**, add:

   | Key | Value |
   |---|---|
   | `NW_LLM_URL` | `https://api.groq.com/openai/v1` |
   | `NW_LLM_MODEL` | `openai/gpt-oss-20b` (or the ID you picked) |
   | `NW_LLM_KEY` | your Groq key |

4. **Save Changes**. Render restarts the engine (about a minute).
5. Check: `https://<your-address>/api/health` now shows `"nw":"core+llm"`. In the app, NW replies are now written by the model.

The free tier allows a generous number of requests per day for one app; check the current limits on Groq's site.

## Alternative: Google Gemini

1. Get a key at <https://aistudio.google.com> (**Get API key**).
2. In Render, set:

   | Key | Value |
   |---|---|
   | `NW_LLM_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` |
   | `NW_LLM_MODEL` | a current free "Flash" model ID from AI Studio's model list |
   | `NW_LLM_KEY` | your Gemini key |

Read Google's free-tier terms first: they say how prompts on the free tier may be used.

## Your own model (no third party)

Any server that speaks the OpenAI chat API works, for example [Ollama](https://ollama.com) (`NW_LLM_URL=http://<host>:11434/v1`, no key needed) or a llama.cpp server. A small model such as Qwen2.5-1.5B-Instruct needs about 2 GB of memory, more than Render's free plan has, so this suits a computer of your own or a paid instance.

## Turning it off

Delete `NW_LLM_URL` (or `NW_LLM_MODEL`) in Render's Environment tab. NW goes back to the core tier.
