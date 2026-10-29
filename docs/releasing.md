# Releasing to production

Merging to `main` does **not** update the live site. Production (www.wtfinterview.com) deploys from the `production` branch, which only moves through release PRs.

| Vercel project | Deploys | Notes |
|---|---|---|
| `front-end-prep` | every push to `main` | Pre-release check. Doesn't touch the production database. |
| `wtf_interview_production` | the `production` branch | Commits on `main` show "Canceled by Ignored Build Step"; that's expected. |

The build command (`vercel.json`) is `prisma generate && prisma migrate deploy && next build`, so **production migrations run when a release deploys**, not when the migration PR merges.

## Steps

Version numbers are semver in `package.json`. Bump the minor for features or migrations, the patch for fixes only.

1. **Bump the version.** On a `chore/release-X.Y.Z` branch:
   ```bash
   npm version X.Y.Z --no-git-tag-version
   ```
   Commit `package.json` and `package-lock.json` as `chore(release): vX.Y.Z`. Open a PR to `main` listing what's new since the last release and any migrations or env var changes. Merge it.

2. **Run "Prepare Production Release"** (`.github/workflows/prepare-release.yml`):
   ```bash
   gh workflow run prepare-release.yml -f version=X.Y.Z -f notes="One-line summary"
   gh run watch "$(gh run list --workflow prepare-release.yml --limit 1 --json databaseId -q '.[0].databaseId')"
   ```
   It checks that `package.json` matches, that the tag `vX.Y.Z-prod` doesn't exist yet, and that `main` has unreleased commits. It then generates the release PR body: the change list plus a checklist. Download it:
   ```bash
   gh run download <run-id> -n release-pr-body
   ```

3. **Open the release PR** from `main` to `production`. Actions intentionally doesn't do this.
   ```bash
   gh pr create --base production --head main --title "release: vX.Y.Z" --body-file release-pr-body.md
   ```

4. **Go through the checklist, then merge.**
   - Check the `front-end-prep` deployment of `main`.
   - For each migration in the release, make sure it's backward compatible with the code it replaces. The migration runs during the build, before the new code serves traffic.
   - Check any production-only env var or billing changes.

5. **After the deploy:**
   - "Finalize Production Release" tags `vX.Y.Z-prod` and creates the GitHub Release.
   - Confirm production migrations are applied:
     ```bash
     (set -a; source .env.prod.local; set +a; DATABASE_URL="$DIRECT_URL" npx prisma migrate status)
     ```

## Content that depends on a release

Question imports (`docs/adding-questions.md`) write straight to the production database and don't wait for a deploy. If a question uses something added since the last release, release first and import afterwards. Examples are new `question.json` fields or a new grader feature such as `argTypes`. Otherwise the import fails on missing columns or, worse, publishes a question the live grader can't run.
