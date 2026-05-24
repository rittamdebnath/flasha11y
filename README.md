# flashA11Y

**Design Accessibility & UX Audit Agent** — automated accessibility and UX auditing of UI design screenshots using Vision AI.

Drop your Figma exports in a folder, point flashA11Y at them, and get a detailed audit report with annotated screenshots in seconds.

## How It Works

flashA11Y sends each UI screenshot to a Vision LLM (Claude or Gemini) with a structured system prompt that acts as a senior accessibility reviewer, design systems auditor, UX governance specialist, and cognitive accessibility analyst. It then parses the findings, deduplicates across screens, applies company-specific severity rules, and generates reports.

### Analysis pipeline

1. **Scan** — discovers all screens in `exports/{mobile,tablet,desktop,flows,states}/`
2. **Context** — loads your design tokens, brand guidelines, accessibility rules, and severity overrides
3. **Analyze** — sends each screen to the Vision API with prompts tailored for accessibility, usability, cognitive clarity, design consistency, readability, and interaction predictability
4. **Cross-screen** — deduplicates findings across screens and applies company rule overrides
5. **Report** — generates JSON and Markdown reports with annotated images

## Quick Start

### Prerequisites

- Node.js 20+
- An API key for at least one Vision LLM provider:
  - **Anthropic Claude**: Set `ANTHROPIC_API_KEY` (starts with `sk-ant-...`)
  - **Google Gemini**: Set `GOOGLE_GEMINI_KEY`

### Installation

```bash
git clone https://github.com/your-org/flashA11Y.git
cd flashA11Y
npm install
npm run build
```

### Usage

```bash
# Run with Gemini (free tier available)
GOOGLE_GEMINI_KEY=your-key npm run dev -- --model gemini-2.5-flash

# Run with Claude
ANTHROPIC_API_KEY=sk-ant-... npm run dev -- --model claude-sonnet-4-6

# Or use the built CLI
npm run build
npm start -- --exports ./exports --model gemini-2.5-flash
```

### CLI Options

```
Usage: flashA11Y [options]

Options:
  -e, --exports <path>     Path to exports folder (default: ./exports)
  -c, --context <path>     Path to context folder (default: ./context)
  -o, --output <path>      Output directory (default: ./output)
  -m, --model <model>      Claude or Gemini model (default: claude-sonnet-4-6)
  --concurrency <n>        Parallel API requests (default: 5)
  --batch-threshold <n>    Use Batches API above N screens (default: 50)
  --no-boost               Disable company-rule severity boosting
  -v, --verbose            Verbose logging
  --json-only              Output only JSON report
  --md-only                Output only Markdown report
```

## Project Structure

```
flashA11Y/
├── exports/               # Drop your screenshots here
│   ├── mobile/            # Phone screenshots
│   ├── tablet/            # Tablet screenshots
│   ├── desktop/           # Desktop screenshots
│   ├── flows/             # Multi-screen user flows
│   └── states/            # UI state variants (loading, error, empty)
├── context/               # Your design context (optional)
│   ├── accessibility-guidelines/
│   │   └── company-rules.txt  # Severity overrides
│   ├── design-tokens/
│   │   └── tokens.json        # Colors, spacing, typography
│   ├── design-system/
│   ├── product-principles/
│   └── brand-guidelines/
├── output/                # Audit results go here
│   ├── flasha11y-report.json
│   ├── flasha11y-report.md
│   └── *.png              # Annotated screenshots
└── src/
    ├── analysis/          # LLM providers, prompt templates, API calls
    ├── scanner/           # File discovery, screen grouping, context loading
    ├── cross-screen/      # Deduplication and prioritization
    ├── reporting/         # JSON and Markdown report generation
    ├── annotator/         # Annotated screenshot generation
    └── types/             # TypeScript type definitions
```

## Context Configuration

Customize the audit by adding files to the `context/` directory. flashA11Y loads these automatically and feeds them into the analysis prompt.

### Company Severity Rules

Create `context/accessibility-guidelines/company-rules.txt`:

```
color contrast below 4.5:1 -> critical # Legal compliance
touch target below 48px -> high # Company standard exceeds WCAG 44px
missing focus indicator -> critical # Keyboard navigation requirement
font size below 14px -> medium # Readability standard
```

These rules automatically **boost** matching findings to the specified severity level.

### Design Tokens

Place a `tokens.json` in `context/design-tokens/` with your colors, spacing scale, typography, and border radii. The AI uses these to check for consistency violations.

### Accessibility Guidelines

Add any organization-specific accessibility policies as text files in `context/accessibility-guidelines/`.

## Supported Models

| Model | Provider | Vision | Notes |
|---|---|---|---|
| `claude-sonnet-4-6` | Anthropic | Yes | Default, best balance |
| `claude-opus-4-7` | Anthropic | Yes | Highest quality |
| `claude-haiku-4-5` | Anthropic | Yes | Fastest, lowest cost |
| `gemini-2.5-flash` | Google | Yes | Free tier available |
| `gemini-2.5-pro` | Google | Yes | Higher quality, paid |
| `gemini-2.0-flash` | Google | Yes | Stable, free tier |
| `gemini-3-flash-preview` | Google | Yes | Latest preview |

## Output

### JSON Report

Machine-readable report with all findings, severity breakdowns, category distributions, priorities, and metadata.

### Markdown Report

Human-readable report with executive summary, severity distribution chart, prioritized findings with WCAG criteria, affected user groups, and recommendations.

### Annotated Images

Screenshots with finding overlays highlighting issues directly on the UI.

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Audit complete, no critical findings |
| 1 | Fatal error (no images found, API key missing, etc.) |
| 2 | Audit complete, **critical findings exist** |

Use exit code 2 in CI/CD to block deploys when critical accessibility issues are detected.

## License

MIT
