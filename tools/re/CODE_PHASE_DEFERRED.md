# Deferred — CODE feature patches (Phase 4)

**Status: explicitly deferred / cancelled for this implementation pass.**

Do not implement CODE-section feature patches until:

1. DATA definition packs + verification gates are solid
2. Live `definitionBuilder` exact/family/unknown path is trusted
3. Offline RE can emit curated patch artifacts (byte patches + required DATA companions)

When revived, patches must be **deterministic curated artifacts** from the offline pipeline — never free-form AI code edits in the browser app.
