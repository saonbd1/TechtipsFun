---
title: "REA (Reverse Engineer Anything): A Complete Tutorial"
description: "REA combines practical reverse-engineering methods with tools for AI coding agents. It supports static analysis, runtime observation, feature tracing, artifact inspection, and evidence-based reports."
heroImage: "/article-media/rea-reverse-engineer-anything-cover-2.png"
pubDate: "Oct 17 2026"
category: "Developer Productivity"
tags: ["REA", "ai", "tools"]
---

## What is REA? Why there are so much craze around it?
REA is a reverse-engineering toolkit for AI coding agents. It helps an agent study software and other technical systems through static analysis, runtime observation, and evidence-based reports.

REA can analyze native binaries, JavaScript applications, Electron applications, .NET assemblies, Android APKs, firmware, websites, network captures, databases, WebAssembly modules, EVM bytecode, and signal recordings.

This article explains two things:

1. How to think and work as a reverse engineer.
2. How to install and use REA for practical analysis.

## REA Safety and authorization

Analyze only systems that you own or that you have permission to test. Use test systems when possible. Do not bypass access controls, collect private data, disrupt services, or analyze software for harmful use.

Use REA to understand software, document behavior, find defensive security issues, compare versions, and build compatible tools within the limits of the law and the system license.

## What reverse engineering means?

Reverse engineering is the study of an existing system. The study uses behavior, structure, inputs, outputs, and evidence.

You can analyze with REA:

- Any program or Application
- Any website on any Platform
- An API.
- A file format.
- A device.
- A network protocol.
- A business process.
- A technical document.

Using REA tool is not always to copy the target. You can reverse engineer a system to:

- Explain how it works.
- Document its behavior.
- Find a fault.
- Trace a feature.
- Compare two versions.
- Find a security weakness in an authorized environment.
- Build an independent compatible implementation.

REA supports three analysis levels.

### Black-box analysis

You study the system from the outside. You do not use its source code or internal design.

You observe inputs, outputs, errors, timing, and side effects.

### Gray-box analysis

You have partial information. This information can include API documentation, configuration files, logs, or limited source code.

### White-box analysis

You inspect the internal structure. This structure can include source code, binaries, metadata, architecture, or internal documentation.

The analysis method is similar at each level:

```text
Observe → Record → Form a hypothesis → Test → Refine → Document
```

## The REA mindset

Start with evidence. Do not start with a guess about the internal design.

Separate direct observations from explanations. For example:

- Observation: The application returns status `400` for an empty request.
- Inference: The server rejects empty requests during validation.

The inference can be correct, but the response alone does not prove it. Use another test to support or reject the inference.

### Ask small questions

Do not begin with “How does this application work?” Use smaller questions:

- What starts the process?
- Which inputs does it accept?
- Which output does each input produce?
- What changes when one input changes?
- Does the system keep state?
- Which component creates the output?
- What happens when a dependency fails?

### Record each observation

Record the following information:

- Target name and version.
- Environment.
- Configuration.
- Exact input.
- Exact output.
- Error messages.
- Timing.
- Files that change.
- Network activity.
- Screenshots or traces.
- Evidence identifiers.

Memory is not a reliable record. State, timing, and configuration can change the result.

### Use confidence levels

Use one of these levels for each conclusion:

- Confirmed.
- Strongly supported.
- Likely.
- Plausible.
- Unknown.
- Disproved.

This method shows where more analysis is necessary.

## Define the analysis scope

A reverse-engineering project can grow without a clear limit. Define the scope before you start.

Use this target profile:

```text
Target:
Purpose:
Inputs:
Outputs:
Visible interfaces:
Dependencies:
Known constraints:
Unknown behavior:
Analysis objective:
```

A good objective is specific:

> Document the local command-line tool, including its arguments, output formats, error conditions, configuration, and external dependencies.

Define the following items:

- The target and version.
- The authorized environment.
- The behavior that you will study.
- The inputs and outputs.
- The interfaces and dependencies.
- The parts that you will not study.
- The final report or implementation.

Record new questions as follow-up work. Do not expand the project without recording the change.

## Install REA

### Requirements

You need the following items:

- Node.js and npm.
- An AI agent that supports MCP.
- Permission to analyze the target.

Supported agents include Claude Code, Cursor, Codex, Gemini CLI, Grok Build, Devin, Windsurf, and other MCP-compatible clients.

Hopper, Ghidra, or IDA can help with native binary analysis. JavaScript analysis does not require these tools.

