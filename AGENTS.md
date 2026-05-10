# Idol Mode - AI Agent Guide

**Project:** "Idol Mode" — A React Native fan-idol chat simulator with AI-generated fan personas.

## Quick Start

```bash
npm start          # Start Expo dev server
npm run typecheck  # Verify TypeScript
npm run qwen:proxy      # Start local Qwen proxy (requires QWEN_API_KEY)
```

**Tech Stack:** React Native 0.81.5, Expo 54.0.0, React 19.1.0, TypeScript 5.9.2, Expo Router

---

## Architecture

### State Management: Context-based (`IdolModeContext`)
All app state lives in [context/IdolModeContext.tsx](context/IdolModeContext.tsx) as a single context provider.
- **myProfile** - User's artist profile
- **addedArtists** - List of followed artists
- **selfMessages** / **fanMessages** / **idolThreads** - All chat data
- Hook: `useIdolMode()` — use in any component

### Data Types
All types defined in [types/idol.ts](types/idol.ts):
- **Profile** — User profile (nickname, signature, avatar, email)
- **Artist** — Artist/idol card data
- **ChatMessage** — Messages with sender, text, status, timestamp
- **FanMessage** — Fan messages with multi-language support, persona, message kind
- **IdolChatThread** — Artist-specific message thread

### API & Fallback Strategy
[services/fanMessageApi.ts](services/fanMessageApi.ts) calls backend API with 25s timeout:
- Endpoint: `EXPO_PUBLIC_IDOL_MODE_API_URL` (default: `http://localhost:8787`)
- Paths: `/ai/fan-messages` (batch), `/ai/live-fan-message` (single)
- **Fallback:** If API fails, uses mock data from [services/mockData.ts](services/mockData.ts)

### Backend Proxy
[server/src/index.mjs](server/src/index.mjs) + [server/src/aiClient.mjs](server/src/aiClient.mjs) — Node.js server:
- Calls Qwen / DashScope API with detailed system prompts
- Returns properly formatted fan messages with persona types
- 15 fan personas: "comfort guardian," "dramatic crier," "hype captain," etc.
- Supports 5 languages: zh, en, ko, jp, es
- Fallback pool ensures messages always generate

---

## Component Patterns

### Reusable Components
- **Avatar** — Emoji badge with background color
- **ChatBubble** — Message bubble with status/time indicators
- **FanMessageCard** — Fan message with translation toggle, persona tags
- **ArtistCard** / **ArtistHeader** — Artist profile display
- **ProfileCard** — User profile card
- **PrimaryButton** / **IconButton** — Styled buttons

### Styling Convention
- Theme colors in [constants/theme.ts](constants/theme.ts)
- Path aliases: `@/*` resolves to workspace root
- React Native Stylesheet for all styles

---

## Data Flow

### Self-Chat Mode (`app/self-chat.tsx`)
1. User types message → `sendSelfDraft(text)` creates pending message
2. Navigates to `/confirm-send` with messageId param
3. `confirmSelfMessage()` → marks as sent, generates 4 fan messages via API
4. Fan messages auto-refresh via `appendLiveFanMessage()` every 2.4s

### Idol-Chat Mode (`app/idol-chat/[id].tsx`)
1. Shows artist header and message thread
2. User sends message → `sendIdolChatMessage(artistId, text)`
3. No API call; updates thread immediately

### Fan Messages View (`app/fan-messages.tsx`)
1. Displays all fan messages with translation toggle
2. Live ticker auto-cycles top 5 messages
3. `toggleFanMessageTranslation(messageId)` switches language

---

## Key Conventions

### Message IDs
- Self-draft: `self-{timestamp}`
- Fan emoji reply: `fan-emoji-{timestamp}`
- User in idol chat: `user-{timestamp}`
- API-generated: `api-generated-{timestamp}-{index}` or `api-live-{timestamp}`

### Fan Message Fields
```typescript
{
  id: string;
  fanName: string;              // Short nickname (max 24 chars)
  avatar: string;               // Single emoji from pool
  language: "zh" | "en" | "ko" | "jp" | "es";
  content: string;              // Original message (max 120 chars)
  translatedContent: string;    // Simplified Chinese translation
  personaType?: string;         // Fan personality type
  messageKind?: "ambient" | "reaction";  // ambient = general chat, reaction = responds to idol
}
```

### Time Format
All messages use `HH:MM` format (e.g., `"22:18"`). Generated via `new Date().toLocaleTimeString()`.

---

## Common Tasks

### Adding a New Screen
1. Create file in `app/` or `app/(tabs)/`
2. Use `router.push()` / `router.back()` for navigation
3. Import `useIdolMode()` for state access
4. Apply theme colors from `@/constants/theme`

### Adding API Endpoints
Update `services/fanMessageApi.ts`:
1. Add `postToApi(path, body)` call
2. Define response type
3. Add normalization via `normalizeFanMessage()`
4. Provide fallback in catch block

### Tweaking Fan Personas
Edit [server/src/fanPersonas.mjs](server/src/fanPersonas.mjs):
- `fanPersonas` array — add/edit persona types & styles
- `systemPrompt` — adjust generation rules & constraints
- `fallbackFanMessages()` — hardcoded fallback pool

### Env Configuration
`.env.example` template:
```
QWEN_API_KEY=sk-...
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_MODEL=qwen3.5-plus
PORT=8787
EXPO_PUBLIC_IDOL_MODE_API_URL=http://localhost:8787
```

---

## Testing & Validation

### Type Checking
```bash
npm run typecheck
```
Must pass before commits.

### Mock Data
Recommended for UI testing — uses [services/mockData.ts](services/mockData.ts) by default.
- 4 pre-built artists with full profiles
- Sample messages in all modes
- No API calls needed

### Live Testing with API
```bash
QWEN_API_KEY=sk-... npm run qwen:proxy          # Terminal 1
npm start                                         # Terminal 2
```

---

## Common Pitfalls

1. **State not persisting:** Verify component is inside `<IdolModeProvider>` (in [app/_layout.tsx](app/_layout.tsx))
2. **API timeout:** Default 25s; adjust `withTimeout(ms)` in [services/fanMessageApi.ts](services/fanMessageApi.ts)
3. **Missing translations:** Fan messages fallback to original content if `translatedContent` missing
4. **Persona type mismatch:** Must match one of 15 defined types in `fanPersonas` array
5. **Message length:** Content capped at 120 chars, translated at 140 chars

---

## File Structure Reference

```
app/                          # Navigation/screens
├── _layout.tsx              # Root layout with IdolModeProvider
├── self-chat.tsx            # Artist mode (bubble updates)
├── confirm-send.tsx         # Confirmation screen
├── fan-messages.tsx         # Fan message feed
├── (tabs)/                  # Bottom tab navigation
├── artist/[id].tsx          # Artist detail screen
└── idol-chat/[id].tsx       # Idol chat screen

components/                  # Reusable UI components
├── ChatBubble.tsx
├── FanMessageCard.tsx
├── ArtistCard.tsx
└── ... (10+ components)

services/                    # Data layer
├── fanMessageApi.ts         # API client with fallback
└── mockData.ts              # Demo data

types/                       # TypeScript definitions
└── idol.ts                  # All type exports

context/                     # Global state
└── IdolModeContext.tsx      # Context + useIdolMode hook

constants/                   # Configuration
└── theme.ts                 # Colors, spacing, shadows

scripts/                     # Backend utilities
└── aiClient.mjs             # AI fan message generator
```
