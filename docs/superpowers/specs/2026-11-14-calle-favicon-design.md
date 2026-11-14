# CallE favicon design

## Intent

Give CallE an identifiable browser-tab icon without changing the application UI or adding dependencies.

## Approach

Use a local SVG favicon. The icon is a CallE-green speech bubble with a white `C`, which remains legible at favicon size and scales cleanly. An emoji was rejected because browsers render it inconsistently; a raster logo is unnecessary because no brand asset exists.

## Implementation

Add `public/calle-favicon.svg` and reference it from `index.html` with a `rel="icon"` link. No runtime code, API, or behavior changes.

## Verification

Run the production build and confirm the generated HTML retains the favicon reference.
