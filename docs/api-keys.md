# API keys and credentials

Most sources need no key. The API itself needs none to run; the only optional secret there is the Gemini key. Check what works with `python -m data doctor` (or `make doctor`): it makes one small request per source, shows the fix for each failure and never prints a secret.

| Service | Key | Needed for | Required |
| --- | --- | --- | --- |
| NASA POWER | none | `extract power` | no key |
| SoilGrids REST | none | `extract soilgrids` | no key |
| IBGE (malhas v3, localidades, SIDRA) | none | `extract ibge-geo`, `extract ibge-pam` | no key |
| MAPA ZARC | none (manual browser download) | `extract zarc` | no key |
| NASA Earthdata | free account | satellite extraction (AppEEARS, GES DISC) only | not by the API, the ETL or the demo seed |
| Google Gemini | API key | AI-written explanations | optional; without it the template is used |

## NASA Earthdata

1. Register for free at <https://urs.earthdata.nasa.gov>.
2. For IMERG and GLDAS (GES DISC data), open your Earthdata profile, then Applications, Authorized Apps, and approve "NASA GESDISC DATA ARCHIVE".
3. Put the credentials in `data/.env`, which is git-ignored:

```bash
EARTHDATA_USERNAME=your_username
EARTHDATA_PASSWORD=your_password
```

`doctor` logs in to AppEEARS and reports `OK` when it gets a token. Only the satellite pipeline uses these values; `python -m data extract appeears` uses them (written, tested only with a mocked transport, not yet run against the live service) (see [../data/README.md](../data/README.md)).

## Gemini

1. Create a key in Google AI Studio.
2. Set both values in `backend/.env` (outside containers) or in the root `.env` read by compose (the `api` service passes them through):

```bash
GEMINI_API_KEY=your_key
GEMINI_MODEL=a_model_offered_to_your_key
```

`doctor` lists the flash models your key can use and flags a `GEMINI_MODEL` that is not offered. With either value empty, `POST /api/v1/recommendations/{id}/explain` returns the deterministic template.

Privacy: the free tier of the Gemini API may use content to improve Google products, so the backend sends only the already computed, coordinate-free recommendation JSON, never coordinates or personal data. Answers are validated and any percentage not derivable from the payload makes the backend fall back to the template. Details: [../backend/README.md](../backend/README.md).

## Rules

- Never commit a real key or password. `.env` and `.env.*` are git-ignored; only `*.example` files are tracked (`backend/.env.example`, root `.env.example`).
- `data/.env` is read by `python -m data` only, after `backend/.env`; real environment variables win over both.
- The development database password `change_me` is a placeholder for local use; set `POSTGRES_PASSWORD` anywhere shared.
