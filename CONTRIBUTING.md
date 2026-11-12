# Contributing

## Workflow

1. Branch from `main`: `feat/<story-id>-short-name` or `fix/<short-name>`.
2. Keep commits small and use [Conventional Commits](https://www.conventionalcommits.org/): `feat(deals): …`, `fix(import): …`, `test: …`, `docs: …`.
3. Run `npm run test:all` before pushing.
4. Open a pull request using the template. CI must be green to merge.

## Code standards

- **Rules in `src/core`, rendering in `src/ui`.** If it decides something, it belongs in core with a unit test.
- **Read and write through the API.** Never mutate `store.state` from a view.
- **Comment intent, not mechanics.** Every exported function has a JSDoc block; non-obvious lines say why.
- **Escape everything.** Use `esc()` in templates and `textContent` for messages.
- **Brand tokens only.** `npm run check:brand` enforces the seven IK colours.
- **Accessible by default.** Every input has a label; icon buttons have `aria-label`; dialogs close with Escape.
- **Scope.** Changes must map to a build prompt story. V2 and V3 items wait for their phase.
