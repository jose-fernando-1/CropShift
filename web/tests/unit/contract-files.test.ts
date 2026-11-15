import Ajv2020 from "ajv/dist/2020";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = path.resolve(import.meta.dirname, "../../../contract");
const load = (f: string) => JSON.parse(readFileSync(path.join(dir, f), "utf8"));

/** Validates the published examples with a plain JSON Schema validator, the way the FastAPI side will. */
describe("published contract", () => {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  const schemas = Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith(".schema.json"))
      .map((f) => [f.replace(".schema.json", ""), ajv.compile(load(f))]),
  );

  const examples = readdirSync(path.join(dir, "examples"));
  it.each(examples)("%s matches its JSON Schema", (file) => {
    const name = file.split(".")[0];
    const validate = schemas[name];
    expect(validate, `no schema for ${file}`).toBeDefined();
    const ok = validate(load(`examples/${file}`));
    expect(validate.errors ?? []).toEqual([]);
    expect(ok).toBe(true);
  });
});
