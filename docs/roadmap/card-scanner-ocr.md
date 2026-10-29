# Card scanner - OCR roadmap

Ideas to make the phone scanner (`/add-cards/scan`) faster and more reliable, ordered by what to do first.
It is a list of options, not a commitment: each item is picked up only when the owner decides, and its result is judged with the checks under [How to judge a change](#how-to-judge-a-change).

Last updated: 2026-10-10, after #128, #129, #132, #133 and #134.

## Where it stands

Everything runs in the browser; no image leaves the phone.

1. Every 120 ms, when no read is in flight, the scanner grabs a video frame: the card guide plus an 8% margin, in grey (`scanner-deps.tsx`).
2. It estimates the card's tilt (±12°) from the horizontal edges near the bottom of the card and crops the code line along that angle (`ocr-skew.ts`).
3. One of three variants prepares the line: contrast stretch, resize to the height the recognizer was tuned on, and for two of them inversion plus a fixed threshold (`ocr-variants.ts`).
4. Tesseract 7 (tesseract.js, WebAssembly, `eng` LSTM model) reads it in a Web Worker (`ocr-engine.ts`).
5. The resolver finds a 6-character collector code in the text, fixes lookalike characters, and only returns codes that exist in the catalog (`collector-code.ts`).
6. A card is accepted when two different variants read the same code within the last six reads (`scan-session.ts`).

Measured so far:

| Signal | Value | Where it was measured |
|---|---|---|
| Time per read | ~5 ms preparing + ~150 ms OCR | M-series Mac, phone-size card |
| Camera ready to card accepted | ~0.9 s | Chromium fake camera, CPU slowed 4x |
| Cards accepted, level | 33/38, 0 wrong | Reference set, official images and 885 px wide |
| Cards accepted, ±6° tilt | 32-33/38, 0 wrong | Same set, rotated inside a capture with margin |
| Tilt estimate | ~8 ms per read | M-series Mac |

None of these numbers come from a real phone.
The reference images are clean official renders scaled up, with no blur, noise, glare, sleeves or foil.
The owner reports that the scanner works well on an Android phone with Chrome since #129, #132 and #134, but that is a qualitative signal.

`/add-cards/scan?debug=1` shows the opened camera, its settings, the code line exactly as the recognizer receives it, and the raw text and duration of each read.

## Rules that every item keeps

- **No wrong card.** A miss costs one more read; a wrong card ends up in the user's library. Any change that trades accuracy for speed must keep the benchmark at 0 wrong.
- **Measure before changing.** #132 and #134 both started from a measurement that named the cause (oversized images, a crop band that the tilted line left). Guesses would have missed the resolver bugs that #132 found.
- **Real phones decide.** When a real-device signal contradicts the benchmark, the real device wins.

## Tier 1 - measure on real phones

These come first because every later item is a guess until they exist.

### 1. Passive scan telemetry

Count what happens during real scans, with no image and no card content beyond the accepted code:

- reads per accepted card, and time from the first read of a code to its acceptance;
- per-variant duration, and how often each variant's read resolved to the accepted code;
- tilt estimates of accepted cards;
- "Não é essa" / "Wrong" taps per accepted card, which is the closest proxy for a wrong card;
- device class: camera label pattern, whether continuous focus and zoom were granted.

Effort: medium.
There is no product telemetry today, only opt-in Sentry for errors.
Needs an owner decision on where events go (a small API endpoint and table, or an existing service) and a privacy note.
This matches the telemetry-first rule in `docs/validation-philosophy.md`.

### 2. A real-frame corpus

Add a "save frame" action to the debug panel that downloads the captured card (guide plus margin) as a PNG with the camera settings.
Frames that failed or were slow become benchmark cases next to the official images.

Effort: low for the button, medium to curate the set.
Photos of physical cards are LSS card images: check `docs/research/ip-posture.md` before committing any to the repository. Keeping them in the gitignored `.cache/` like the official images avoids the question.

## Tier 2 - speed

### 3. Prune or reorder the variants

On the fake camera, `full-binary-sparse` sometimes returns a single letter, which spends a whole read for nothing.
With telemetry (item 1) or real frames (item 2), drop variants that rarely agree with the accepted code, or move the best pair to the front.
Two useful reads in a row is the fastest a card can be accepted.

Effort: low. Depends on item 1 or 2.

### 4. Two OCR workers in parallel

Reads run one at a time, and acceptance needs about 2.7 reads per card.
Running two Tesseract workers on two variants of the same frame would roughly halve the time to accept on multi-core phones.

Effort: medium. Doubles the memory used by the recognizer (one more copy of the model), which matters on low-end phones.

### 5. Read only the code token

The recognizer reads the whole bottom line, including the artist name and the copyright.
Cropping only the left part (`EN | HNT135`), reading it as a single line (`tessedit_pageseg_mode` 7) with a character whitelist would make each read smaller and remove junk that the resolver has to see past.

Effort: medium. The left edge of the token moves between printings (rarity symbol, foiling marks), so the crop has to be validated on the whole reference set.

### 6. Skip blurry frames

While the hand moves, most frames are blurred, and each still costs a full read.
A sharpness score on the code line (variance of the Laplacian) can skip those frames before they reach the recognizer.

Effort: low. The threshold has to come from real frames (item 2).

## Tier 3 - robustness

### 7. Adaptive binarization

Two variants cut black and white at a fixed grey level (140).
Foils, glare from the flashlight and coloured borders shift that level.
An adaptive threshold (Otsu over the line, or Sauvola per pixel) follows the actual contrast.

Effort: medium. Needs foil and glare frames to prove the gain (item 2).

### 8. Perspective and free placement

Tilt correction (#134) handles a card rotated in its own plane.
A card tipped towards or away from the camera still distorts the line, and the user still has to fill the guide.
Detecting the card's four corners and warping it to a flat rectangle fixes both.

Effort: high. Corner detection in plain TypeScript or a computer-vision library in WebAssembly (OpenCV.js is several MB).

### 9. Focus fallbacks

Some phones still will not grant continuous focus.
Options, in order of cost: tap-to-focus through the `pointsOfInterest` constraint; a manual focus slider where `focusDistance` is exposed; a still photo through `ImageCapture.takePhoto()`, which uses the camera's photo pipeline with autofocus at full resolution.

Effort: medium. The debug panel already shows which of these a camera offers.

### 10. Upside-down cards

A card held upside down never reads.
When nothing resolves for a while, try the same frame rotated 180°.

Effort: low.

## Tier 4 - bigger bets

### 11. A recognizer trained for the code line

Tesseract is a general text model.
The collector code is one font, a fixed layout and only letters and digits.
A small model trained on that font, either a fine-tuned Tesseract model or a tiny classifier run with ONNX Runtime Web, would be faster and more accurate than the general model.

Effort: high. Needs a labelled set of code-line crops; the reference images plus real frames (item 2) are a start.

### 12. Card art matching as a second signal

Match the card's artwork against the catalog's images (perceptual hash or image embeddings) to confirm or replace the code read.
Works when the code line is unreadable: sleeves, foils, worn cards.

Effort: high. Needs an index built from card images; check `docs/research/ip-posture.md` first.

### 13. Accept on one confident read

Today two variants must agree.
Accepting a single read when Tesseract's confidence is high and the code is unambiguous in the catalog would cut the time to accept to one read.

Effort: medium. Only with telemetry (item 1) showing a low "Wrong" rate, and the benchmark at 0 wrong.

## How to judge a change

- **Accuracy:** `apps/web/src/components/card-scanner/__tests__/recognition-benchmark.spec.ts`. Keep 0 wrong in every case. Add cases for whatever the change targets, as #132 (camera size) and #134 (tilt) did.
- **End to end:** `apps/web/tests/e2e/card-scanner-flow.spec.ts` with Chromium's fake camera. For a one-off check, build a fake-camera video from a reference card with the transformation under test (tilt, blur, glare) and time camera-ready to notice, with the CPU slowed 4x through the DevTools protocol.
- **Speed:** time per read and reads per accepted card, from the debug panel today and from telemetry once item 1 exists.
- **Real phones:** `?debug=1` screenshots from the owner's phone until telemetry exists.
