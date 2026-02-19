# Build Wizard Seed Assets

This folder contains seed assets used by the Build Wizard framework.

- `seed/build_wizard_seed.json` is generated from these source spreadsheets:
  - `Cabin Expenses.xlsx`
  - `Cabin Timeline.xlsx`
  - `Cabin Materials List.xlsx`
  - `Cabin Task List.xlsx`
  - `Cabin Timeline w_ Prices.xlsx`

The API endpoint `/api/build_wizard.php` uses this file to initialize a new Build Wizard project in MySQL (`build_wizard_*` tables).
