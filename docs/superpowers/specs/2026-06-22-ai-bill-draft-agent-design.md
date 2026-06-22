# AI Bill Draft Agent Design

## Background

HaulHub already supports manual completed bill entry through the existing admin workflow and `POST /admin/trips/manual-completed`. Accountants still need to read handwritten notes, WeChat messages, receipts, invoices, and mixed materials, then manually copy the information into the form.

The new feature adds an AI-assisted bill drafting workspace for the web admin. It helps accountants turn images or free-form text into a reviewable manual completed bill draft. The AI agent may ask follow-up questions and update the draft, but the accountant must confirm before the system creates the completed trip.

## Goals

- Add a web admin AI bill drafting entry for manual completed billing.
- Support image input, text input, and mixed image-plus-text input.
- Use a tool-calling agent in the first version, implemented with the native OpenAI Responses API.
- Keep provider boundaries replaceable so OpenAI can later be replaced with domestic OCR plus DeepSeek or another domestic model.
- Save AI drafts in the database so refreshes, retries, audit review, and future accuracy analysis are possible.
- Provide a workspace UI with source materials, an editable form, and agent questions in one screen.
- Require accountant confirmation before creating the completed trip.
- Keep final business validation in the backend and reuse the existing manual completed billing rules.

## Non-Goals

- Do not let the agent directly submit a completed bill without accountant confirmation.
- Do not auto-create missing expense types. Unknown expense names map to the existing "Other" expense type and keep the original name in the note.
- Do not support automatic multi-bill splitting in the first version. One submission creates one draft for one bill.
- Do not introduce LangChain, LangGraph, Temporal, or another workflow framework in the first version.
- Do not build domestic OCR or DeepSeek providers in the first version, but keep the interfaces ready.
- Do not redesign the existing manual completed billing business rules.

## Product Flow

1. Accountant opens the AI bill entry page from the trips area.
2. Accountant uploads one or more images, enters text, or provides both.
3. The API creates an `AiBillDraft` with `status = processing`.
4. `BillIntakeAgent` runs with the submitted materials and tool access.
5. The agent extracts fields, calls matching tools, calculates conflicts, and saves a review draft.
6. The web workspace opens with:
   - source materials on the left,
   - agent questions and warnings at the top or side,
   - the editable manual completed bill form on the right.
7. Accountant can answer agent questions through conversation or edit fields directly.
8. Each accountant reply runs the agent again against the current draft and updates the form plus question list.
9. Once required fields are complete, accountant clicks confirm.
10. Backend validates the confirmed payload and creates the completed trip through the existing manual completed billing logic.

Input priority:

```text
Accountant-entered text > image recognition result > model inference
```

This means a text note such as "driver is Wang Jianguo" should override an uncertain handwritten image guess.

## Architecture

```text
Web Admin
  /trips/ai-billing/new
  /trips/ai-billing/[draftId]

API
  AiBillWorkflow
    createDraft()
    appendMessage()
    confirmDraft()

  BillIntakeAgent
    AgentProvider
      OpenAiResponsesAgentProvider
      FutureDeepSeekAgentProvider
    AgentToolRegistry
      get_team_billing_context
      match_vehicle
      match_driver
      match_expense_type
      calculate_expense_summary
      validate_draft_for_review
      save_ai_bill_draft

Existing Business Logic
  manual completed billing service / POST /admin/trips/manual-completed
```

The first version should use native OpenAI tool calling, not LangChain. HaulHub owns the tool definitions, schemas, validation, and workflow transitions.

## Agent Design

### Agent Scope

The agent may:

- Read image and text materials.
- Extract bill fields.
- Call backend tools to inspect team context and match candidates.
- Ask accountant follow-up questions.
- Update the draft after accountant replies.
- Save a draft for review.

The agent may not:

- Create a completed trip.
- Bypass team permissions.
- Create expense types.
- Override backend validation.

### Tools

#### `get_team_billing_context`

Returns scoped context for the current team:

- available vehicles,
- active drivers,
- vehicle-driver bindings,
- enabled expense types,
- the configured "Other" expense type.

#### `match_vehicle`

Input:

- plate number guess,
- vehicle description,
- optional evidence.

Output:

- candidate vehicles,
- best match,
- confidence,
- whether the match is unique.

#### `match_driver`

Input:

- driver name or phone guess,
- optional matched vehicle id.

Output:

- candidate drivers,
- best match,
- confidence,
- whether the driver is bound to the selected vehicle.

#### `match_expense_type`

Input:

- original expense name.

Output:

- matched expense type when known,
- otherwise the "Other" expense type,
- note suffix such as `Original expense name: detention fee`.

Chinese UI may render the note as an equivalent label meaning `Original expense name: detention fee`.

#### `calculate_expense_summary`

Input:

- recognized detail expenses,
- recognized total expense if present.

Output:

- detail total,
- total expense,
- conflict warning when amounts differ,
- suggested mode: `details`, `total`, or `needs_review`.

#### `validate_draft_for_review`

Input:

- current AI draft.

Output:

- required questions,
- warnings,
- whether the draft is ready for accountant review,
- fields that block final submission.

This validation allows incomplete drafts because the accountant may fill missing fields.

#### `save_ai_bill_draft`

Input:

- normalized draft payload,
- questions,
- warnings,
- provider metadata.

Output:

- draft id,
- status.

This tool saves only review drafts. It does not submit accounting records.

## Conversation Design

The workspace includes an agent question panel. The agent asks concrete questions about missing or conflicting information, not general chat.

Examples:

```text
Missing required field:
"The unload location was not recognized. Please provide the unload location."

Ambiguous driver:
"The material mentions Lao Wang. The system found Wang Jianguo and Wang Ming. Please choose the correct driver."

Expense conflict:
"The detail expenses total 860.00, but another total expense of 900.00 was recognized. Please choose which one to use."
```

The accountant can answer in natural language:

```text
Unload location is Xiamen Tongan. Use driver Wang Jianguo.
```

The agent then updates the draft, re-runs matching and review validation, and refreshes the question list. The accountant can also edit the form directly.

## Data Model

Add `AiBillDraft`.

```text
id
teamId
createdBy
status              processing | needs_review | submitted | failed
inputMode           images | text | mixed
imageStorageKeys    JSON array
textNote            nullable text
provider            openai
providerRequestId   nullable string
rawAgentResult      JSON text
draftPayload        JSON text
reviewQuestions     JSON text
warnings            JSON text
messages            JSON text
confirmedPayload    nullable JSON text
submittedTripId     nullable string
errorMessage        nullable text
createdAt
updatedAt
submittedAt         nullable datetime
```

`messages` stores accountant-agent turns for the draft. It can later be split into a separate table if the conversation history grows.

### Draft Payload Shape

```ts
type Confidence = "high" | "medium" | "low";

type FieldGuess = {
  value: string | null;
  confidence: Confidence;
  evidence?: string;
  needsReview: boolean;
};

type AiBillDraftPayload = {
  vehicle: FieldGuess & {
    matchedVehicleId?: string;
    candidates?: VehicleCandidate[];
  };
  driver: FieldGuess & {
    matchedDriverId?: string;
    candidates?: DriverCandidate[];
  };
  customerName: FieldGuess;
  loadLocation: FieldGuess;
  unloadLocation: FieldGuess;
  actualFreight: FieldGuess;
  settledAt: FieldGuess;
  expenseModeSuggestion: "details" | "total" | "needs_review";
  expenses: ExpenseGuess[];
  totalExpense?: FieldGuess;
  accountingNote?: FieldGuess;
};

type ExpenseGuess = {
  originalName: string;
  matchedExpenseTypeId?: string;
  matchedExpenseTypeName?: string;
  amount: FieldGuess;
  occurredAt?: FieldGuess;
  note?: string;
  needsReview: boolean;
};
```

## API Design

### Create Draft

```text
POST /admin/ai-bill-drafts
```

`multipart/form-data`:

```text
files[]?: image files
textNote?: string
```

At least one image or non-empty text is required.

Response:

```json
{
  "draft": {
    "id": "draft-id",
    "status": "needs_review"
  }
}
```

If the agent fails after creating a record, return the draft with `status = failed` and an error message.

### Read Draft

```text
GET /admin/ai-bill-drafts/:draftId
```

Returns:

- draft status,
- image URLs,
- input text,
- draft payload,
- review questions,
- warnings,
- messages.

### Append Message

```text
POST /admin/ai-bill-drafts/:draftId/messages
```

Input:

```json
{
  "message": "Unload location is Xiamen Tongan. Use driver Wang Jianguo."
}
```

Behavior:

1. Verify the draft belongs to the current team.
2. Append accountant message.
3. Run the agent with current draft, source materials, team context, and new message.
4. Save updated draft payload, questions, warnings, and agent reply.
5. Return the updated draft.

### Confirm Draft

```text
POST /admin/ai-bill-drafts/:draftId/confirm
```

Input matches the existing manual completed billing payload:

```json
{
  "vehicleId": "...",
  "driverId": "...",
  "customerName": "...",
  "loadLocation": "...",
  "unloadLocation": "...",
  "actualFreight": "1800.00",
  "settledAt": "2026-06-22",
  "accountingNote": "...",
  "expenses": [
    {
      "expenseTypeId": "...",
      "amount": "120.00",
      "occurredAt": "2026-06-22",
      "note": "Original expense name: detention fee"
    }
  ]
}
```

Behavior:

1. Verify team scope and draft status.
2. Save `confirmedPayload`.
3. Run existing backend manual completed billing validation.
4. Create the completed trip.
5. Update draft with `status = submitted`, `submittedTripId`, and `submittedAt`.
6. Return the trip and draft.

### Retry Draft

```text
POST /admin/ai-bill-drafts/:draftId/retry
```

Re-runs the agent against the same source materials. This is useful for provider failures or prompt iteration during early rollout.

## Web Workspace

### Routes

```text
/trips/ai-billing/new
/trips/ai-billing/[draftId]
```

### Upload Page

Controls:

- image uploader,
- free-form text area,
- submit button.

Rules:

- one submission represents one bill,
- image-only, text-only, and mixed input are allowed,
- at least one input source is required.

### Draft Workspace

Layout:

```text
Top or right: Agent questions and conversation
Left: Source material viewer
Right: Manual completed billing form
```

Source viewer:

- image thumbnails,
- large image preview,
- text note display,
- image zoom and rotate where practical.

Form:

- vehicle,
- driver,
- customer name,
- load location,
- unload location,
- actual freight,
- settled date,
- expense mode,
- detail expenses or total expense,
- accounting note.

Field states:

- high-confidence fields are filled normally,
- medium/low-confidence fields show a review marker,
- missing required fields are highlighted,
- fields updated by the latest accountant message can be briefly marked as updated.

Submission stays disabled until the confirmed payload passes client-side required checks. The API still performs final validation.

## Validation And Safety

The system has three validation layers.

### Review Validation

`validate_draft_for_review` can return incomplete drafts. It creates review questions and warnings.

### Confirm Payload Validation

Before final submit, the web form and API require:

- vehicle,
- driver,
- customer name,
- load location,
- unload location,
- actual freight,
- settled date,
- exactly one expense mode,
- valid expense fields for the selected mode.

### Existing Business Validation

The final submit reuses backend rules for:

- team scope,
- accountant role,
- vehicle availability,
- driver activity,
- driver-vehicle binding,
- money format,
- expense type enabled state,
- detail-vs-total exclusivity,
- settlement snapshot creation,
- audit log creation.

## Provider Strategy

First version:

```text
OpenAiResponsesAgentProvider
```

Responsibilities:

- send image and text inputs to OpenAI,
- expose HaulHub tools through native tool calling,
- loop through model tool calls and tool outputs,
- produce final normalized draft.

Future domestic provider path:

```text
DomesticBillAgentProvider
  BaiduOcrProvider | TencentOcrProvider | AliyunOcrProvider
  DeepSeekBillExtractorProvider
```

The future provider must still output the same `AiBillDraftPayload`, questions, and warnings. Web and confirm logic should not change.

## Testing Strategy

### Unit Tests

- expense type matching maps unknown names to "Other" and preserves original name in notes.
- driver matching respects selected vehicle binding.
- vehicle matching handles exact and ambiguous plate matches.
- expense summary detects detail-total conflicts.
- review validation asks questions for missing fields.
- confirm payload builder serializes only the active expense mode.

### API Tests

- creating a draft requires image or text.
- text-only draft can be created.
- mixed input draft can be created.
- draft reads are team-scoped.
- append message updates messages and draft payload.
- confirm draft calls manual completed billing validation.
- failed provider run stores failed status and error message.

### Manual Smoke Test

1. Upload a handwritten image and confirm missing fields are asked as questions.
2. Paste a text-only bill and confirm a draft is generated.
3. Use mixed input and confirm text takes precedence over uncertain image results.
4. Resolve a missing field through conversation.
5. Edit the form directly and submit.
6. Confirm the resulting trip appears in reports.
7. Retry a failed draft.

## Rollout Notes

- Add `OPENAI_API_KEY` and model configuration to API environment variables.
- Keep request and response JSON for failed drafts so prompt and tool bugs can be debugged.
- Set a conservative image count and size limit for the first version.
- Do not enable automatic submission until there is enough real-world accuracy data.
- Keep all existing manual billing entry points available.
