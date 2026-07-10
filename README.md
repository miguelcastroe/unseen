# Unseen — test drive

Static front end + one serverless function. Built for Vercel's free tier.

## Deploy (about 5 minutes)

1. Get a free Groq API key at https://console.groq.com (no credit card required).
2. Push this folder to a new GitHub repo, or drag the folder directly into
   https://vercel.com/new (Vercel supports deploying without git for quick tests).
3. In the Vercel project settings, add an environment variable:
   - Name: `GROQ_API_KEY`
   - Value: your Groq key
4. Deploy. Vercel auto-detects `api/unseen.js` as a serverless function at `/api/unseen`.
5. Your live URL is what goes in the LinkedIn post.

## Files

- `index.html` — the front end (textarea, submit, result sections).
- `api/unseen.js` — serverless function that holds the Unseen prompt and calls Groq.
  The API key stays server-side; it's never exposed to the browser.

## Notes

- Input is capped at 6,000 characters, matching the char counter in the UI.
- Model used: `qwen/qwen3-32b` on Groq. Swap the `model` field in `api/unseen.js`
  if you want to test a different one later (e.g. a Llama or larger Qwen variant).
- Groq's free tier (no card) covers normal test-drive traffic. If a post goes
  viral and you start seeing errors, that's the free tier's rate limit, not a bill.
