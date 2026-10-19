Bundled fonts for the generated share images (SIL Open Font License 1.1, texts alongside).
Newsreader-DisplayMedium.ttf, HankenGrotesk-Medium.ttf and HankenGrotesk-Bold.ttf are static instances
cut (Newsreader at weight 600, optical size 60; Hanken Grotesk at 500 and 700) from the upstream variable fonts (google/fonts) so Pango picks the right weight without system fonts.
The "Rathe" wordmark is drawn from an outline of UnifrakturCook Bold (see src/sharing/preview/wordmark-path.ts),
so that font file itself is not shipped; its license text is kept in OFL-UnifrakturCook.txt.