### Use the official sources

Download REA only from the official sources:

- GitHub: https://github.com/morluto/rea
- Website: https://rea.tools
- NPM package: `rea-agents`

A similar repository name does not prove that the source is genuine.

### Run setup

Open a terminal and run:

```bash
npx rea-agents setup
```

If npm asks for permission to download the package, type `y` and press Enter.

The setup program shows a list of supported clients. Use the arrow keys to select a client. Press Space to select a client. Press Enter to continue.

You can also select a client directly:

```bash
npx rea-agents setup --client codex
```

Supported client IDs include:

```text
claude_code
claude_desktop
codex
cursor
gemini_cli
windsurf
devin
opencode
antigravity
copilot_cli
commandcode
vscode
grok_build
omp
grok_bot
```

Use the exact client ID that your installation supports. If a client ID changes in the official documentation, use the current ID from that documentation.

### Review the setup plan

REA shows a dry-run plan before it changes your client configuration. Review:

- Configuration file paths.
- Backup locations.
- The files that will change.
- The MCP server entry.
- The investigation skill that will be installed.
- Optional provider installation.

Approve the plan only after you understand the changes.

Setup can then:

- Add the REA MCP server to the client configuration.
- Install the matching investigation skill.
- Create backups of existing configuration.
- Install Hopper if you approve the installation.

Restart the AI agent after setup. The REA tools will then appear in the agent tool list.

### Manual MCP registration

Use manual registration for an unsupported client or a custom configuration. Read the official connection and recovery guide:

https://github.com/morluto/rea/blob/main/docs/connection-and-recovery.md

### CLI-only use

You can use REA from the command line without MCP registration:

```bash
npx rea-agents@latest analyze-javascript-application /path/to/app --json
```

This command does not require MCP registration or native analysis engines.

## Establish a baseline

Before you run complex analysis, record normal behavior.

Use a known input and run the normal workflow. Record:

- Input values.
- Output values.
- Status codes.
- Timing.
- Files created or changed.
- Network activity.
- Messages and logs.
- Visible side effects.

The baseline gives you a point of comparison for later tests.

## Design useful experiments

An experiment must answer a clear question. It must also distinguish between possible explanations.

Use this experiment record:

```text
Objective:
Hypothesis:
Setup:
Input:
Expected result:
Actual result:
Interpretation:
Follow-up test:
```

Useful experiment types include:

### Differential testing

Run the same operation with two inputs that differ in one important way. Compare the outputs, timing, logs, and side effects.

### Boundary testing

Test a value below, at, and above a suspected limit. This method can show maximum lengths, numeric thresholds, page limits, and validation rules.

### State testing

Perform actions in different orders:

```text
Action A → Action B
```

Then compare the result with:

```text
Action B → Action A
```

Different results can show hidden state or order-dependent behavior.

### Failure testing

In an authorized test environment, provide malformed input, stop a dependency, interrupt a request, or use an invalid configuration. Record whether the system retries, stops, falls back, or returns a partial result.

### Minimal reproduction

When a complex workflow fails, remove steps and data until the smallest failing example remains. A small example is easier to analyze and share.

## Map inputs, outputs, and state

A system can depend on more than the current input. It can also depend on sessions, stored data, caches, configuration, time, and the environment.

Use this model:

```text
Input → Validation → Transformation → State Change → Output
```

Ask whether the target is:

- Stateless.
- Stateful.
- Persistent across restarts.
- Session-based.
- Cached.
- Dependent on the environment.

Repeat the same action in different conditions:

1. Start from a clean environment.
2. Perform the action once.
3. Repeat the action without changes.
4. Restart the application.
5. Repeat the action.
6. Change one state value.
7. Compare the results.

Record the result in a state model. Include states, actions, conditions, and transitions.

## Use REA with JavaScript and Electron applications

REA can analyze extracted Electron applications and ASAR archives without running the target.

Use either command:

```bash
rea analyze /absolute/path/to/app.asar --json
```

or:

```bash
rea analyze-javascript-application /absolute/path/to/app --json
```

The analysis can return:

- An application graph.
- Relationships between files.
- Electron observations.
- IPC handlers.
- Preload scripts.
- Module dependencies.
- Imports.
- Source references with line numbers.
- Feature traces.

Use this analysis to:

- Find how a feature works.
- Find IPC channel handlers.
- Trace data from the user interface to the backend.
- Compare application versions.

### Example: trace a button click

