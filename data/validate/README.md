# Validation

`python -m data validate gate` checks whether the water-balance engine reproduces the official ZARC window, per crop. It needs `etl precompute-windows` first. For how this fits the wider evidence see [../../docs/validation/README.md](../../docs/validation/README.md).

For every ZARC row (municipality and texture soil class) it takes the engine's 36 success frequencies for that municipality's climate cell and soil class, and the ZARC indicator (`value > 0`), and computes the Spearman rank correlation. A crop's gate value is the median over all those pairs; it passes at 0.7 or more. The result is stored on the crop (`gate_status` `passed`, `failed` or `not_run`, `gate_value`, `gate_threshold`, `gate_note`) and served in `GET /api/v1/crops`. Crops without ZARC rows stay `not_run`.

Caveats:

- It measures agreement with the ZARC method, not agronomic truth: ZARC is itself derived from a water balance, so agreement is not independent validation.
- The statewide median is informational. The API applies the same test per location when it ranks (see [../../backend/README.md](../../backend/README.md)), so a crop that fails statewide can still pass at a place where it agrees with ZARC, and the reverse.
- `validate gate` prints one line per crop and writes the database only. `python -m data validate report` generates [../../docs/validation/report.md](../../docs/validation/report.md) (pilot reproduction, gate table, sensitivity, IMERG against POWER rain, PAM check) from the database; its code is `report.py` here.
