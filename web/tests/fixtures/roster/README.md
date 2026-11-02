# Roster workbook fixtures

Synthetic files (invented names and IDs) produced by `tools/roster-fixtures/generate.py` with three
independent producers: **XlsxWriter**, **openpyxl** and **LibreOffice** (headless). They exercise the
minimal XLSX reader in `src/features/roster/domain/xlsx.ts`.

**Not covered:** files saved by Microsoft Excel, Google Sheets or WPS Office themselves, which were not
available when these were made. XlsxWriter mimics Excel's output closely, but that is not the same as an
Excel-saved file. Check a real file with `npm run roster:check` (see `tests/tools/roster-file-check.test.ts`)
before relying on it, and never commit a real roster here.
