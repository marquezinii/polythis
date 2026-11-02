# Contributing to polythis

Thanks for helping make language-fit decisions less guessy.

## Good contributions

- **Signals:** a pattern that reliably marks a candidate in a specific language (add it to `skills/polythis/references/signals.md`).
- **Interop recipes:** a host × guest pairing, tool, or pitfall missing from `references/interop.md`.
- **Calibration cases:** a migration you did or studied, with the workload, the evidence, the boundary, and the outcome, including ones that failed (`references/case-studies.md`).
- **Inventory script:** better language detection, generated-file filters, or interop markers in `scripts/inventory.mjs`. Keep it dependency-free and read-only.

## Guidelines

- Keep `SKILL.md` lean. Detail belongs in `references/`, which agents load only when needed.
- Claims about performance need a source or a reproducible benchmark.
- Test changes to the skill by running it on a real repository with your agent and comparing the report before and after.
- Check the script still parses: `node --check skills/polythis/scripts/inventory.mjs`.

## Reporting a bad verdict

Open an issue with the repository (or a minimal reproduction), the prompt you used, the verdict you got, and the verdict you expected. Bad verdicts are the most useful bug reports this project can get.
