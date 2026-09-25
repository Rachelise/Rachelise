# UNT degree dashboard

A progress dashboard for my **Bachelor of Applied Arts & Sciences (BAAS)** at the
University of North Texas. The source of truth is the **Degree Audit** database in
Notion; this project pulls it, models it against the BAAS requirements, and renders
one page.

What it shows:

- **Hours toward 120**: completed, in progress, planned, and anything not yet planned.
- **GPA**: UNT-only GPA and transfer GPA, computed from letter grades. Pass/CR grades are left out.
- **Advanced hours**: 3000/4000-level hours against the 42 required.
- **Projected graduation**: set the hours per term and whether you take summers.
- **Requirements**: each University Core and BAAS block with a meter scaled to its hours.
- **Credit history**: hours earned per term, with transfer credit and UNT shown separately.
- **Still to take**: every remaining course and unplanned hour, filterable by group.
- **Things to check**: plan gaps and cleanup items in the Notion database, such as duplicate rows.

## Use it

Open `index.html` in a browser. It reads the committed snapshot in `data/courses.js`,
so it needs no server and no build.

## Refresh from Notion

1. Create an internal integration at <https://www.notion.so/profile/integrations> and copy its secret.
2. In Notion, open **Degree Audit** → `•••` → **Connections** → add the integration.
3. Run:

   ```sh
   NOTION_TOKEN=secret_xxx npm run sync
   ```

   This rewrites `data/courses.json` and `data/courses.js`. Reload the page.

`NOTION_DATA_SOURCE_ID` overrides the default data source
(`8f6d8ba2-6745-48e4-8f32-0e6ea68c1244`).

## How rows are counted

The model is in `src/degree-model.js`:

- **Not counted**: withdrawals (W), failed attempts (F), rows with 0 credits,
  rows whose Requirement is *Credit Not Contributing Toward Degree* or
  *Duplicate/Repeated Course*, and rows titled `[NOT NEEDED] …`.
- **Duplicates**: rows with the same course code, term and status count once. The
  copy that has a Requirement filled in wins.
- **Requirement blocks**: a row goes to the block whose prefix matches its
  Requirement text (`src/requirements.js`). If a block has more hours than it needs,
  the extra hours count as electives. Rows that match no block also count as electives.
- **Electives** need whatever is left of 120 after the named blocks.

The totals (120 hours, 42 advanced, and each block's hours) come from my audit notes.
If the official UNT audit says otherwise, edit `src/requirements.js`.

## Other commands

```sh
npm test        # model tests (Node 18+)
npm run build   # dist/index.html: one self-contained file with data and scripts inlined
```