The goal is to find what happens when a user clicks a button.

Download and extract an authorized example:

```bash
curl -O https://rea.tools/examples/notes-example.zip
unzip notes-example.zip
```

Analyze the application:

```bash
rea analyze-javascript-application ./notes-example --json
```

Your agent can then:

1. Find the button in the HTML.
2. Find the click handler in the renderer.
3. Trace the IPC call to the main process.
4. Find the file-write operation.
5. Report the file path and CSV schema.

## Use REA with native binaries

REA can analyze executables, libraries, and firmware.

Open a binary:

```bash
rea open-binary /path/to/executable
```

Supported providers include:

- Hopper.
- Ghidra.
- IDA Pro.
- REA built-in analysis tools.

The built-in tools can analyze ELF layout, PE resources, and Go or Rust metadata.

Native binary analysis can provide:

- Disassembled functions.
- Pseudocode.
- Function control flow.
- Strings and symbols.
- Binary layout.
- Relocations.
- Embedded metadata.

Use this analysis to understand authorized software, debug crash dumps, inspect resources, and support defensive security work.

### Example: analyze one native function

Open the binary:

```bash
rea open-binary /path/to/executable
```

Get an overview:

```bash
rea binary-overview
```

Analyze a function:

```bash
rea analyze-function --address 0x401000
```

View pseudocode:

```bash
rea inspect-procedure --address 0x401000 --detail pseudocode
```

Add an annotation:

```bash
rea annotate-native-function --procedure 0x401000 --name "decrypt_data" --comment "Decrypts user data using AES"
```

Treat names such as `decrypt_data` as analyst labels. They do not prove the function purpose until evidence supports the label.

Close binary sessions when you finish. This releases resources.

## Use REA with Android applications

REA can inspect APK files without full decompilation.

```bash
rea open-binary /path/to/app.apk
```

The analysis can provide:

- Manifest declarations.
- Permissions.
- Application components.
- Class and method inventory.
- Static references.
- Resources.

Use this information to understand application structure and permissions in an authorized test environment.

## Use REA with managed code

Analyze a .NET assembly with:

```bash
rea inspect-managed-artifact /path/to/assembly.dll
```

The result can include:

- Type definitions.
- Method definitions.
- IL code.
- Metadata.

Read the result as evidence. A type or method definition does not prove that the target uses the code during the workflow under study.

## Use REA with web applications

A web application can contain browser code, server endpoints, storage, authentication, and external services.

List browser targets:

```bash
rea list-browser-targets
```

Capture a browser scenario:

```bash
rea capture-browser-scenario --actions '\[{"type":"click","selector":"button"}]'
```

Use an authorized test environment to observe:

- HTML structure.
- CSS behavior.
- JavaScript events.
- Network requests.
- Cookies and browser storage.
- Client-side routes.
- Form submissions.
- WebSocket messages.
- Loading sequences.
- Error handling.

Trace one feature from the user action to the final screen update:

```text
User action → Browser event → Network request → Server response → User interface update
```

A visible result can come from local browser state, a server response, or a background request. Separate these cases.

## Inspect network captures

Capture web traffic with browser developer tools or an authorized network tool. Then inspect the capture with REA.

For a HAR file:

```bash
rea inspect-web-network-capture /path/to/capture.har --format har
```

The result can include:

- HTTP requests.
- HTTP responses.
- Request headers.
- Request bodies.
- Response structures.
- Timing information.

You can also inspect packet captures:

```bash
rea inspect-packet-capture /path/to/capture.pcap --fields "frame.number,ip.src,ip.dst"
```

The result can include:

- Protocol information.
- Address summaries.
- DNS summaries.
- Selected packet fields.
- Filtered results.

## Analyze protocols and data formats

A message can use a text, structured, binary, compressed, encoded, or layered format.

Compare several messages for the same operation. Identify:

- Fixed fields.
- Variable fields.
- Optional fields.
- Derived fields.
- Timestamps.
- Identifiers.
- Length values.
- Version markers.
- Checksums.
- Encoded values.
- Error indicators.

Use this format description:

```text
Message type:
Header:
Field order:
Field names or offsets:
Data types:
Required fields:
Optional fields:
Encoding:
Validation rules:
Example message:
Confidence:
```

Do not describe an uncertain field as confirmed. A partial specification with clear limits is better than a complete specification based on guesses.

## Decode signal recordings

REA can decode signal recordings with a selected decoder:

```bash
rea decode-signal-recording /path/to/recording --decoder "i2c"
```

