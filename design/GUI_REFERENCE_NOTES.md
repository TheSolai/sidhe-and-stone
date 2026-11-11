# GUI Reference Notes — Kairosoft-style UI for GameStewKit

**Compiled:** 2026-11-11 · **Scope:** web research only. No game code was read or modified.
**Deliverable for:** the GameStewKit GUI redesign.

---

## How to read this

Every rule below is written as an imperative you can implement and then verify.

- **RULE** — the instruction, written so an implementer can act on it directly.
- **Evidence** — the concrete, observed detail the rule is derived from. Where the evidence came from a screenshot I read pixel-by-pixel, I say so. Where it came from a montage-level scan of 56 App Store screenshots, I say that instead — those readings are corroborating, not load-bearing.
- **Source** — a URL I actually fetched, or a URL that appeared in search results and that I state as such. Nothing here is cited from memory.

**Confidence markers used in the text:**

| Marker | Meaning |
|---|---|
| *(verified)* | I opened this specific image/URL and read the detail directly |
| *(corroborating)* | Seen consistently across many screenshots, but not read pixel-by-pixel |
| `NO SOLID EVIDENCE FOUND` | I looked and could not find it. Nothing is invented to fill the gap. |

**The single most important caveat in this document:** the highest-value source everyone assumed would exist — actual Kairosoft source code — **does not exist in public form.** `Red-K0/GameDevStory-Decomp` is an *asset extraction* project, not a decompilation of code: it contains the 1996 PC game's bitmaps, WAVs and executables, and no source files at all. The rich UI constant data everyone hoped for in it **does not exist**. What I could extract instead is *far better anyway*: 56 real App Store screenshots from 10 live Kairosoft titles, which show the shipping UI rather than a lossy reconstruction of it. Every visual claim below comes from those real shipping builds.

---

## 1. Top status bar organisation

**RULE 1.1 — Order the top bar: date/time on the left, resource icon+value pairs in the middle, money hard right.**
- **Evidence:** *(verified)* In `Game Dev Story` (iPhone), the top bar reads left→right: `Y6` + a currency symbol, then three console/hardware product icons each paired with a small controller icon and numeric stat modifiers, then the money figure at the far right against a gold coin icon. In `Convenience Stories` the order is: date banner (`Y7 Spr 12:00`) → sun-in-a-box shift meter (`Daytime Shift/6` + progress bar + `★23`) → money `5,060,663G` → research bulb `47` → medals ribbon `80`. In `Tropical Resort Story`: green capsule `7 Yr` → `7 Mn` → lightbulb icon + `1,052` → gold coin icon + `7,347,050`.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1601177112 · https://itunes.apple.com/lookup?id=1617006551

**RULE 1.2 — Show every resource as an icon+value pair; never a bare word.**
- **Evidence:** *(verified)* `Pocket Academy 3` row 2 is: a pencil graphic containing the word `Popula` and the number `3918`, then a green pen icon + `3055`, a blue beaker icon + `3123`, a red book icon + `2028` — all in one horizontal row of icon→number pairs. `Convenience Stories` shows bread/burger/coffee icon pairs. `Game Dev Story` shows a single floppy-disk icon + `284` for Research Data.
- **Source:** https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=396085661
- **Corroborating, official:** the `Game Dev Story` manual states "**The upper left floppy disk shows your Research Data.**" — the icon *is* the label, in the game's own words.
  - **Source:** https://kairosoft.wiki.gg/wiki/Transcript:Manual_(Game_Dev_Story)

**RULE 1.3 — Put money at the far right as a coin icon plus the largest number on the bar.**
- **Evidence:** *(verified)* `High Sea Saga`: gold coin icon + `69,927,999G`. `Tropical Resort Story`: gold coin (gold circle with a white `C`) + `7,347,050`. `Pocket Academy 3`: `68,810,600G` in a larger yellow/green weight than every other number on the bar. `Game Dev Story` uses a `$` prefix and `K` thousands suffix instead (`$11,673.7K`, `6K`).
- **Source:** https://itunes.apple.com/lookup?id=1084639614 · https://itunes.apple.com/lookup?id=1557657042 · https://itunes.apple.com/lookup?id=396085661

**RULE 1.4 — Format money with comma thousands separators and a currency suffix.**
- **Evidence:** *(verified)* `5,060,663G`, `86,473,160G`, `69,927,999G`, `11,673.7K`.
- **Source:** https://itunes.apple.com/lookup?id=1601177112 · https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=1084639614

**RULE 1.5 — Keep the top bar to at most two stacked rows; put a scrolling ticker in a third, semi-transparent row rather than adding more permanent chips.**
- **Evidence:** *(verified)* `Pocket Academy 3` stacks exactly three rows: row 1 date + money; row 2 popularity + three resource icon+value pairs on a light teal/cyan gradient; row 3 a semi-transparent dark green ticker with a yellow megaphone icon and scrolling text ("It's Practice Match Training Month month"). The ticker is visually subordinate to the resource row.
- **Source:** https://itunes.apple.com/lookup?id=1623111026

**RULE 1.6 — Give the top bar a themed but low-chroma background so it separates from the artwork without competing with it.**
- **Evidence:** *(verified)* `Game Dev Story` uses a semi-transparent red bar; `Pocket Academy 3` a light teal gradient; `Tropical Resort Story` a teal/turquoise gradient with subtle wave graphics. All are mid-value and desaturated relative to the sprites beneath.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=1617006551

---

## 2. Bottom navigation

