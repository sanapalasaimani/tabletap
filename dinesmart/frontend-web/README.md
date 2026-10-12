# TableTap / DineSmart Platform Documentation

## System Architecture & Recent Enhancements

### 1. Admin Dashboard
- **Waiter App Option Removed**: Completely stripped the "Download Waiter App (APK)" button, "Open Waiter App" quick link, and `/waiter` route triggers from the Admin Dashboard header and menus.
- **Notification Symbol Removed**: Completely removed the `<Bell />` notifications icon, unread ping badges, alert dropdown pane, and the obsolete System Notification Center tab from the Admin Dashboard.
- **Clean Workspace**: The top header now neatly displays status synchronization, theme toggles, and user workspace badges without clutter.

### 2. Waiter App (Service Tasks Console)
- **Notification Features Removed**:
  - Eliminated all bell icons, unread badges, and pulsating alert indicators.
  - Removed HTML5 Web Audio (`AudioContext`) chimes that played on incoming orders.
  - Removed push/local notification banners and background alert triggers.
  - Cleaned terminology across all views: replaced "Notifications" and "Alerts" with "Active Tasks", "Pending Tasks", and "In Service".
- **Reliable Task Management**: Waitstaff can view live kitchen-ready orders and table assistance requests in a streamlined, distraction-free board.

### 3. AI Restaurant Chatbot (Groq 160B / 120B Integration)
- **Secure Configuration**:
  - API Key loaded securely via `import.meta.env.VITE_GROQ_API_KEY` (never hardcoded).
  - Model configured via `import.meta.env.VITE_GROQ_MODEL` with high-parameter fallbacks (`openai/gpt-oss-120b`, `qwen/qwen3.8-27b`, `openai/gpt-oss-20b`).
  - AbortController timeout (15s), CORS support, and error handling for rate limits (HTTP 429).
- **Data Adaptation & RAG (Retrieval-Augmented Generation)**:
  - Verified restaurant corpus containing all 40 menu items with exact prices (INR), spice levels, calories, dietary tags, allergens, operating hours, 5% GST rules, and cancellation policies.
  - Dynamic chunking and keyword/intent retrieval injects only relevant context into prompt, preventing token bloat and hallucinations.
- **Friendly Initial Greeting**:
  - Replaced bad greeting that mentioned being "trained on particular dishes".
  - Standard greeting: *"Hi! I’m your restaurant assistant. I can help with menu items, recommendations, orders, allergens, and general questions. What would you like to know?"*
- **Internal Chain-of-Thought (CoT) & Structured Formatting**:
  - Model reasons step-by-step internally to verify facts before responding.
  - Enforces clean visual borders around all answers:
    ```
    ┌─ Answer ────────────────────────────────────────┐
    │ [Direct, human-like answer]                     │
    │                                                 │
    │ Key Details:                                    │
    │ • [Verified facts, prices, allergens]           │
    │                                                 │
    │ Next Steps:                                     │
    │ • [Actionable next steps]                       │
    └─────────────────────────────────────────────────┘
    ```
  - Automatically sanitizes `<think>` tags so raw thoughts are never leaked to end users.

## Testing & Verification
Run the automated test suite:
```bash
node test-system-verification.mjs
```
Build verification:
```bash
npm run build
```
Run development server:
```bash
npm run dev
```