The result can include:

- Protocol decoding.
- Channel analysis.
- Annotation classes.

Use this function only with recordings from equipment and systems that you own or can test.

## Inspect SQLite databases

Inspect a SQLite database with:

```bash
rea inspect-sqlite-database /path/to/database.db
```

The result can include:

- Database schema.
- Table structure.
- Row samples.
- Write-ahead log analysis.

Protect personal and confidential data. Use a copy of the database when possible.

## Inspect WebAssembly modules

Inspect a WebAssembly module with:

```bash
rea inspect-wasm-artifact /path/to/module.wasm
```

The result can include:

- WebAssembly Text output.
- Function analysis.
- Import information.
- Export information.

## Inspect EVM bytecode

Inspect Ethereum Virtual Machine bytecode with:

```bash
rea inspect-evm-interface /path/to/bytecode.bin --encoding raw
```

The result can include:

- Function selector candidates.
- Argument string candidates.
- Reconstructed interface information.

Treat inferred interfaces as hypotheses until you confirm them with additional evidence.

## Read source code as evidence

Source code can contain dead code, old comments, unused configuration, incomplete features, and paths that the current environment cannot reach.

Read source in this order:

1. Documentation and configuration.
2. Entry points.
3. Public interfaces.
4. Data models.
5. Core processing logic.
6. Error handling.
7. Tests.
8. Build and deployment files.

Trace data from input to output. Find validation, data transformations, external calls, state changes, and error paths.

Answer these questions:

- What starts the process?
- What data enters the system?
- Which components transform the data?
- Where does state change?
- What leaves the system?
- What happens when a dependency fails?

## Static and runtime analysis

### Static analysis

Static analysis examines code or artifacts without running the target.

It can show:

- Symbols and references.
- Call graphs.
- Control flow.
- Data flow.
- Dependencies.
- Configuration.
- Schemas and types.
- Validation logic.
- Feature flags.
- Unused or unreachable paths.

A static report must identify the entry point, major functions, data transformations, external calls, error paths, and unknowns.

A code path in a file does not prove that the target can reach that path. Configuration, permissions, feature flags, build variants, and deployment settings can change the result.

### Runtime analysis

Runtime analysis examines a running target. It can show generated values, timing, external calls, resource use, and state changes.

Use these methods in an authorized environment:

- Logging.
- Tracing.
- Breakpoints.
- Runtime inspection.
- Function-call tracing.
- File monitoring.
- Network monitoring.
- Resource monitoring.
- Performance measurement.
- Execution-path comparison.

Use a runtime timeline:

```text
Input event
→ Function or component activity
→ External interaction
→ State change
→ Output event
```

Static analysis and runtime analysis answer different questions. Use both when the target behavior is not clear from one method.

## Analyze failures

Failures reveal system boundaries. Record them instead of treating them as noise.

Follow these steps:

1. Record the environment.
2. Reproduce the failure.
3. Save the exact input.
4. Reduce the input to a minimal case.
5. Read the full error and stack trace.
6. Separate the symptom from the possible cause.
7. Test the possible cause.
8. Record the result.

Include these items in a failure report:

- Environment.
- Reproduction steps.
- Expected behavior.
- Actual behavior.
- Logs and traces.
- Possible cause.
- Confidence level.
- Next test.

Study timeouts, retries, partial results, and fallback behavior. A failed operation can still change state.

## Evidence-based analysis in REA

REA returns evidence with each conclusion. An evidence record can contain:

- `evidence_id`: A unique identifier in the form `ev_[64 hex chars]`.
- `subject`: The analyzed artifact, path, format, name, or digest.
- `provider`: The analysis tool.
- `operation`: The operation that ran.
- `normalized_result`: Structured findings.
- `confidence`: Confidence in the result.
- `limitations`: What the analysis did not determine.
- `relationship_coverage`: The coverage of discovered relationships.
- `locations`: Source ranges and file references.

Preserve each `evidence_id` in your report. This lets another person trace a conclusion to its source.

REA separates:

- **Observations:** Facts that the analysis directly records.
- **Inferences:** Conclusions from patterns or heuristics.
- **Unknowns:** Questions that the analysis cannot answer.

This separation prevents a static result from being presented as proof of runtime behavior.

## Trace features

For JavaScript applications, trace a feature through the code:

```bash
rea trace-application-feature --seed-value "exportCsv"
```

The trace follows the feature from a seed value to related code and implementation areas.

