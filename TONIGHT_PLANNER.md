# Bu Akşamı Planla — native

Built on `ux-retention-v1`, the branch explicitly used by the existing production OTA workflow (not `main`). Companion API change: `falanfilan-api/feature/tonight-planner`.

## Flow

Home card and AI section open `TonightPlanner`. Eight questions: company, film/series, mood, duration, pace, avoided genres, origin and available subscription platforms. Partner/friends adds an optional ninth step for one/five accepted Pellix friends. Profiles with private likes or blocks are filtered server-side. No invitations or notifications are sent; only the host needs premium.

Providers come from the API's combined TR film/TV provider catalogues; names, logos and provider IDs are real metadata, not hardcoded subscription assumptions. The platform selection is saved on this device per signed-in user after a successful plan; it is not cross-device profile synchronization. A shared-location session uses any selected service. Remote synchronization is out of scope.

Result: a main choice and up to two alternatives, reasons, runtime and verified subscription platforms. Details and existing list picker are connected. “Bunu izledim” excludes from this planning session without overwriting diary dates/ratings. “Başka öneriler bul” excludes the current batch. Unknown/empty results explain the limitation instead of silently relaxing constraints. Friends' private watch history is never claimed to be known.

Premium is enforced by the API. Returning from the purchase screen rechecks status/options. A server-not-ready error is shown if OTA precedes API deployment, but the intended rollout is API first.

## Validation

Native package/config/lockfiles were not changed. No new permissions, native dependencies, SDK upgrades or entitlements.

```sh
npm ci --ignore-scripts --no-audit --no-fund
CI=1 npx expo export --platform all --output-dir ../pellix-export
```

Optional interaction tests install dependencies outside the native tree to avoid changing OTA fingerprints:

```sh
npm install --prefix ../pellix-test-runtime --ignore-scripts --no-audit --no-fund react@19.1.0 react-test-renderer@19.1.0
PELLIX_TEST_RUNTIME="$(cd ../pellix-test-runtime && pwd)" node --test test/tonight-planner-ui.test.cjs
```

Tests render the actual screen with mocked RN primitives/network and verify solo/group answers, required platforms, premium routing, exclusions, watchlist handoff and retry. They do not substitute for physical iOS/Android layout, purchase and live API verification.

## Release

1. Deploy companion API to staging and point a preview at it via existing `EXPO_PUBLIC_API_BASE` support.
2. Smoke-test both phones, including platform search/long names, larger text, profile privacy changes, empty results, slow network, premium expiry and purchase/restore return.
3. Deploy API to production, then merge this change to `ux-retention-v1` and use the existing OTA workflow after validating runtime compatibility with installed builds. Do not upgrade or override runtimeVersion to force compatibility.

The feature is JS-only and designed for OTA, but a local export does not establish installed binary compatibility or store-policy approval. This PR does not publish an update.
