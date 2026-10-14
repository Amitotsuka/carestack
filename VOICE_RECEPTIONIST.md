# Inbound AI receptionist setup

## What this repository supports

The production web API is the NestJS service in `server/`, and it owns the current tenant appointment records in SQLite. There is no CareStack integration or provider schedule/availability API in this repository. The voice tools below use the existing clinic calendar; they can identify an exact duplicate doctor/date/time and create a confirmed record. They cannot verify a provider's external schedule, patient identity, or CareStack status. Cancellation and rescheduling deliberately hand off to staff.

The Python service is a separate demo agent with in-memory data. Inbound voice actions do not use it.

## Provider setup

Set a random `VOICE_TOOL_SECRET` of at least 32 characters on the Nest server and restart it. After saving a clinic's calling settings, copy its clinic-specific `voice_tool_secret` from Super Admin into the provider's API tool as `x-voice-tool-secret`. It is derived server-side and bound to that tenant. Do not put the master secret in browser code. Both providers call `POST https://<public-api-host>/api/voice/tools/<tenant-id>` with a JSON body. Supported actions are `clinic_info`, `faq`, `availability`, and `book`; `cancel` and `reschedule` return an unsupported response.

Clinic administrators maintain the AI receptionist's approved reference in the Agents page: clinic address, services, doctors, fees, supported languages, custom receptionist instructions, and up to 25 FAQs. `clinic_info` returns this context at call start; `faq` returns an approved answer or explicitly asks the agent to hand off. This is live context retrieval and prompt grounding, not model fine-tuning. Changes apply to subsequent tool calls.

### Sarvam Voice Agents

1. Create a Hindi/Hinglish Sarvam Voice Agent and configure it to identify itself as AI, answer only returned clinic data, repeat appointment details and get explicit confirmation before booking. Add the API tool endpoint and the clinic-specific secret above.
2. In Sarvam Deploy → Phone Numbers, add the Exotel Account SID, API key, token and regional base URL. Create an Exotel app with Voicebot applet URL `https://apps.sarvam.ai/api/app-runtime/channels/exotel`, then assign it to the clinic's Exophone.
3. Set `SARVAM_API_KEY` on the Nest server. In Super Admin → Configure calling, select Sarvam and save the Exophone, Sarvam organization, workspace, agent ID/version and Exotel connection ID.
4. Configure and test the agent's tools with a non-production tenant. **Activate inbound calls** sends Sarvam's deployment API request and immediately creates an active deployment; it may incur usage charges. The app sends the configured open/close hours and timezone, using all seven days because clinic open days are not modeled. Configure Exotel's fallback flow for out-of-hours calls. The app currently cannot pause/delete a remote deployment.

### Exotel Voicebot

1. In Super Admin → Configure calling, enter the clinic's Account SID, API Key, API Token, ExoPhone, region, and App/Flow ID. API Key and API Token are encrypted in the server database and never returned to the browser. Existing deployments may continue using the legacy `EXOTEL_API_KEY` and `EXOTEL_API_TOKEN` environment variables.
2. Set a stable `CREDENTIALS_ENCRYPTION_KEY` of at least 32 characters on the Nest server. Back it up securely and keep it unchanged so saved provider credentials can be decrypted after restarts and restores.
3. Click **Verify Exotel account**. This calls Exotel's read-only Account Balance API; it does not dial or place a call.
4. Save calling settings. Super Admin then shows this clinic's public API tool endpoint and clinic-specific `x-voice-tool-secret`. `VOICE_TOOL_SECRET` (at least 32 random characters) must be set on the API server. The API must have a public HTTPS URL that Exotel can reach; localhost is not reachable from Exotel.
5. In Exotel Voicebot → Build Bot → Tool Integration, add active POST integrations to the endpoint shown in Super Admin. Set the `x-voice-tool-secret` header to the clinic-specific secret. Create tools for `clinic_info`, `availability` and `book` using the request bodies in Super Admin. Attach the tools to the bot and map the fields from what the caller says. Publish the bot.
6. In App Bazaar, create a call flow with a Greeting and IVR Menu. For example, say “Press 1 for appointment booking”; route digit 1 to this clinic's published Voicebot applet. Assign the flow to the clinic's ExoPhone. Test through the Voicebot console or call the ExoPhone.