Use the trace as a starting point. Review the source references and evidence before you state how the feature works.

## Export and compare evidence

Export an analysis session:

```bash
rea export-evidence-bundle --path /path/to/bundle.json
```

Inspect an evidence bundle later:

```bash
rea inspect-evidence-bundle --path /path/to/bundle.json --detail summary
```

To compare two application versions:

```bash
rea analyze version1/app.asar --json > v1.json
rea analyze version2/app.asar --json > v2.json
```

Your agent can compare the two Evidence records. Use the comparison to identify changed files, dependencies, feature paths, and observations.

## Model the architecture

After you collect evidence, create a system model.

Use these layers:

1. User interface.
2. Application logic.
3. Service layer.
4. Data layer.
5. Infrastructure.
6. External dependencies.

Map the following items:

- Components.
- Responsibilities.
- Interfaces.
- Data stores.
- Queues and background workers.
- Caches.
- Authentication boundaries.
- Trust boundaries.
- Failure boundaries.
- Deployment environments.

Mark confirmed relationships and inferred relationships in different ways. Do not hide uncertainty in a diagram.

## Reconstruct algorithms and business rules

Use controlled inputs to infer internal rules from external results.

Look for:

- Data transformations.
- Thresholds.
- Default values.
- Sorting rules.
- Ranking rules.
- Normalization.
- Validation conditions.
- Feature flags.
- Deterministic behavior.
- Probabilistic behavior.
- Business policy.

Write the rule in plain language first. Then write pseudocode. Test the rule with new examples. Do not treat a rule as confirmed because it matches only a few examples.

## Build a compatible implementation

A compatible implementation reproduces required behavior with an independent design.

First define the compatibility goal:

- Match inputs and outputs.
- Match error behavior.
- Match ordering.
- Match file compatibility.
- Match a selected feature subset.

Then create contract tests. Implement the required behavior and record all differences.

Use this report structure:

```text
Supported behavior:
Unsupported behavior:
Known differences:
Edge-case behavior:
Test coverage:
Design decisions:
```

This method separates the public behavior from the original implementation.

## Inspect other system types

REA supports several other target types.

### Documentation and workflows

Map:

- Inputs.
- Roles.
- Decisions.
- Tools.
- Outputs.
- Exceptions.
- Failure points.
- Hidden assumptions.

Compare official instructions with observed behavior. This comparison can reveal outdated steps and undocumented workarounds.

### Data and file formats

Compare files that differ in one known way. Study:

- File signatures.
- Headers.
- Metadata.
- Records.
- Offsets.
- Repeated structures.
- Version markers.
- Encoding.
- Compression.
- Integrity checks.

Save original samples. Mark each field as confirmed, inferred, or unknown.

### Hardware and physical systems

Use public documentation and non-destructive tests. Study:

- External interfaces.
- Sensors.
- Actuators.
- Power requirements.
- Communication interfaces.
- Component roles.
- Safety limits.

Create a block diagram. Show what enters the device, what changes, and what leaves the device.

### Defensive security analysis

Study:

- Threats.
- Attack surfaces.
- Trust boundaries.
- Authentication.
- Authorization.
- Input validation.
- Secret handling.
- Dependency risk.
- Suspicious behavior.
- Sandboxing.
- Logging.
- Responsible disclosure.

Use this finding format:

```text
Finding:
Affected component:
Evidence:
Risk:
Reproduction conditions:
Defensive recommendation:
Confidence:
```

## Build a reverse-engineering toolkit

Use tools by capability, not by popularity.

### Observation

Use browser developer tools, system monitors, log viewers, file inspectors, and event capture.

### Capture

Use HTTP clients, network traces, runtime logs, file snapshots, and structured test records.

### Comparison

Use text diff tools, binary diff tools, JSON comparison, timing comparison, and version control.

### Analysis

Use search tools, debuggers, profilers, dependency analyzers, schema inspectors, and format inspectors.

### Testing

Use unit tests, integration tests, contract tests, boundary tests, regression tests, and authorized fuzzing.

### Documentation

Use Markdown notes, diagrams, experiment templates, evidence indexes, and version control.

Start with the smallest tool that can answer the current question.

## Evidence and reproducibility

Another person must be able to repeat your work.

Record:

- Target version.
- Operating environment.
- Configuration.
- Commands and actions.
- Inputs.
- Outputs.
- Logs.
- Timestamps.
- Tool versions.
- Assumptions.
- Confidence levels.