**RULE 2.1 — Anchor the bottom bar; never let it scroll with content.**
- **Evidence:** *(verified)* In `Tropical Resort Story` the bottom bar is fixed at the screen edge and is separated from the play area by a hard background change — the illustrated beach scene gives way to a brown wood-grain panel. In `Game Dev Story` the bottom bar is separated by a distinct dark blue horizontal divider line above `Save` / `Menu`.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=396085661

**RULE 2.2 — Use 3–5 destinations for a tab bar, and give every destination an icon *and* a text label.**
- **Evidence:** Material Design 3: "Navigation bars provide access to three to five destinations… **Each destination is represented by an icon and label text. One navigation destination is always active.**" It also warns "**Don't remove the labels from navigation items**" and "All navigation items require a label text. It should be 1-2 words."
- **Source:** https://m3.material.io/components/navigation-bar/guidelines

**RULE 2.3 — Signal the active destination with a single, unmistakable indicator — and only one.**
- **Evidence:** Material 3: "The active indicator shows which page from the nav bar is currently being displayed", "**Use the active indicator only for the active destination**", "**Don't use the active indicator for more than one destination at a time**", and "Active and inactive icons must have a minimum **3:1 contrast ratio** with the container."
- **Source:** https://m3.material.io/components/navigation-bar/guidelines

**RULE 2.4 — Keep the tab bar's chrome monochrome when the content underneath is colourful.**
- **Evidence:** Apple HIG, tab bars: "**Avoid applying a similar color to tab labels and content layer backgrounds.** If your app already has bright, colorful content in the content layer, prefer a **monochromatic appearance for tab bars**, or choose an accent color with sufficient visual differentiation." HIG also specifies the tab bar is **68 points** tall, translucent by default with only the selected tab opaque.
- **Source:** https://developer.apple.com/design/human-interface-guidelines/tab-bars

**RULE 2.5 — Do not copy the Kairosoft bottom bar literally for a tab bar. Kairosoft's own bottom bar is an action bar, not a tab bar.**
- **Evidence:** *(verified)* Across the sampled Kairosoft titles, the bottom bar is consistently **2–3 action buttons**, not a destination tab strip: `Save` / `Menu` (`Game Dev Story`, `Pocket Academy 3`, `Pocket League Story 2`, iPad builds); `Site` / `Finish` (`Tropical Resort Story`, `Pocket Academy 3`); `Site` / `Quit` (`Kingdom Adventurers`, `High Sea Saga`); `Site` / `Rankings` (`Pocket League Story 2`); `Items` / `Menu` (`Tropical Resort Story`); `Map` / `Menu` (`High Sea Saga`). Where a Kairosoft button carries an icon, it is a small pixel icon sitting **beside** the label, with the label noticeably larger than the icon.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1557657042 · https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=1103109519 · https://itunes.apple.com/lookup?id=1084639614 · https://itunes.apple.com/lookup?id=1478584982

**RULE 2.6 — If you keep an icon on a bottom-bar button, put the icon first (left) and the label after it.**
- **Evidence:** *(verified)* `Tropical Resort Story`'s `Site` button: a small character pixel icon followed by the word `Site`, with the text rendered larger than the icon. `Pocket League Story 2`'s `Site` button: a small yellow-and-red Kairosoft character icon followed by `Site`.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1103109519

**RULE 2.7 — Split the bottom bar by convention: utility on the far left, primary/advance action on the far right.**
- **Evidence:** *(verified)* `Game Dev Story` places `Save` bottom-left and `Menu` bottom-right, flanking a character portrait in the centre. `Pocket Academy 3` puts `Save` far left and `Menu` far right with an **icon-only** pink upward-pointing triangle button in the centre slot — an icon with no text label, used as a compact "advance" affordance.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1623111026

**RULE 2.8 — Where a Kairosoft screen has no persistent tab bar, it uses a right-edge vertical button stack instead of a bottom bar.**
- **Evidence:** *(verified)* `Dream Town Story` stacks orange rounded-rectangle buttons vertically down the right edge: a small `Next Town` text link at the very top, then a briefcase `SHOP` button, then `Residents` (two-people icon + yellow badge with the number `3`), `Actions` (briefcase icon + yellow badge `2`) and `Build` (hammer/wrench icon + yellow badge `1`). Each button is a flat orange rounded rectangle with a thick dark outline and white text with a thin black shadow — deliberately *not* bevelled, so it does not fight the artwork.
- **Source:** https://itunes.apple.com/lookup?id=1320716777

**RULE 2.9 — Never use a Kairosoft-style bottom bar with no active-state indicator as your primary navigation.** This is the one place GameStewKit should deliberately diverge.
- **Evidence:** *(verified)* In `Tropical Resort Story`'s bottom bar, `Site` and `Finish` are visually identical — same colour, same shading, no underline, no brightness change, no raised state. In `Pocket League Story 2` the two bottom buttons are "grey metallic gradient background and beveled border" with "**Neither button is visually highlighted as active.**" Kairosoft uses bars for *actions*, where a selected state would be meaningless — so they don't provide one. A destination tab bar has exactly the opposite requirement.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1103109519 · https://m3.material.io/components/navigation-bar/guidelines

---

## 3. Button styling

**RULE 3.1 — Draw every raised button as a bevelled 3D rectangle: a lighter edge on the top and left, a darker edge on the bottom and right.**
- **Evidence:** *(verified)* `Game Dev Story` bottom action buttons: "bevelled 3D style with a lighter highlight edge along the top-left and a darker shadow edge along the bottom-right." The iPad build is described the same way in red: "a lighter red highlight at the top edge, and a darker red shadow at the bottom edge." The `Gamedex #4` screen's two bottom buttons are "dark blue face with lighter blue highlights on the top and left edges and darker shadows on the bottom and right edges."
- **Source:** https://itunes.apple.com/lookup?id=396085661