The IVR selection routes the caller to the booking agent; a digit alone is not enough to create an appointment. The bot collects the patient's name, callback number, doctor, future date/time and reason, checks the clinic calendar, reads the details back and gets explicit caller confirmation. It then calls the `book` tool, which immediately writes the confirmed appointment to this clinic's CareStack appointment register and returns a booking ID for the bot to read back. Exotel's setup supports an IVR menu before the Voicebot applet; see [Exotel Voicebot guide](https://docs.exotel.com/intelligent-voice-agents) and [Voicebot tool integration](https://docs.exotel.com/intelligent-voice-agents/tool-integration-for-voicebot).

Exotel Voicebot supplies its own WebSocket endpoint. This application does not run a separate AgentStream WSS server. Exotel's lower-level AgentStream API is a different option that requires a public WSS bot and is not selected by this integration.

## API tool contract

All requests require `x-voice-tool-secret`; invalid/missing configuration returns 401. Example bodies:

```json
{"action":"clinic_info"}
{"action":"faq","question":"Do you provide dental care?"}
{"action":"availability","date":"2030-04-10","time":"11:00","doctor_name":"Dr. Example"}
{"action":"book","request_id":"unique-call-request-123","confirmed":true,"patient_name":"Example Patient","phone_number":"+919876543210","doctor_name":"Dr. Example","date":"2030-04-10","time":"11:00","reason":"Consultation"}
```

Booking requests need an idempotency key; retries return the prior booking. `confirmed: true` is required. Each clinic configures an appointment length (15, 20, 30, 45, or 60 minutes; default 30). Availability and booking check the entire requested interval against every non-cancelled, non-no-show appointment for the same doctor. Exact duplicates and partial overlaps are rejected; back-to-back appointments are allowed. New bookings store their duration; older bookings use the clinic's current configured length. This checks the clinic's local calendar only, not an external CareStack/provider schedule. This endpoint does not search for patients or reveal existing patient records.

## Pricing and trial

Sarvam's currently published India Voice Agents pay-as-you-go rate is ₹3.50/minute, with no monthly fee under 3,000 minutes/month; calls round up to a full minute and prices exclude GST. Exotel still bills its own usage and number rental. Exotel's pricing page currently advertises a 7-day trial with 500 credits, while its trial-account docs describe a 15-day/₹1,000 trial for some accounts. These published terms differ, so verify the credit amount and number rental in the actual Exotel dashboard before testing. Trial credits cover Exotel usage only; Sarvam agent minutes are separate. See [Sarvam pricing](https://docs.sarvam.ai/voice-agents/pricing), [Exotel pricing](https://exotel.com/pricing/business-phone-system/), and [Exotel trial account details](https://docs.exotel.com/business-phone-system/create-a-trial-account?hl=en-IN).

Sarvam's Exotel instructions require a Sarvam phone-number connection, an Exotel Voicebot applet pointing at Sarvam's hosted endpoint, the Exophone assignment, and an inbound deployment. The hosted endpoint provides the audio WebSocket. Exotel's API account check uses its documented `GET /v1/Accounts/{account_sid}/Balance.json` endpoint with HTTP Basic authentication. See [Sarvam Exotel setup](https://docs.sarvam.ai/voice-agents/deploy/telephony/exotel), [Sarvam create deployment API](https://docs.sarvam.ai/voice-agents/api/deployments/create), [Exotel Voicebot guide](https://docs.exotel.com/intelligent-voice-agents), and [Exotel programmable voice API](https://developer.exotel.com/docs/voice).

## Current limitations

- No CareStack client or credentials exist in this codebase. Clinic calendar records are local SQLite state.
- Clinic context and FAQs are saved per clinic and returned to the agent as approved reference. The tool does not validate those facts; clinic staff must keep them accurate. The agent must hand off unsupported questions.
- Patient identity verification, patient search, rescheduling, cancellation, human call transfer, and call-history/transcript webhooks are not implemented. Sarvam documents Exotel transfer as requiring enablement by Sarvam support.
- Sarvam deployment creation is live and may be billable. Saving settings does not create one. Exotel Voicebot creation/publication is manual in its console. No external deployment or real telephone call was made during implementation.