Keep raw evidence separate from derived notes. Do not edit raw captures in place. Use stable names and an evidence index.

## Common mistakes

Avoid these errors:

- Accepting the first hypothesis without a test.
- Changing many variables at once.
- Ignoring default behavior.
- Testing only successful inputs.
- Forgetting caches and state.
- Treating errors as noise.
- Confusing correlation with cause.
- Treating an implementation detail as a requirement.
- Hiding uncertainty.
- Failing to record the environment.

Before you finish, ask:

- Did I have authorization?
- Was the scope clear?
- Did I record exact observations?
- Did I test the main hypotheses?
- Did I include failures?
- Did I study state?
- Did I preserve evidence IDs?
- Can another person reproduce the result?

## Troubleshooting REA

### REA tools do not appear in the agent

Run the client diagnostic command:

```bash
npx rea-agents doctor --client <your-client> --json
```

Then:

1. Restart the AI agent.
2. Read the agent logs for MCP errors.
3. Confirm that the MCP configuration file contains the REA entry.
4. Confirm that the client ID is correct.

### A provider is not available

If Hopper, Ghidra, or another provider is not available:

1. Confirm that the provider is installed.
2. Confirm that the provider is in `PATH`.
3. Run the provider diagnostic command.
4. Use a built-in analysis method when possible.

JavaScript analysis does not require a native analysis engine.

### The result is too large

Start with summary output:

```text
detail: "summary"
```

Then export the evidence bundle:

```bash
rea export-evidence-bundle --path /path/to/bundle.json
```

Inspect only the required sections with the relevant inspection command.

### Static analysis does not answer the question

Use runtime observation. Static analysis does not show every value, state change, external response, or execution path.

### Obfuscated code is difficult to read

REA does not guarantee automatic deobfuscation. Record the limits of the analysis. Use runtime observation and controlled tests in an authorized environment.

## REA quick reference

### Setup and diagnostics

```bash
npx rea-agents setup
npx rea-agents doctor --client <client> --json
```

### JavaScript and Electron

```bash
rea analyze /path/to/app --json
rea analyze-javascript-application /path/to/app --json
rea trace-application-feature --seed-value "exportCsv"
```

### Native binaries

```bash
rea open-binary /path/to/binary
rea binary-overview
rea analyze-function --address <addr>
rea inspect-procedure --address <addr> --detail pseudocode
```

### Web and browser

```bash
rea list-browser-targets
rea capture-browser-scenario --actions '\[...]'
rea inspect-web-network-capture /path/to/capture.har
```

### Other artifacts

```bash
rea inspect-packet-capture /path/to/capture.pcap
rea decode-signal-recording /path/to/recording --decoder "i2c"
rea inspect-sqlite-database /path/to/database.db
rea inspect-wasm-artifact /path/to/module.wasm
rea inspect-evm-interface /path/to/bytecode.bin --encoding raw
rea inspect-managed-artifact /path/to/assembly.dll
```

### Evidence

```bash
rea export-evidence-bundle --path /path/to/bundle.json
rea inspect-evidence-bundle --path /path/to/bundle.json --detail summary
```

## Capstone project

Use the complete REA method on one authorized target.

Choose one target:

- A local web application.
- An unfamiliar command-line tool.
- A public API.
- An open-source library.
- A file format.
- A controlled device.
- A deliberately vulnerable training application.

Complete these phases:

1. Define the scope and authorization.
2. Create the target profile.
3. Establish a baseline.
4. Form hypotheses.
5. Design experiments.
6. Capture evidence.
7. Run static analysis.
8. Run runtime analysis.
9. Build an architecture model.
10. Reconstruct important rules.
11. Build a limited compatible model, if needed.
12. Run contract and regression tests.
13. Record unknowns and limits.
14. Write the final report.

The final deliverables can include:

- Investigation brief.
- Experiment log.
- Evidence archive.
- Architecture diagram.
- Behavior specification.
- Pseudocode or reference implementation.
- Test suite.
- Final technical report.
- Ethical and legal assessment.



## Conclusion

REA combines practical reverse-engineering methods with tools for AI coding agents. It supports static analysis, runtime observation, feature tracing, artifact inspection, and evidence-based reports.

Start with a clear question. Use an authorized target. Record each observation. Test each important hypothesis. Separate facts from inferences. Preserve the evidence IDs. Document the limits of the analysis.

This process lets you understand an Electron application, a native binary, a web application, a database, a protocol, or another technical system one verified piece at a time.


