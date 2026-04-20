# Zotero Todoist Bridge

A Zotero plugin that adds a right-click submenu to send selected papers to Todoist using configurable quick-add templates.

## Zotero Version

Compatible with Zotero 9 and Zotero 10 beta builds.

## What It Adds

- Right-click an item in Zotero and use `Send To Todoist`
- One submenu entry per template
- Templates support:
  - Todoist quick-add smart syntax (`#Project`, `@label`, `tomorrow`, `p1`, etc.)
  - Zotero placeholders like `{{title}}`, `{{year}}`, `{{url}}`, `{{zotero_select}}`

## Configure

In Zotero, open `Settings` and select `Zotero Todoist Bridge`:

1. Set your Todoist personal API token
2. Edit the templates JSON

Example templates JSON:

```json
[
  {
    "name": "Reading Queue",
    "text": "Read {{title}} {{url}} #Reading"
  },
  {
    "name": "Review Tomorrow",
    "text": "Review {{title}} {{url}} tomorrow #Reading p2"
  }
]
```

## Supported Placeholders

- `{{title}}`
- `{{first_creator}}`
- `{{creators}}`
- `{{year}}`
- `{{date}}`
- `{{doi}}`
- `{{url}}`
- `{{zotero_uri}}`
- `{{zotero_select}}`
- `{{item_type}}`
- `{{key}}`

## Build XPI

```bash
./make-xpi
```

Then install the generated `.xpi` from `Tools -> Plugins` in Zotero.
