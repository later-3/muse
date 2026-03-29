# Learning Assistant V0 — Integration Report

> **Role**: AI 3 / OpenCode Adapter, Testing, Integration Gatekeeper  
> **Date**: 2026-03-28  
> **Status**: ✅ Ready for Integration

---

## Summary

This report documents the OpenCode adapter implementation for the Learning Assistant V0 project. The adapter bridges the learning assistant to OpenCode server mode, handling session management, prompt_async, message polling, and SSE conversion.

---

## Deliverables

### 1. OpenCode Adapter (`learning-assistant-oc.mjs`)

**Location**: `muse/user/projects/learning-assistant/server/opencode-adapter.mjs`

**Exports**:
- `OpenCodeSessionManager` — Session lifecycle management (create/reuse/poll)
- `MessagePoller` — Incremental message polling with streaming support
- `SSETransformer` — Converts responses to SSE events
- `LearningAssistantOCClient` — High-level API for the server
- `OCAdapterError` — Error class with codes
- `OC_ERROR_CODES` — Error code constants
- `createLearningAssistantOCClient()` — Factory function
- `OC_ADAPTER_CONFIG` — Configuration constants

**Key Features**:
- ✅ Session reuse within 30-minute window
- ✅ Semi-streaming via message polling (200ms intervals)
- ✅ Fallback to pseudo-streaming if needed
- ✅ Comprehensive error handling with typed error codes
- ✅ SSE event format: `context`, `token`, `done`

---

### 2. Integration Tests

**Test File**: `muse/user/projects/learning-assistant/test/server.test.mjs`

**Coverage**:

#### Contract Tests
- ✅ SSE event structure validation (`context`, `token`, `done`)
- ✅ Event order verification
- ✅ Required field presence
- ✅ Double newline termination

#### Session Management
- ✅ Session creation with metadata
- ✅ Session reuse within validity window
- ✅ Session clearing
- ✅ Session info with age tracking

#### Message Polling
- ✅ Poll returns array
- ✅ Incremental message detection
- ✅ Content extraction from various formats

#### Happy Path Integration
- ✅ Full chat flow with context → tokens → done
- ✅ Chat with history support
- ✅ Session reuse across multiple chats

#### Degraded Path Integration
- ✅ Member offline handling
- ✅ Session creation failure
- ✅ Prompt_async failure
- ✅ Message poll timeout
- ✅ Error event emission
- ✅ No assistant response scenario

---

## SSE Contract

### Event Types

```javascript
// Context event - sent when context items are retrieved
{ type: "context", items: [
  { id: "F2", title: "Transformer", path: "...", snippet: "..." }
]}

// Token event - incremental streaming content
{ type: "token", content: "Self-Attention is..." }

// Done event - stream complete
{ type: "done", fullText: "Complete response text" }

// Error event - error occurred (optional, for debugging)
{ type: "error", message: "...", code: "..." }
```

### Event Sequence

```
context (optional, if context items exist)
  ↓
token (0-N times)
  ↓
done (exactly once, last event)
```

### SSE Format

```
data: {"type":"context","items":[...]}\n\n
data: {"type":"token","content":"Hello"}\n\n
data: {"type":"token","content":" world"}\n\n
data: {"type":"done","fullText":"Hello world"}\n\n
```

---

## Error Handling

### Error Codes

| Code | Scenario |
|------|----------|
| `MEMBER_OFFLINE` | OpenCode member is offline |
| `MEMBER_NOT_FOUND` | Member doesn't exist |
| `SESSION_CREATE_FAILED` | Session creation API failed |
| `PROMPT_FAILED` | prompt_async API failed |
| `MESSAGE_POLL_TIMEOUT` | No response within timeout |
| `NO_ASSISTANT_RESPONSE` | No assistant message found |
| `NETWORK_ERROR` | Network connectivity issue |

### Error Response to Frontend

Errors are emitted as SSE `error` events followed by `done`:

```javascript
// Error event (optional, for debugging)
{ type: "error", message: "Member offline", code: "MEMBER_OFFLINE" }

// Done event with error context
{ type: "done", fullText: "抱歉，服务暂时不可用，请稍后再试。" }
```

---

## OpenCode API Mapping

| Learning Assistant | OpenCode API | Notes |
|-------------------|--------------|-------|
| Create session | `POST /session` | Returns session ID |
| Send prompt | `POST /session/:id/prompt_async` | Fire-and-forget, 204 response |
| Poll messages | `GET /session/:id/message` | Returns array of messages |
| Extract content | Message.parts array | Handles various formats |

---

## Integration Checklist

### ✅ Completed

1. **OpenCode Adapter Implementation**
   - Session manager with reuse logic
   - Message poller with incremental extraction
   - SSE transformer with contract-compliant events
   - High-level client for chat streaming

2. **Contract Tests**
   - SSE event format validation
   - Event type verification
   - Required field checks

3. **Happy Path Tests**
   - Full chat flow
   - Context retrieval
   - History handling
   - Session reuse

4. **Degraded Path Tests**
   - Member offline
   - Session failures
   - Timeout handling
   - Error propagation

### ⏳ Requires Coordination with AI 1 & AI 2

1. **Frontend Integration** (AI 1)
   - Verify SSE EventSource consumption
   - Confirm event type names (`context`, `token`, `done`)
   - Validate error handling on frontend

2. **Backend Routes** (AI 2)
   - Confirm `/api/chat` route integration
   - Verify context search integration
   - Test notes saving alongside chat

3. **Server Integration**
   - Mount adapter in `learning-assistant-server.mjs`
   - Configure member name (default: `tutor` or `xiaomiu`)
   - Set up proper baseUrl for OpenCode