**RULE 3.2 — Keep the bevel thin (1–2 px at 1×) and the face flat. Do not use gradients on bevelled chrome buttons.**
- **Evidence:** *(verified)* The bevelled `Game Dev Story` buttons have a flat face with a single-pixel light/dark edge pair. Where a Kairosoft button *does* use a gradient (`Pocket Academy 3`'s orange buttons: saturated orange at the bottom → lighter peach at the top, dark brown border, drop shadow) it is a *flat, gradient-faced* button — a different component from the bevelled chrome button, and it is used for the primary action, not for chrome.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1623111026

**RULE 3.3 — Give flat (non-bevelled) action buttons a thick dark outline, rounded corners, and outlined text, so they read as "floating above" the scene.**
- **Evidence:** *(verified)* `Dream Town Story`'s right-edge buttons: rounded corners, thick dark outline, orange fill, white text with a thin black shadow. `Tropical Resort Story`'s modal frame: a thick turquoise-blue border around the whole panel.
- **Source:** https://itunes.apple.com/lookup?id=1320716777 · https://itunes.apple.com/lookup?id=1617006551

**RULE 3.4 — Use a 9-slice sprite for chunky pixel-art buttons so they scale to any label length without distorting the bevel.**
- **Evidence:** Godot's `NinePatchRect` "produces clean panels of any size based on a small texture. To do so, it splits the texture in a 3×3 grid. When you scale the node, it tiles the texture's edges horizontally or vertically, tiles the center on both axes, and leaves the corners unchanged." The four `patch_margin_*` properties define the protected border; `AXIS_STRETCH_MODE_TILE` "Repeats the center texture across the node… This won't cause any visible distortion" whereas `AXIS_STRETCH_MODE_STRETCH` "may cause the texture to be distorted."
- **Source:** https://docs.godotengine.org/en/stable/classes/class_ninepatchrect.html
- **Note:** this is an implementation-mechanics citation (Godot's own docs), not a Kairosoft citation. Kairosoft's shipping UI is flat-shaded with per-widget pixel art, and the game's own asset pipeline is RLE-compressed 8-bit bitmaps, not 9-slice atlases.

**RULE 3.5 — Make every tappable target at least 44×44 pt, even when the pixel-art glyph is smaller.**
- **Evidence:** Apple HIG, Accessibility: the minimum touch target for **iOS/iPadOS is 44×44 pt** (macOS 28×28, tvOS 66×66, visionOS 60×60, watchOS 44×44). HIG further: "**Consider spacing between controls as important as size.** Include enough padding between elements to reduce the chance that someone taps the wrong control. In general, it works well to add **about 12 points of padding** around elements that include a bezel. For elements without a bezel, about **24 points of padding** works well around the element's visible edges."
- **Source:** https://developer.apple.com/design/human-interface-guidelines/accessibility

**RULE 3.6 — On press, invert or sink the button rather than fading it.**
- **Evidence:** `NO SOLID EVIDENCE FOUND` for Kairosoft specifically — static App Store screenshots cannot show a pressed state, and no Kairosoft source code exists publicly to inspect. The bevelled top-left-light / bottom-right-dark construction is *inherently* a press-state affordance (it encodes a lit 3D surface), so the convention is to swap to the inverse bevel on press. Treat the press behaviour as a reasoned extension of the observed bevelled style, not a directly observed Kairosoft behaviour.
- **Source (the bevel style being extended):** https://itunes.apple.com/lookup?id=396085661

**RULE 3.7 — Give the primary action a visually distinct treatment from secondary actions — larger, gradient-faced, or centred.**
- **Evidence:** *(verified)* `Convenience Stories` has a large, centred `Start` button sitting between `Site` and `Finish`, and it is the most prominent control in the frame. `Pocket Academy 3`'s `Save`/`Menu` pair uses the gradient-faced orange button style, distinct from the flat icon-only triangle in the centre slot.
- **Source:** https://itunes.apple.com/lookup?id=1601177112 · https://itunes.apple.com/lookup?id=1623111026

---

## 4. Numbers, multipliers and bars

**RULE 4.1 — Write multipliers as `x1.5` — lowercase `x`, no space, one decimal — never as a percentage or a chip.**
- **Evidence:** The Kairosoft wiki describes multipliers in exactly this notation: "**Any opponent whose multiplier is greater than "x1.0" is a very difficult opponent**" (Dream Town Story Global Battle); "bonuses to XP given (**x1.2, x1.5 and x2** for 10-24, 25-49 and 50+ items)" and "Ingredient XP granted from items is multiplied by an additional 1.2x on Mondays" (Bonbon Cakery); "**Each combo adds to a multiplier (starting at 100%)**" (Dream Town Story combos).
- **Source:** https://kairosoft.wiki.gg/wiki/Tips_(Dream_Town_Story) · https://kairosoft.wiki.gg/wiki/Items_(Bonbon_Cakery) · https://kairosoft.wiki.gg/wiki/Combos_(Dream_Town_Story)

**RULE 4.2 — Use `%` only for additive stat bonuses ("Adds +10% to all stats"), and keep the `+` sign.**
- **Evidence:** Bonbon Cakery's item table lists "Adds +10% to all stats", "+15%", "+20%", "+30%", "+50%", and negative variants "All stat increase/decrease -5%/-10%/-20%". Note the convention: a *multiplier* is `x1.5`; a *flat percentage bonus* is `+10%`.
- **Source:** https://kairosoft.wiki.gg/wiki/Items_(Bonbon_Cakery)

**RULE 4.3 — Put the multiplier in the panel where the boosted value is compared, not in the top bar.**
- **Evidence:** The `x1.0`/`x1.5` notation appears inside specific windows — the Global Battle window (Dream Town Story) and the item/bonus descriptions (Bonbon Cakery) — rather than as a persistent HUD chip.
- **Source:** https://kairosoft.wiki.gg/wiki/Tips_(Dream_Town_Story) · https://kairosoft.wiki.gg/wiki/Items_(Bonbon_Cakery)

**RULE 4.4 — Render progress as a thin horizontal bar in a light track, with the fill colour carrying the state.**
- **Evidence:** *(verified)* `Tropical Resort Story`: the money display sits directly above "a small horizontal progress bar (dark grey with a light blue fill) sitting next to a yellow gold bar/ingot icon." `Pocket Academy 3`: a blue progress bar at the bottom of the performance panel. `Game Dev Story`: the develop screen shows two separate labelled meters — `Hype` and `Fame` — side by side rather than a single combined bar.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=396085661

**RULE 4.5 — Use colour only to signal direction, and never as the sole carrier of a number's meaning.**
- **Evidence:** *(verified)* `Tropical Resort Story`'s stats panel uses a purple right-pointing arrow with a white outline to mean "converts into", and the reward value is always additionally prefixed by a coin icon. `Dream Town Story`'s money reads "a gold coin icon followed by the text '3G' in a bold, white font with a dark blue outline." Text that sits on artwork is always outlined, never colour-only.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1320716777

**RULE 4.6 — Let the icon carry the unit so the number stays naked.** Kairosoft's number is always preceded by the icon that names the thing (`[pen] 3055`, `[coin] 68,810,600G`, `[bulb] 47`, `[medal] 80`).
- **Evidence:** *(verified)* `Pocket Academy 3` row 2 and `Convenience Stories` top bar, as read above.
- **Source:** https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=1601177112

---

## 5. Popups and panels

**RULE 5.1 — Use a centred modal panel over a dimmed backdrop, not a slide-up bottom sheet.**
- **Evidence:** *(verified)* `Tropical Resort Story`'s "Hotel #1 Complete!" panel is a centred rectangle with a thick turquoise-blue border, floating over the still-visible resort artwork; the panel contains a header, an illustration, stat rows and a summary bar. `High Sea Saga`'s "Monster Farm" panel is likewise a centred bordered panel over the scene. Neither is anchored to the screen edge.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1084639614

**RULE 5.2 — Give every modal a header in its own shape (a white pill inside the frame) and a footer action row.**
- **Evidence:** *(verified)* "Header Bar: rounded white pill containing the black text 'Hotel #1 Complete!'" inside a "thick turquoise-blue border" frame; below the illustration and stat rows, a "Bottom Summary Bar (Inside Modal)" splits the footer into two halves — a light-blue `Room Price` banner with a coin icon and `10,750` in large gold pixelated numbers, and a light-blue `Length of Stay` banner with a calendar icon and `Days: 1`. `Game Dev Story`'s development panel likewise ends in a single `Cancel`/`OK` button row.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=396085661

**RULE 5.3 — Use alternating row fills inside modal tables.**
- **Evidence:** *(verified)* "Background of Panel: pale mint-green and white **alternating rows** for data clarity."
- **Source:** https://itunes.apple.com/lookup?id=1617006551

**RULE 5.4 — Use a fixed formula for every stat row in a results panel.**
- **Evidence:** *(verified)* The `Tropical Resort Story` breakdown row format is `[Icon] [Stat Value] [Purple Arrow] [Coin Icon] [Bonus Value] [Optional Extra Icon]` — for example palm-tree icon `14` → purple arrow → coin `3,750` → calendar `+2`.
- **Source:** https://itunes.apple.com/lookup?id=1617006551

**RULE 5.5 — Make the panel border a single strong accent colour, and keep the interior quiet.**
- **Evidence:** *(verified)* The "Hotel #1 Complete!" panel uses exactly one strong hue (turquoise-blue) for its border; the interior is white and pale mint. `Game Dev Story`'s Magazine Reviews panel is framed in blue.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=396085661

**RULE 5.6 — Use speech bubbles for character speech; never for system messages.**
- **Evidence:** *(verified)* Across every Kairosoft title sampled, character speech is a white rounded rectangle with a thin black or blue outline and a small triangular tail pointing at the speaker — in `Game Dev Story` ("Morning!", "Well done."), `World Cruise Story` ("I'll take this!", "Relaxing", "Jackpot!", "This is fun!"), `Tropical Resort Story`, `Pocket Academy 3`. System information is never in a bubble; it lives in the top bar, in panels, or in a full-width banner.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=802826167 · https://itunes.apple.com/lookup?id=1623111026

**RULE 5.7 — Outline every text string that floats over artwork.**
- **Evidence:** *(verified)* In `Game Dev Story` (iPad), "Floating UI elements (like the game consoles at the top) feature a thick black outline surrounded by a white 'sticker-style' outer border"; float text over characters ("+2", "+3", "+7") is white with a black outline; speech-bubble text is blue pixel font on white.
- **Source:** https://itunes.apple.com/lookup?id=396085661

---

## 6. Primary action placement (the "End Day" / advance-the-clock button)

**RULE 6.1 — Put the advance-the-clock action in the bottom bar, as a labelled text button, and keep it reachable at all times.**
- **Evidence:** *(verified)* `Tropical Resort Story` and `Pocket Academy 3` both end their bottom bar with a `Finish` button. `Pocket League Story 2` uses `Time-out` for the same role. `High Sea Saga` uses `Map` / `Quit`; `Kingdom Adventurers` uses `Site` / `Quit`. The naming across the catalogue for "stop here and resolve the current period" is `Finish` / `Time-out` / `Quit`.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=1103109519 · https://itunes.apple.com/lookup?id=1084639614 · https://itunes.apple.com/lookup?id=1478584982

**RULE 6.2 — Use an icon-only centred button when the advance action needs to be permanently present without eating label width.**
- **Evidence:** *(verified)* `Pocket Academy 3`'s bottom bar: `Save` far left, `Menu` far right, and in the centre a **small pink upward-pointing triangle with no text label** — a compact always-present "advance" affordance that costs almost no width.
- **Source:** https://itunes.apple.com/lookup?id=1623111026

**RULE 6.3 — Do NOT make "End Day" a full-width button. This is where the GameStewKit GDD diverges from the Kairosoft convention and the research does not support it.**
- **Evidence:** Across all 10 Kairosoft titles sampled, the bottom bar is **never** a single full-width primary button — it is always 2–3 discrete buttons in a row, with the advance action as one of them. *(Corroborating)* A scan of the bottom strip of all 56 screenshots found the recurring shapes to be: (a) a 2-button utility bar (`Save`/`Menu`), and (b) a 2–3 button control bar (`Site` + action + `Finish`/`Menu`/`Quit`); no full-width advance button appears anywhere. The GDD's *"End Day is a full-width button at the bottom, always reachable"* should therefore be changed to **a discrete, always-visible button in the fixed bottom bar** — which preserves the "always reachable" intent while matching the reference.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1103109519

**RULE 6.4 — Keep the bottom bar's utility buttons (Save/Menu) at the extreme edges and the advance action adjacent to them, not centred behind the primary action.**
- **Evidence:** *(verified)* `Game Dev Story`: `Save` bottom-left, `Menu` bottom-right, character portrait in the middle. `Pocket Academy 3`: `Save` left, triangle centre, `Menu` right.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1623111026

---

## 7. Chrome: sprites and icons instead of plain text labels

**RULE 7.1 — Replace every noun in the chrome with a purpose-drawn pixel icon; keep the word only where it names a state, a number or a tab.**
- **Evidence:** *(verified)* `Dream Town Story` right-edge stack: `SHOP` is a briefcase symbol; `Residents` is a two-people icon; `Actions` is a briefcase icon; `Build` is a hammer/wrench icon. The three right-edge buttons are icon-only — their words appear only as small descriptive text beside `Next Town`. `Pocket Academy 3`'s resource row is entirely icon+number. `Game Dev Story` uses a floppy-disk icon for Research Data, a small controller icon for console stat modifiers, and a character sprite for the centre portrait.
- **Source:** https://itunes.apple.com/lookup?id=1320716777 · https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=396085661
- **Corroborating, official:** the `Game Dev Story` manual: "The **upper left floppy disk** shows your Research Data."
  - **Source:** https://kairosoft.wiki.gg/wiki/Transcript:Manual_(Game_Dev_Story)

**RULE 7.2 — Put a small numeric badge on an icon button to show a pending count.**
- **Evidence:** *(verified)* `Dream Town Story`'s `Residents` button carries a yellow square badge containing `3`; `Actions` a badge with `2`; `Build` a badge with `1`. The badge is a solid yellow square with a dark blue number, sitting at the leading edge of the button.
- **Source:** https://itunes.apple.com/lookup?id=1320716777

**RULE 7.3 — Size the icon to roughly the cap-height of its label, not to the label's full line height, and keep the icon on the leading side.**
- **Evidence:** *(verified)* `Tropical Resort Story`'s `Site` button — "the text label is significantly larger and more prominent than the small character icon next to it." `Pocket League Story 2`'s `Site` button — a small yellow-and-red Kairosoft character icon followed by the label `Site`.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1103109519

**RULE 7.4 — Use the pixel font for labels and never anti-alias it.**
- **Evidence:** *(verified)* `Game Dev Story`'s Magazine Reviews list uses a pixel font, with scores and totals in a blue pixel font against black body text. `Pocket Academy 3`'s date uses "yellow and white pixel font". `Game Dev Story`'s `Gamedex #4` header is plain white text on black.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1623111026

**RULE 7.5 — Keep the badge colour out of the palette budget: one accent (yellow) for badges, one for the money coin, one for the active tab indicator.**
- **Evidence:** *(verified)* Yellow badges on `Dream Town Story`'s buttons; a gold coin icon for money in every title; `Pocket Academy 3`'s money rendered in a yellow/green weight distinct from other values.
- **Source:** https://itunes.apple.com/lookup?id=1320716777 · https://itunes.apple.com/lookup?id=1623111026

---

## 8. Slot-machine / gacha reel conventions

**`NO SOLID EVIDENCE FOUND` for a Kairosoft slot-machine or gacha reel.**
- **Reasoning and what I did check:**
  - **Kairosoft has no known gacha mechanic.** None of the 10 Kairosoft titles sampled (`Game Dev Story`, `Game Dev Story+`, `Pocket Academy 3`, `Pocket League Story 2`, `Tropical Resort Story`, `Convenience Stories`, `Dream Town Story`, `World Cruise Story`, `High Sea Saga`, `Kingdom Adventurers`) contains a reel, gacha pull, or randomised-cost shop.
  - **Pocket Mortys is not a Kairosoft game.** It is published by **Big Pixel Studios / Adult Swim Games** — the community wiki describes it as "an iOS/Android game from Big Pixel Studios and Adult Swim Games." Any "Kairosoft gacha" intuition derived from Pocket Mortys is a category error. Source: https://pocketmortys.net/
  - The only Kairosoft randomness that resembles a reveal is `Game Dev Story`'s development cycle: a game is developed over weeks, then reviewed, then judged at the Global Game Awards — but that is a timed result, not a reel.
    - **Source:** https://kairosoft.wiki.gg/wiki/Game_Dev_Story
- **What this means for GameStewKit:** the GDD's "**Fate Reel**" is an original mechanic, not a Kairosoft imitation. Treat it as a design-innovation area and do not claim Kairosoft precedent for it. If you want reel conventions from a comparable mobile gacha, that is a separate research task against Big Pixel Studios' games — out of scope here.
- **Source (for the decomp repo having no UI code to consult):** https://github.com/Red-K0/GameDevStory-Decomp

---

## 9. Colour: neutral chrome, bright artwork

**RULE 9.1 — Keep UI chrome in a narrow, desaturated range and reserve saturated colour for the artwork and for values that need to be read as currency or reward.**
- **Evidence:** *(verified)* Every Kairosoft bar sampled is mid-value and low-chroma: `Game Dev Story`'s semi-transparent red top bar and dark blue bottom bar; `Pocket Academy 3`'s light teal resource row and dark green woven-texture bottom bar; `Tropical Resort Story`'s teal gradient bar and brown wood-grain bottom panel; `Convenience Stories`' orange banner. The artwork underneath is fully saturated. The saturation is asymmetric by design.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1623111026 · https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1601177112

**RULE 9.2 — Allow exactly one accent colour per screen for "this is the important thing" (the panel border, the active indicator, the badge).**
- **Evidence:** *(verified)* `Tropical Resort Story`'s modal uses one accent (turquoise-blue border). `Dream Town Story`'s button badges use one accent (yellow). Apple's guidance is explicit about the failure mode: "Avoid applying a similar color to tab labels and content layer backgrounds. If your app already has bright, colorful content in the content layer, **prefer a monochromatic appearance for tab bars**, or choose an accent color with sufficient visual differentiation."
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1320716777 · https://developer.apple.com/design/human-interface-guidelines/tab-bars

**RULE 9.3 — Outline text that crosses a colour boundary rather than adding a background plate.**
- **Evidence:** *(verified)* `Game Dev Story` float text is white with a black outline; floating world elements get a "sticker-style" white outer border around a thick black outline; `Dream Town Story`'s money is "bold, white font with a dark blue outline" over the town view.
- **Source:** https://itunes.apple.com/lookup?id=396085661 · https://itunes.apple.com/lookup?id=1320716777

**RULE 9.4 — Kairosoft's art direction is explicitly "bright, toy-like" — the bright colours belong to the *sprites*, which is the whole reason the chrome stays quiet.**
- **Evidence:** The `Pixel Art Research: Learning from Kairosoft` article's opening (as returned in search results) reads: "Kairosoft is a company that creates many pixel art management simulation games. While there are many pixel art games in the world, the defining feature of Kairosoft games is, above all, the pixel art of buildings and characters that look like toys, created with bright colors. When you actually play the games, you can see that even though each piece of pixel art uses a low pixel count, it …" — *the full article could not be retrieved; see Fetch failures.*
- **Source:** https://note.com/iseebinokathi/n/n4e7bf9bf4e90

**RULE 9.5 — Use a neutral mid-grey key colour as the "no data" placeholder, and reserve full saturation for meaningful pixels.**
- **Evidence:** The `Game Dev Story` asset pipeline ships `Color.bmp` as "A 1 pixel bitmap of hex color `#808080`, the exact middle of the 24-bit color spectrum. Not displayed due to size." — i.e. a deliberately neutral, non-competing grey.
- **Source:** https://raw.githubusercontent.com/Red-K0/GameDevStory-Decomp/main/Assets/Assets.md

---

## 10. Scrollable lists: cards with a coloured left accent vs full-bleed rows

**RULE 10.1 — Inside a modal, use full-width rows with a thin coloured block at the leading edge as the row's icon/portrait column — not a floating card with a category-accent border.**
- **Evidence:** *(verified)* `Game Dev Story`'s Magazine Reviews list: the rows are "**inset** cards, contained within a larger blue-bordered frame rather than spanning the full width of the game screen", and "Each review row has a solid **red vertical stripe or block on the far left**, serving as a background for the character avatars." There is no alternating row striping, and the stripe is a *portrait backing plate*, not a category colour code.
- **Source:** https://itunes.apple.com/lookup?id=396085661

**RULE 10.2 — Alternate row fills in wide data tables; do not alternate in narrow list panels.**
- **Evidence:** *(verified)* `Tropical Resort Story`'s results table uses "pale mint-green and white alternating rows for data clarity" across a wide panel. `Game Dev Story`'s Magazine Reviews rows are "every row has a plain white background" inside a narrower list.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=396085661

**RULE 10.3 — Hide the scrollbar; use an end-of-list affordance instead.**
- **Evidence:** *(verified)* The Magazine Reviews list has "**no visible scrollbar** on the side of the list, although a small downward-pointing arrow is present in the 'Total' row at the bottom."
- **Source:** https://itunes.apple.com/lookup?id=396085661

**RULE 10.4 — Group related rows with container shapes or separator lines, and align the rows so they read as one block.**
- **Evidence:** Apple HIG, Layout: "**Align elements to make them easier to scan, and use indentation to convey hierarchy.** Alignment makes an app look neat and organized… People assume that aligned items are related to each other… **Group related items to clearly express related information or functions.** For example, you can use negative space, container shapes, or separator lines to show which elements are related and which are unrelated." HIG also mandates leading-side ordering: "place the most important items near the top and leading side of the window or display."
- **Source:** https://developer.apple.com/design/human-interface-guidelines/layout

**RULE 10.5 — Keep money values right-aligned within a row so decimal points line up.**
- **Evidence:** *(verified, structural)* `Tropical Resort Story`'s stat rows place the icon first and the numeric values to the right of a `>` arrow, with the coin-icon-plus-value pair forming a fixed suffix column; `Pocket Academy 3`'s resource row places each icon immediately left of its number, giving every pair a consistent internal alignment.
- **Source:** https://itunes.apple.com/lookup?id=1617006551 · https://itunes.apple.com/lookup?id=1623111026
- **Note:** this rule is partly a standards inference; explicit right-alignment of currency columns was not directly observable in the sampled pixels.

---

## THE 12 RULES I'M TAKING INTO THE REDESIGN

Prioritised. Each is implementable and checkable.

| # | Rule | Why it ranks here | Source |
|---|---|---|---|
| 1 | **Top bar = date/time left → icon+value resource pairs centre → money far right as a large coin-icon number with comma separators and a currency suffix.** | It is the single most-repeated structure across all 10 Kairosoft titles and the most-looked-at surface in the game. Getting it wrong makes the whole thing feel wrong. | https://itunes.apple.com/lookup?id=1623111026 |
| 2 | **Every tappable target ≥ 44×44 pt, with ≥12 pt padding around bezelled controls and ~24 pt around un-bezelled ones.** | Non-negotiable accessibility floor, and pixel art tempts you to draw smaller hitboxes than the art. | https://developer.apple.com/design/human-interface-guidelines/accessibility |
| 3 | **All raised buttons are bevelled 3D: light top-left edge, dark bottom-right edge, flat face, 1–2 px bevel.** | The single strongest visual signature of a Kairosoft UI. Cheap to implement, instantly readable as "retro". | https://itunes.apple.com/lookup?id=396085661 |
| 4 | **Bottom navigation = 3–5 destinations, each with an icon AND a 1–2 word label, exactly one active destination, marked by a single active indicator with ≥3:1 icon contrast.** | The one place GameStewKit must diverge from Kairosoft, which uses no active state at all because its bottom bar is for actions. A destination tab bar needs the indicator. | https://m3.material.io/components/navigation-bar/guidelines |
| 5 | **Bottom bar is fixed, separated from content by a background change or divider rule, and split conventionally: utility left, advance action right.** | Fixed positioning is what makes the advance action "always reachable" — the GDD's actual requirement. | https://itunes.apple.com/lookup?id=396085661 |
| 6 | **"End Day" becomes a discrete labelled button in the fixed bottom bar (e.g. `Finish`), NOT a full-width button. Keep the GDD's "always reachable" intent; drop the full-width form.** | Directly contradicts the current GDD, and the research supports the change: no Kairosoft title uses a full-width advance button. This is the highest-value correction in this document. | https://itunes.apple.com/lookup?id=1617006551 |
| 7 | **Multipliers are written `x1.5` (lowercase x, no space, one decimal). Percentages only for additive bonuses, written `+10%`. Never a chip — put the multiplier in the panel that compares the values.** | Kairosoft has a precise, documented notation and it is easy to get wrong by habit (`×1.5`, `1.5x`, `150%` all appear in the wild). | https://kairosoft.wiki.gg/wiki/Items_(Bonbon_Cakery) |
| 8 | **Popups are centred modal panels over a dimmed backdrop — thick single-colour border, white-pill header, stat rows on a fixed `[icon][value][arrow][coin][reward]` formula, alternating fills, footer action row. No bottom sheets.** | Kairosoft's convention is unambiguous across titles, and bottom sheets are the iOS-native reflex that would look foreign here. | https://itunes.apple.com/lookup?id=1617006551 |
| 9 | **Chrome is desaturated and monochrome; one accent colour per screen; saturated colour is reserved for artwork, the money coin, and badges. Outline all text that crosses a colour boundary.** | This is what makes the bright pixel art pop. Getting the chrome too colourful destroys the toy-like effect that is Kairosoft's defining trait. | https://developer.apple.com/design/human-interface-guidelines/tab-bars |
| 10 | **Chrome nouns are icons, not words: icon+number for every resource, a small numeric badge on icon buttons, a portable floppy-style icon for "research/data". Icon ≈ cap-height of its label, always on the leading side.** | Kairosoft uses icons as *labels* (the manual calls it "the floppy disk", not "Research Data"). Words are reserved for states and tab labels. | https://kairosoft.wiki.gg/wiki/Transcript:Manual_(Game_Dev_Story) |
| 11 | **Progress is a thin horizontal bar in a light track; separate labelled meters for separate quantities (e.g. `Hype` and `Fame` side by side), never one combined bar.** | Kairosoft splits distinct quantities into distinct meters — collapsing them into one bar is a common and readability-costly shortcut. | https://itunes.apple.com/lookup?id=396085661 |
| 12 | **Lists: full-width inset rows in a bordered frame, with a thin coloured block at the leading edge as the icon/portrait plate; alternating fills only in wide tables; hide the scrollbar and use an end-of-list arrow. Use 9-slice (`NinePatchRect`, `patch_margin_*`, `AXIS_STRETCH_MODE_TILE`) for any scalable chunky frame.** | Covers both the list treatment and the one real Godot implementation risk — stretching a bevelled sprite instead of 9-slicing it. | https://docs.godotengine.org/en/stable/classes/class_ninepatchrect.html |

**Two things I am explicitly *not* claiming:**
- There is **no Kairosoft gacha/slot-machine precedent** (Rule set 8). The GDD's Fate Reel is original and must not be justified by a false citation.
- There is **no public Kairosoft source code** to cite constants from. `Red-K0/GameDevStory-Decomp` contains bitmaps, WAVs and executables only — no `.c`, `.cpp`, `.pas` or resource-definition files exist in it.

---

## Fetch failures

Every one of these was attempted and is logged honestly.

| Target | Attempt | Result |
|---|---|---|
| `note.com/iseebinokathi/n/n4e7bf9bf4e90` (Pixel Art Research: Learning from Kairosoft) | direct fetch; `r.jina.ai` proxy; `note.com/api/v2/articles/...`; `note.com/api/v3/notes/...`; `note.com/api/v2/notes/...`; `api.allorigins.win`; `corsproxy.io` | **All returned the Japanese maintenance page** ("現在メンテナンス中です。") / 503. The article body is not retrievable. Only the DuckDuckGo search-result snippet is available, and it is quoted in Rule 9.4. |
| Same article via archive | `archive.org/wayback/available` | `"archived_snapshots": {}` — no snapshot exists. |
| Same article via archive (CDX) | `web.archive.org/cdx/search/cdx` | Internet Archive returned "Temporarily Offline". |
| Same article via archive.today | `archive.ph/newest/<url>` | Returned an error page, no content. |
| Same article via search engines | DuckDuckGo HTML + Lite endpoints, Bing | No full-text mirror or cached copy; only the search-result snippet. |
| `kairosoft.fandom.com/wiki/Game_Dev_Story` | direct fetch; `r.jina.ai` proxy | **403 / Cloudflare "Just a moment…"** bot check. Not retrievable. The `kairosoft.wiki.gg` mirror of the same community was used instead and works. |
| `m2.material.io` | (per task note) | Not used — JS-rendered, no server HTML. **Material Design 3** (`m3.material.io`) was used instead and does render server-side. |
| `Red-K0/GameDevStory-Decomp` source code | GitHub tree API (`git/trees/main?recursive=1`) | **Succeeded, but the tree contains no source code.** 51 entries total: `Assets/` (7 `.bmp`, 3 `.wav`, `Assets.md`), `Original Game/` and `EN Translation/` (each: `Develop.exe`, `HELP.HLP`, `TITLE.RLE`, 10 `Hard*.dat`, 3 `.wav`, `Color.bmp`), plus `LICENSE` (GPL-3.0). The repo description says "A decompilation and translation" but it is an asset-extraction project. All UI-constant claims for the original 1996 build are therefore unavailable. |
| GitHub-wide search for other Kairosoft decompilations | `gh api search/repositories` ×3 queries; `gh api search/code` | Only `Red-K0/GameDevStory-Decomp` exists for "kairosoft decomp". The nearest related project is `UnSpotibleShadow/OpenGDS2` — "an independent community reimplementation of Kairosoft's Game Dev Story 2 DX, built with Godot 4 and C#… original assets are excluded." Its source was **not** used as evidence: it is a third-party reimplementation, not Kairosoft's own UI, so it would evidence *someone else's* interpretation rather than the reference. |
| `Air Baron`, `Pocket Mortys` App Store listings | `itunes.apple.com/search` (US + JP) | `Air Baron` returned only unrelated results in both storefronts; `Pocket Mortys` returned only unrelated results. `pocketmortys.net` confirms Pocket Mortys is published by Big Pixel Studios / Adult Swim Games — **not Kairosoft** — so it was excluded as a Kairosoft reference anyway. |
| `Game UI Database` | `gameuidatabase.com/index.php` | Reachable, but the useful content is a JS image browser — no citable text rules extracted. Not used as a source. |
| Press state of Kairosoft buttons | 56 App Store screenshots | **Static images cannot show a pressed state.** Rule 3.6 is flagged as a reasoned extension, not a direct observation. |

### Screenshot corpus used (all fetched and read directly)

Screenshots were pulled via the public Apple lookup API (`itunes.apple.com/lookup?id=<trackId>`) and inspected with a vision model, individually and as labelled montages of the top and bottom strips of all 56 images.

| Title | Track ID | Lookup URL used as source |
|---|---|---|
| Game Dev Story | 396085661 | https://itunes.apple.com/lookup?id=396085661 |
| Game Dev Story+ | 1557657042 | https://itunes.apple.com/lookup?id=1557657042 |
| Pocket Academy 3 | 1623111026 | https://itunes.apple.com/lookup?id=1623111026 |
| Pocket League Story 2 | 1103109519 | https://itunes.apple.com/lookup?id=1103109519 |
| Tropical Resort Story | 1617006551 | https://itunes.apple.com/lookup?id=1617006551 |
| Convenience Stories | 1601177112 | https://itunes.apple.com/lookup?id=1601177112 |
| Dream Town Story | 1320716777 | https://itunes.apple.com/lookup?id=1320716777 |
| World Cruise Story | 802826167 | https://itunes.apple.com/lookup?id=802826167 |
| High Sea Saga | 1084639614 | https://itunes.apple.com/lookup?id=1084639614 |
| Kingdom Adventurers | 1478584982 | https://itunes.apple.com/lookup?id=1478584982 |

### Community wiki sources

- Game overview: https://kairosoft.wiki.gg/wiki/Game_Dev_Story
- Manual transcript (floppy-disk icon, Research Data): https://kairosoft.wiki.gg/wiki/Transcript:Manual_(Game_Dev_Story)
- Multiplier notation (`x1.0`): https://kairosoft.wiki.gg/wiki/Tips_(Dream_Town_Story)
- Multiplier notation (`x1.2`, `x1.5`, `x2`) and `+10%` bonuses: https://kairosoft.wiki.gg/wiki/Items_(Bonbon_Cakery)
- Multiplier as percentage from 100%: https://kairosoft.wiki.gg/wiki/Combos_(Dream_Town_Story)
