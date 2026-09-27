# Git workflow

- Name implementation branches with a conventional prefix such as `feat/`, `fix/`, `chore/`, or `docs/`. Never use `codex/` in a branch name.
- For a completed implementation request that changes repository files, run the relevant checks, commit only task-related files, push the branch, and create a GitHub pull request automatically.
- Use a concise conventional commit and PR title. Do not include pre-existing user changes in the commit or pull request.
- If GitHub authentication or network access prevents pushing or creating the pull request, report the exact blocker and leave the committed branch ready to publish.