---

## Configuration

### Environment Variables

```bash
# OpenCode connection
OPENCODE_HOST=127.0.0.1
OPENCODE_PORT=4096

# Learning assistant member (must exist in family)
LEARNING_ASSISTANT_MEMBER=tutor

# Polling configuration
OC_POLL_INTERVAL=200          # ms between polls
OC_MAX_POLL_DURATION=120000   # 2 minutes max wait
OC_FETCH_TIMEOUT=10000        # 10 seconds per request
```

### Member Setup Required

The learning assistant requires a dedicated OpenCode member. Recommended:

```bash
# Create tutor member in families/{family}/
families/later-muse-family/members/tutor/
├── config.json
├── .opencode/opencode.json
└── AGENTS.md
```

---

## Known Limitations & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenCode `prompt_async` 524 timeout behind Cloudflare | May get false timeout errors | Implement retry with exponential backoff |
| Member offline | Chat unavailable | Clear error message to user, suggest retry |
| Long responses (>2 min) | Timeout before completion | Increase `OC_MAX_POLL_DURATION` or implement chunked streaming |
| No incremental SSE from OpenCode | Semi-streaming only | Document as known limitation, may improve in V1 |

---

## Test Results

### Contract Tests
```
✅ SSE Event Format (5 tests)
✅ Session Management (4 tests)
✅ Message Polling (3 tests)
✅ Error Codes (2 tests)
✅ Factory Functions (3 tests)
```

### Happy Path Tests
```
✅ Full chat flow with context, tokens, done
✅ Chat with history
✅ Session reuse across chats
```

### Degraded Path Tests
```
✅ Member offline handling
✅ Session creation failure
✅ Prompt_async failure
✅ Message poll timeout
✅ Error event emission
✅ No assistant response
```

### Total: 26 tests passing

---

## Integration Instructions

### Step 1: AI 2 - Update learning-assistant-server.mjs

```javascript
// Add at top
import { createLearningAssistantOCClient } from './server/opencode-adapter.mjs'

// Add route handler
if (path === '/api/chat' && method === 'POST') {
  return handleChat(req, res)
}

// Implement handleChat
async function handleChat(req, res) {
  const body = await readBody(req)
  const { message, history, mode } = JSON.parse(body)
  
  // 1. Search context
  const contextItems = contextIndex.search(message).slice(0, 3)
  
  // 2. Set up SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })
  
  // 3. Stream via adapter
  const client = createLearningAssistantOCClient({
    baseUrl: 'http://127.0.0.1:4096',
  })
  
  await client.chatStream({
    message,
    history,
    contextItems,
  }, {
    enqueue: (data) => res.write(data),
    close: () => res.end(),
  })
}
```

### Step 2: AI 1 - Frontend SSE Consumption

```javascript
// Example: Consume SSE in frontend
const eventSource = new EventSource('/api/chat', {
  method: 'POST',
  body: JSON.stringify({ message: '...', history: [] })
})

let fullText = ''

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch (data.type) {
    case 'context':
      // Show context pills
      showContext(data.items)
      break
    case 'token':
      // Append to display
      fullText += data.content
      updateDisplay(fullText)
      break
    case 'done':
      // Complete
      fullText = data.fullText
      eventSource.close()
      enableInput()
      break
    case 'error':
      // Show error
      showError(data.message)
      eventSource.close()
      break
  }
}
```

### Step 3: Test Integration

```bash
# Run adapter tests
node --test user/projects/learning-assistant/test/server.test.mjs

# Start OpenCode serve
opencode serve &

# Start learning assistant server
node user/projects/learning-assistant/server/server.mjs

# Test in browser
open http://127.0.0.1:4300
```

---

## Validation Matrix

| Component | Contract | Happy Path | Degraded Path | Status |
|-----------|----------|------------|---------------|--------|
| SSE Events | ✅ | ✅ | ✅ | Ready |
| Session Mgmt | ✅ | ✅ | ✅ | Ready |
| Message Poll | ✅ | ✅ | ✅ | Ready |
| Context Search | ⬜ | ⬜ | ⬜ | AI 2 |
| Notes Save | ⬜ | ⬜ | ⬜ | AI 2 |
| TTS | ⬜ | ⬜ | ⬜ | AI 2 |
| Frontend | ⬜ | ⬜ | ⬜ | AI 1 |

**Legend**: ✅ = Complete, ⬜ = Pending (other AI), 🔄 = In Progress

---

## Conclusion

The OpenCode adapter layer is **complete and ready for integration**. All contract tests, happy path tests, and degraded path tests are passing.

### What Works
- ✅ Session creation and reuse
- ✅ Message polling with incremental extraction
- ✅ SSE conversion (context/token/done)
- ✅ Error handling with clear codes
- ✅ Member offline detection
- ✅ Timeout handling

### What Needs Coordination
- 🔄 AI 2: Mount adapter in learning-assistant-server.mjs
- 🔄 AI 1: Consume SSE events in frontend
- 🔄 Both: Verify end-to-end integration

### Recommendation
**Proceed with integration.** The adapter follows the contract defined in `v0-ai-build-spec.md` and has comprehensive test coverage. No breaking changes are anticipated.

---

## Appendix: Test Commands

```bash
# Run all learning assistant tests
node --test user/projects/learning-assistant/test/server.test.mjs

# Run with verbose output
node --test user/projects/learning-assistant/test/server.test.mjs

# Run specific test suite
npm test -- --test-name-pattern="Contract"
```

---

**Prepared by**: AI 3 (OpenCode Adapter / Integration Gatekeeper)  
**Review**: Ready for AI 1 & AI 2 integration
