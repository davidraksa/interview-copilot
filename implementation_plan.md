# Implementation Plan - Interview Copilot Extension

## Goal Description
Create a Chrome Extension that assists users during online interviews (Google Meet) by reading captions in real-time, buffering the context, and using Google Gemini to generate relevant answers based on the user's resume and the ongoing conversation.

## User Review Required
> [!IMPORTANT]
> **Gemini API Key**: The user will need to provide their own Google Gemini API key for the extension to work, as we cannot embed a shared key securely in a client-side extension. The UI will include a settings page for this.

## Proposed Changes

### Structure
The project will follow a standard Manifest V3 structure.

### Core Components

#### [MODIFY] manifest.json
- Permissions: `storage`, `activeTab`, `scripting`.
- Host Permissions: `https://meet.google.com/*`, `https://www.youtube.com/*` (for testing).
- Content Scripts: `content.js` (for reading captions and injecting UI).
- Background: `background.js` (for API calls and context management).
- Action: Default popup for settings.

#### [NEW] content.js ("Visual Spy" & "Teleprompter")
- **Caption Reader**: uses `MutationObserver` to detect changes in caption containers.
    - Google Meet Selector: varies, often `div[jscontroller="..."]` or class based. Need to identify stable selectors.
    - YouTube Selector: `.ytp-caption-segment`.
- **UI Injection**: Injects a floating HTML element (Shadow DOM) for the "Teleprompter" on the page.
    - Features: "Help Me Now" triggers a message to background. Displays response text.

#### [NEW] background.js ("Memory" & "Brain")
- **Buffering**: clear text buffer only keeping the last N characters or M minutes of conversation.
- **Gemini Handler**: listents for "HELP_REQUEST".
    - Constructs prompt: `System Prompt + User Context (Resume) + Conversation Buffer + Last Question`.
    - Calls Gemini API.
    - Returns text to `content.js`.

#### [NEW] popup/ ("Configuration")
- Settings UI to:
    - Input Gemini API Key.
    - Paste/Upload User Resume/Context text.
    - Define "Generic Q&A" context.

## Verification Plan
### Automated Tests
- None planned for MVP.

### Manual Verification
1.  **Caption Reading**: proper logs when captions appear on YouTube/Meet.
2.  **Buffering**: Verify the buffer contains the expected history.
3.  **API Integration**: Verify valid responses from Gemini using the stored API key.
4.  **UI UX**: "Teleprompter" appears correctly over the video feed without blocking critical controls.
