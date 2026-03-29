# Muse Learning Assistant Frontend Deliverables (AI 1)

## 1. State Machine Documentation

The frontend uses a central state machine to manage interaction flow and visual feedback.

### States:
- **`idle`**: The default state. Ready to accept text input or turn on free microphone mode.
- **`listening`**: Free microphone mode is actively listening and showing interim speech results in both the overlay and the visible "语音转文字" panel.
- **`thinking`**: Waiting for the backend response (SSE). Input, send, and voice buttons are disabled.
- **`speaking`**: TTS is playing the assistant's response. Voice recognition is paused to avoid self-feedback.

### Transitions:
- `idle` -> `listening`: Triggered by clicking **自由麦**.
- `listening` -> `thinking`: Triggered when a final speech result is received and auto-submitted.
- `listening` -> `idle`: Triggered on error or cancellation.
- `idle` -> `thinking`: Triggered by sending a text message.
- `thinking` -> `speaking`: Triggered after the SSE stream finishes (`done` event) if **Auto-play** is enabled.
- `thinking` -> `idle`: Triggered after the SSE stream finishes if **Auto-play** is disabled.
- `speaking` -> `idle`: Triggered when audio playback ends.
- `idle` -> `listening` (resume): Triggered automatically after each round if free microphone mode is still enabled.

---

## 2. API Integration Documentation

The frontend expects the following endpoints:

### `POST /api/chat` (SSE)
- **Request Body**: `{ "message": string, "history": array, "mode": "study" }`
- **Response**: `text/event-stream`
- **Events**:
  - `context`: `{ "type": "context", "items": [{ "file": string }] }` - Displayed as a "Based on" tag.
  - `token`: `{ "type": "token", "content": string }` - Incremental text update.
  - `done`: `{ "type": "done", "fullText": string }` - Stream termination.

### `POST /api/tts`
- **Request Body**: `{ "text": string, "voice": "default" }`
- **Response**: `audio/mpeg` (binary stream)

### `POST /api/notes` (Reserved for future deep integration)
- Current frontend handles notes locally with export to Markdown.
- Ready to sync with `/api/notes` when AI 2 completes the endpoint.

---

## 3. Frontend Self-Test Records

Tests performed using **Mock Mode**:

| Test Case | Steps | Expected Result | Status |
|-----------|-------|-----------------|--------|
| **Text Send** | Input "什么是Transformer?" -> Send | User message appears, "thinking" state, streaming reply, "speaking" state simulation. | ✅ Pass |
| **Free Mic** | Click "自由麦" -> (Simulated speech) | "listening" state, interim text visible, auto-sends on finish, then auto-resumes listening until closed. | ✅ Pass |
| **Speech To Text Visible** | Open free mic -> speak a sentence | Spoken words appear live in the "语音转文字" panel; final transcript remains visible after recognition completes. | ✅ Pass |
| **Auto-play Toggle** | Turn off "自动播报" -> Send message | Reply streams, but state goes directly to "idle" instead of "speaking". | ✅ Pass |
| **Notes Sidebar** | Click 📝 -> Edit -> Export | Sidebar opens/closes, content is editable, .md file downloads. | ✅ Pass |
| **State Conflict** | Click "自由麦" while Assistant is speaking | Audio pauses, app returns to idle/listening flow, prevents feedback. | ✅ Pass |
| **State Machine UI** | Observe status tag and animations | Color changes (Red=listening, Yellow=thinking, Green=speaking). Pulse animation on Mic. | ✅ Pass |

---

## 4. Integration Instructions for AI 2 & AI 3
- The `app.js` has a `isMockMode` flag (default: true). Set to `false` in `init()` or via the UI toggle to connect to real endpoints.
- Ensure CORS or proxy is configured if running on different ports.
- The SSE parser expects `data: {JSON}` format.
